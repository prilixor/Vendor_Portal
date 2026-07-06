import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../api/api_client.dart';
import '../models/product_detail_model.dart';
import '../models/order_quote_model.dart';
import '../models/cart_model.dart';

class CheckoutProvider extends ChangeNotifier {
  final ApiClient _apiClient = ApiClient();

  ProductDetailModel? _productDetail;
  ProductDetailModel? get productDetail => _productDetail;

  OrderQuoteModel? _quote;
  OrderQuoteModel? get quote => _quote;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  bool _isPlacingOrder = false;
  bool get isPlacingOrder => _isPlacingOrder;

  String? _errorMessage;
  String? get errorMessage => _errorMessage;

  // Clear state when leaving screens
  void clearState() {
    _productDetail = null;
    _quote = null;
    _errorMessage = null;
    notifyListeners();
  }

  Future<void> fetchProductDetail(String listingId) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _apiClient.dio.get('/customers/catalog/listings/$listingId');
      if (response.statusCode == 200) {
        _productDetail = ProductDetailModel.fromJson(response.data);
      }
    } on DioException catch (e) {
      _errorMessage = 'Failed to load details: ${e.message}';
    } catch (e) {
      _errorMessage = 'An unexpected error occurred.';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> getQuote(List<CartLineModel> cartLines, {String? addressId}) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    if (addressId == null) {
      _isLoading = false;
      return;
    }

    try {
      final data = {
        "customerAddressId": addressId,
        "deliveryOption": "standard",
        "lines": cartLines.map((line) => {
          "listingId": line.listingId,
          "quantity": line.quantity,
          "rentalDays": line.rentalDays,
          "orderType": line.orderType
        }).toList()
      };
      
      final response = await _apiClient.dio.post('/customers/me/orders/quote', data: data);
      if (response.statusCode == 200) {
        _quote = OrderQuoteModel.fromJson(response.data);
      }
    } on DioException catch (e) {
      _errorMessage = 'Failed to get quote: ${e.response?.data?['detail'] ?? e.message}';
    } catch (e) {
      _errorMessage = 'An unexpected error occurred.';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> placeOrder(List<CartLineModel> cartLines, {String? addressId}) async {
    _isPlacingOrder = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final data = {
        if (addressId != null) "customerAddressId": addressId,
        "deliveryOption": "standard",
        "lines": cartLines.map((line) => {
          "listingId": line.listingId,
          "quantity": line.quantity,
          "rentalDays": line.rentalDays,
          "orderType": line.orderType
        }).toList()
      };
      
      final response = await _apiClient.dio.post('/customers/me/orders', data: data);
      if (response.statusCode == 200) {
        final resData = response.data;
        final placedOrders = resData['placedOrders'] as List<dynamic>? ?? [];
        final failedLines = resData['failedLines'] as List<dynamic>? ?? [];

        if (placedOrders.isNotEmpty) {
          return true;
        } else {
          _errorMessage = failedLines.isNotEmpty
              ? failedLines.map((e) => e['message']).join(", ")
              : 'Failed to place order. No items were placed.';
          return false;
        }
      }
      return false;
    } on DioException catch (e) {
      _errorMessage = 'Failed to place order: ${e.response?.data?['detail'] ?? e.message}';
      return false;
    } catch (e) {
      _errorMessage = 'An unexpected error occurred.';
      return false;
    } finally {
      _isPlacingOrder = false;
      notifyListeners();
    }
  }
}
