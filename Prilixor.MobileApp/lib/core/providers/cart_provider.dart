import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../api/api_client.dart';
import '../models/cart_model.dart';
import '../models/product_detail_model.dart';
import '../models/rental_pricing_plan_model.dart';
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
        final detail = _listingDetails[line.listingId];
        if (detail != null && detail.listingStatus.toLowerCase() != 'active' && detail.listingStatus.toLowerCase() != 'approved') {
          return true;
        }
        final avail = availableQuantityFor(line);
        return avail != null && (avail <= 0 || line.quantity > avail);
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
          } else {
            _markListingInactive(id);
          }
        } catch (_) {
          _markListingInactive(id);
        }
      }
      // Drop details for listings no longer in cart.
      _listingDetails.removeWhere((id, _) => !ids.contains(id));

      // Hydrate thumbnails + chemical/rent flags from live listing details.
      var hydrated = false;
      for (final line in _lines) {
        final detail = _listingDetails[line.listingId];
        if (detail == null) continue;

        if (line.primaryImageUrl == null || line.primaryImageUrl!.trim().isEmpty) {
          final url = resolveItemImageUrl(
            primaryImageUrl: detail.primaryImageUrl,
            imageUrls: detail.imageUrls,
          );
          if (url != null) {
            line.primaryImageUrl = url;
            hydrated = true;
          }
        }

        final nextChemical = detail.isChemical;
        final nextRent = detail.isRentEnabled;
        final nextBuy = detail.isBuyEnabled;
        if (line.isChemical != nextChemical ||
            line.isRentEnabled != nextRent ||
            line.isBuyEnabled != nextBuy) {
          line.isChemical = nextChemical;
          line.isRentEnabled = nextRent;
          line.isBuyEnabled = nextBuy;
          hydrated = true;
        }

        // Chemicals / buy-only listings must stay on buy in the cart.
        if (!line.canRent && line.orderType == 'rent') {
          line.orderType = 'buy';
          line.rentalDays = 0;
          line.rentalPeriodUnit = 'day';
          line.clearPricingPlan();
          hydrated = true;
        }

        // Restore catalog plan snapshot if Buy/Rent toggle or old carts cleared it.
        if (line.orderType == 'rent' &&
            line.canRent &&
            !line.usesPricingPlan &&
            detail.hasActiveRentalPlans) {
          RentalPricingPlanModel? matched;
          for (final p in detail.activeRentalPlans) {
            if (p.durationDays == line.rentalDays ||
                p.durationDays == (line.rentalDurationDays ?? -1)) {
              matched = p;
              break;
            }
          }
          final chosen = matched ?? detail.defaultRentalPlan;
          if (chosen != null) {
            line.applyPricingPlan(
              planId: chosen.id,
              durationLabel: chosen.durationLabel,
              durationDays: chosen.durationDays,
              normalPrice: chosen.normalPrice,
              discountType: chosen.discountType,
              discountValue: chosen.discountValue,
              finalPrice: chosen.finalRentalPrice,
            );
            hydrated = true;
          }
        }
      }
      if (hydrated) _saveCart();
    } finally {
      _isRefreshingStock = false;
      notifyListeners();
    }
  }

  void _markListingInactive(String id) {
    _listingDetails[id] = ProductDetailModel(
      id: id,
      title: '',
      vendorName: '',
      vendorRating: 0,
      serviceAreaHint: '',
      categoryName: '',
      dailyRent: 0,
      weeklyRent: 0,
      monthlyRent: 0,
      securityDeposit: 0,
      prescriptionRequired: false,
      depositRequired: false,
      listingStatus: 'inactive',
      availableQuantity: 0,
      availabilityStatus: 'out_of_stock',
      description: '',
      imageUrls: [],
    );
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
      _lines[existingIndex].isChemical = newLine.isChemical;
      _lines[existingIndex].isRentEnabled = newLine.isRentEnabled;
      _lines[existingIndex].isBuyEnabled = newLine.isBuyEnabled;
      final nextType = newLine.isChemical || !newLine.canRent ? 'buy' : newLine.orderType;
      _lines[existingIndex].orderType = nextType;
      _lines[existingIndex].rentalDays = nextType == 'buy' ? 0 : newLine.rentalDays;
      _lines[existingIndex].rentalPeriodUnit =
          nextType == 'buy' ? 'day' : newLine.rentalPeriodUnit;
      if (nextType == 'buy') {
        _lines[existingIndex].clearPricingPlan();
      } else if (newLine.usesPricingPlan) {
        _lines[existingIndex].applyPricingPlan(
          planId: newLine.rentalPricingPlanId!,
          durationLabel: newLine.rentalDurationLabel ?? '',
          durationDays: newLine.rentalDurationDays ?? newLine.rentalDays,
          normalPrice: newLine.rentalNormalPrice ?? 0,
          discountType: newLine.rentalDiscountType ?? 'none',
          discountValue: newLine.rentalDiscountValue ?? 0,
          finalPrice: newLine.rentalFinalPrice ?? 0,
        );
      } else {
        _lines[existingIndex].clearPricingPlan();
      }
    } else {
      if (newLine.isChemical || !newLine.canRent || newLine.orderType == 'buy') {
        newLine.orderType = 'buy';
        newLine.rentalDays = 0;
        newLine.rentalPeriodUnit = 'day';
        newLine.clearPricingPlan();
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
      if (_lines[index].usesPricingPlan) return; // plan days are fixed
      _lines[index].rentalDays = days;
      _saveCart();
      notifyListeners();
    }
  }

  void updateRentalPeriodUnit(String listingId, String unit, {String? productVariantId}) {
    final index = _indexOfLine(listingId, productVariantId: productVariantId);
    if (index >= 0) {
      if (_lines[index].orderType == 'buy') return;
      if (_lines[index].usesPricingPlan) return;
      _lines[index].rentalPeriodUnit = unit;
      if (_lines[index].rentalDays < 1) _lines[index].rentalDays = 1;
      _saveCart();
      notifyListeners();
    }
  }

  void updateOrderType(String listingId, String orderType, {String? productVariantId}) {
    final index = _indexOfLine(listingId, productVariantId: productVariantId);
    if (index >= 0) {
      final line = _lines[index];
      // Never allow rent on chemicals / buy-only listings.
      final nextType = !line.canRent ? 'buy' : (!line.canBuy ? 'rent' : orderType);
      line.orderType = nextType;
      if (nextType == 'buy') {
        // Keep catalog plan snapshot (web CartContext) so Rent can restore it.
        line.rentalDays = 0;
      } else if (line.rentalPricingPlanId != null &&
          line.rentalPricingPlanId!.isNotEmpty &&
          (line.rentalDurationDays ?? 0) > 0) {
        line.rentalDays = line.rentalDurationDays!;
        line.rentalPeriodUnit = 'day';
      } else if (line.rentalDays <= 0) {
        line.rentalDays = 1;
        line.rentalPeriodUnit = 'day';
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
