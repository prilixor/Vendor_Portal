import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../api/api_client.dart';
import '../models/order_model.dart';
import '../models/order_action_model.dart';

class OrderDetailProvider extends ChangeNotifier {
  final ApiClient _apiClient = ApiClient();

  OrderModel? _currentOrder;
  OrderModel? get currentOrder => _currentOrder;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _errorMessage;
  String? get errorMessage => _errorMessage;

  // Quotes
  ExtensionQuoteModel? _extensionQuote;
  ExtensionQuoteModel? get extensionQuote => _extensionQuote;

  BuyoutQuoteModel? _buyoutQuote;
  BuyoutQuoteModel? get buyoutQuote => _buyoutQuote;

  bool _isActionLoading = false;
  bool get isActionLoading => _isActionLoading;

  Future<void> fetchOrderDetail(String orderId) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _apiClient.dio.get('/customers/me/orders/$orderId');
      if (response.statusCode == 200) {
        _currentOrder = OrderModel.fromJson(response.data);
      }
    } on DioException catch (e) {
      _errorMessage = 'Failed to load order: ${e.message}';
    } catch (e) {
      _errorMessage = 'An unexpected error occurred.';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> cancelOrder(String orderId) async {
    _isActionLoading = true;
    notifyListeners();
    bool success = false;
    try {
      final response = await _apiClient.dio.patch('/customers/me/orders/$orderId/cancel');
      if (response.statusCode == 200) {
        success = true;
        await fetchOrderDetail(orderId);
      }
    } catch (e) {
      _errorMessage = 'Failed to cancel order.';
    } finally {
      _isActionLoading = false;
      notifyListeners();
    }
    return success;
  }

  Future<void> quoteExtension(String orderId, int days) async {
    _isActionLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _apiClient.dio.post(
        '/customers/me/orders/$orderId/extensions/quote',
        data: {'additionalDays': days},
      );
      if (response.statusCode == 200) {
        _extensionQuote = ExtensionQuoteModel.fromJson(response.data);
      }
    } catch (e) {
      _errorMessage = 'Failed to quote extension.';
      _extensionQuote = null;
    } finally {
      _isActionLoading = false;
      notifyListeners();
    }
  }

  Future<bool> processExtension(String orderId, int days) async {
    _isActionLoading = true;
    notifyListeners();
    bool success = false;
    try {
      final response = await _apiClient.dio.post(
        '/customers/me/orders/$orderId/extensions',
        data: {'additionalDays': days},
      );
      if (response.statusCode == 200 || response.statusCode == 204) {
        success = true;
        await fetchOrderDetail(orderId);
      }
    } catch (e) {
      _errorMessage = 'Failed to process extension.';
    } finally {
      _isActionLoading = false;
      _extensionQuote = null; // Clear quote
      notifyListeners();
    }
    return success;
  }

  Future<void> quoteBuyout(String orderId) async {
    _isActionLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _apiClient.dio.post('/customers/me/orders/$orderId/buyouts/quote', data: {});
      if (response.statusCode == 200) {
        _buyoutQuote = BuyoutQuoteModel.fromJson(response.data);
      }
    } catch (e) {
      _errorMessage = 'Failed to quote buyout.';
      _buyoutQuote = null;
    } finally {
      _isActionLoading = false;
      notifyListeners();
    }
  }

  Future<bool> processBuyout(String orderId) async {
    _isActionLoading = true;
    notifyListeners();
    bool success = false;
    try {
      final response = await _apiClient.dio.post('/customers/me/orders/$orderId/buyouts', data: {});
      if (response.statusCode == 200 || response.statusCode == 204) {
        success = true;
        await fetchOrderDetail(orderId);
      }
    } catch (e) {
      _errorMessage = 'Failed to process buyout.';
    } finally {
      _isActionLoading = false;
      _buyoutQuote = null; // Clear quote
      notifyListeners();
    }
    return success;
  }

  void clearQuotes() {
    _extensionQuote = null;
    _buyoutQuote = null;
    notifyListeners();
  }
}
