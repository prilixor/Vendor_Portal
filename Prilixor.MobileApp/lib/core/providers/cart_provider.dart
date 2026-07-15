import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../api/api_client.dart';
import '../models/cart_model.dart';
import '../models/product_detail_model.dart';
import '../utils/media_url.dart';

class CartProvider extends ChangeNotifier {
  final List<CartLineModel> _lines = [];
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  final ApiClient _apiClient = ApiClient();
  static const String _cartKey = 'saved_cart';

  final Map<String, ProductDetailModel> _listingDetails = {};
  bool _isRefreshingStock = false;
  bool get isRefreshingStock => _isRefreshingStock;

  CartProvider() {
    _loadCart();
  }

  Future<void> _loadCart() async {
    final cartStr = await _storage.read(key: _cartKey);
    if (cartStr != null) {
      final List<dynamic> jsonList = jsonDecode(cartStr);
      _lines.addAll(jsonList.map((json) => CartLineModel.fromJson(json)).toList());
      notifyListeners();
      if (_lines.isNotEmpty) refreshStock();
    }
  }

  Future<void> _saveCart() async {
    final cartStr = jsonEncode(_lines.map((line) => line.toJson()).toList());
    await _storage.write(key: _cartKey, value: cartStr);
  }

  List<CartLineModel> get lines => _lines;

  int get itemCount => _lines.fold(0, (sum, line) => sum + line.quantity);

  double get totalEstimatedRent => _lines.fold(0.0, (sum, line) => sum + line.lineTotal);

  bool get needsPrescription => _lines.any((l) => l.prescriptionRequired);

  double get totalDeposit => _lines.fold(
        0.0,
        (sum, line) => sum + (line.orderType == 'buy' ? 0 : line.securityDeposit * line.quantity),
      );

  /// Live stock for a cart line (variant-aware). Null while unknown.
  int? availableQuantityFor(CartLineModel line) {
    final detail = _listingDetails[line.listingId];
    if (detail == null) return null;
    if (line.productVariantId != null && line.productVariantId!.isNotEmpty) {
      return detail.availableForVariant(line.productVariantId);
    }
    return detail.availableQuantity;
  }

  bool get hasStockIssues => _lines.any((line) {
        final avail = availableQuantityFor(line);
        return avail != null && line.quantity > avail;
      });

  Future<void> refreshStock() async {
    final ids = _lines.map((l) => l.listingId).toSet().toList();
    if (ids.isEmpty) {
      _listingDetails.clear();
      notifyListeners();
      return;
    }
    _isRefreshingStock = true;
    notifyListeners();
    try {
      for (final id in ids) {
        try {
          final response = await _apiClient.dio.get('/customers/catalog/listings/$id');
          if (response.statusCode == 200 && response.data is Map<String, dynamic>) {
            _listingDetails[id] = ProductDetailModel.fromJson(response.data as Map<String, dynamic>);
          }
        } catch (_) {
          // Keep previous cache for this listing if refresh fails.
        }
      }
      // Drop details for listings no longer in cart.
      _listingDetails.removeWhere((id, _) => !ids.contains(id));

      // Fill missing cart thumbnails from listing primary/gallery images.
      var hydrated = false;
      for (final line in _lines) {
        if (line.primaryImageUrl != null && line.primaryImageUrl!.trim().isNotEmpty) continue;
        final detail = _listingDetails[line.listingId];
        if (detail == null || detail.imageUrls.isEmpty) continue;
        final url = resolveItemImageUrl(imageUrls: detail.imageUrls);
        if (url == null) continue;
        line.primaryImageUrl = url;
        hydrated = true;
      }
      if (hydrated) _saveCart();
    } finally {
      _isRefreshingStock = false;
      notifyListeners();
    }
  }

  int _indexOfLine(String listingId, {String? productVariantId}) {
    return _lines.indexWhere(
      (line) =>
          line.listingId == listingId &&
          (line.productVariantId ?? '') == (productVariantId ?? ''),
    );
  }

  void addLine(CartLineModel newLine) {
    final existingIndex = _indexOfLine(
      newLine.listingId,
      productVariantId: newLine.productVariantId,
    );
    if (existingIndex >= 0) {
      _lines[existingIndex].quantity += newLine.quantity;
      _lines[existingIndex].orderType = newLine.orderType;
      _lines[existingIndex].rentalDays =
          newLine.orderType == 'buy' ? 0 : newLine.rentalDays;
    } else {
      if (newLine.orderType == 'buy') {
        newLine.rentalDays = 0;
      }
      _lines.add(newLine);
    }
    _saveCart();
    notifyListeners();
    refreshStock();
  }

  void updateQuantity(String listingId, int qty, {String? productVariantId}) {
    if (qty < 1) return;
    final index = _indexOfLine(listingId, productVariantId: productVariantId);
    if (index >= 0) {
      _lines[index].quantity = qty;
      _saveCart();
      notifyListeners();
    }
  }

  void updateRentalDays(String listingId, int days, {String? productVariantId}) {
    if (days < 1) return;
    final index = _indexOfLine(listingId, productVariantId: productVariantId);
    if (index >= 0) {
      if (_lines[index].orderType == 'buy') return;
      _lines[index].rentalDays = days;
      _saveCart();
      notifyListeners();
    }
  }

  void updateOrderType(String listingId, String orderType, {String? productVariantId}) {
    final index = _indexOfLine(listingId, productVariantId: productVariantId);
    if (index >= 0) {
      _lines[index].orderType = orderType;
      if (orderType == 'buy') {
        _lines[index].rentalDays = 0;
      } else if (_lines[index].rentalDays <= 0) {
        _lines[index].rentalDays = 1;
      }
      _saveCart();
      notifyListeners();
    }
  }

  void removeLine(String listingId, {String? productVariantId}) {
    _lines.removeWhere(
      (line) =>
          line.listingId == listingId &&
          (line.productVariantId ?? '') == (productVariantId ?? ''),
    );
    _saveCart();
    notifyListeners();
    refreshStock();
  }

  void clearCart() {
    _lines.clear();
    _listingDetails.clear();
    _saveCart();
    notifyListeners();
  }
}
