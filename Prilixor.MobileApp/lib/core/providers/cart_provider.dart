import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/cart_model.dart';

class CartProvider extends ChangeNotifier {
  final List<CartLineModel> _lines = [];
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  static const String _cartKey = 'saved_cart';

  CartProvider() {
    _loadCart();
  }

  Future<void> _loadCart() async {
    final cartStr = await _storage.read(key: _cartKey);
    if (cartStr != null) {
      final List<dynamic> jsonList = jsonDecode(cartStr);
      _lines.addAll(jsonList.map((json) => CartLineModel.fromJson(json)).toList());
      notifyListeners();
    }
  }

  Future<void> _saveCart() async {
    final cartStr = jsonEncode(_lines.map((line) => line.toJson()).toList());
    await _storage.write(key: _cartKey, value: cartStr);
  }

  List<CartLineModel> get lines => _lines;

  int get itemCount => _lines.fold(0, (sum, line) => sum + line.quantity);

  double get totalEstimatedRent => _lines.fold(0.0, (sum, line) => sum + line.lineTotal);

  void addLine(CartLineModel newLine) {
    final existingIndex = _lines.indexWhere((line) => line.listingId == newLine.listingId);
    if (existingIndex >= 0) {
      _lines[existingIndex].quantity += newLine.quantity;
      if (newLine.orderType != _lines[existingIndex].orderType) {
        _lines[existingIndex].orderType = newLine.orderType;
      }
      if (newLine.rentalDays != _lines[existingIndex].rentalDays) {
        _lines[existingIndex].rentalDays = newLine.rentalDays;
      }
    } else {
      _lines.add(newLine);
    }
    _saveCart();
    notifyListeners();
  }

  void updateQuantity(String listingId, int qty) {
    if (qty < 1) return;
    final index = _lines.indexWhere((line) => line.listingId == listingId);
    if (index >= 0) {
      _lines[index].quantity = qty;
      _saveCart();
      notifyListeners();
    }
  }

  void updateRentalDays(String listingId, int days) {
    if (days < 1) return;
    final index = _lines.indexWhere((line) => line.listingId == listingId);
    if (index >= 0) {
      _lines[index].rentalDays = days;
      _saveCart();
      notifyListeners();
    }
  }

  void updateOrderType(String listingId, String orderType) {
    final index = _lines.indexWhere((line) => line.listingId == listingId);
    if (index >= 0) {
      _lines[index].orderType = orderType;
      _saveCart();
      notifyListeners();
    }
  }

  void removeLine(String listingId) {
    _lines.removeWhere((line) => line.listingId == listingId);
    _saveCart();
    notifyListeners();
  }

  void clearCart() {
    _lines.clear();
    _saveCart();
    notifyListeners();
  }
}
