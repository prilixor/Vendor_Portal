import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../api/api_client.dart';
import '../models/order_model.dart';
import '../models/expiring_order_model.dart';

class OrderProvider extends ChangeNotifier {
  final ApiClient _apiClient = ApiClient();

  List<OrderModel> _orders = [];
  List<OrderModel> get orders => _orders;

  List<ExpiringOrderModel> _expirations = [];
  List<ExpiringOrderModel> get expirations => _expirations;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  bool _isLoadingExpirations = false;
  bool get isLoadingExpirations => _isLoadingExpirations;

  String? _errorMessage;
  String? get errorMessage => _errorMessage;

  String? _expirationsError;
  String? get expirationsError => _expirationsError;

  DateTime? _lastFetchedAt;
  DateTime? get lastFetchedAt => _lastFetchedAt;

  int get activeRentalsCount => _orders.where((o) => o.status.toLowerCase() == 'active').length;
  double get activeRentalsTotal =>
      _orders.where((o) => o.status.toLowerCase() == 'active').fold(0, (sum, item) => sum + item.totalAmount);

  int get upcomingDeliveriesCount => _orders.where((o) {
        final s = o.status.toLowerCase();
        return s == 'confirmed' || s == 'in transit' || s == 'pending' || s == 'awaiting vendor acceptance';
      }).length;

  Future<void> fetchOrders({bool silent = false}) async {
    final showLoading = !silent || _orders.isEmpty;
    if (showLoading) {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();
    }

    try {
      final response = await _apiClient.dio.get(
        '/customers/me/orders',
        queryParameters: {'_': DateTime.now().millisecondsSinceEpoch},
        options: Options(
          headers: const {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
        ),
      );
      if (response.statusCode == 200) {
        final List<dynamic> data = response.data is List ? response.data as List : const [];
        _orders = data.map((json) => OrderModel.fromJson(json as Map<String, dynamic>)).toList();
        _lastFetchedAt = DateTime.now();
        _errorMessage = null;
      }
    } on DioException catch (e) {
      if (_orders.isEmpty) {
        if (e.response?.statusCode == 401) {
          _errorMessage = 'auth_required';
        } else {
          _errorMessage = 'Failed to load orders. Please try again.';
        }
      }
    } catch (_) {
      if (_orders.isEmpty) {
        _errorMessage = 'An unexpected error occurred.';
      }
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchExpirations({int withinDays = 30, bool silent = false}) async {
    final showLoading = !silent || _expirations.isEmpty;
    if (showLoading) {
      _isLoadingExpirations = true;
      _expirationsError = null;
      notifyListeners();
    }

    try {
      final response = await _apiClient.dio.get(
        '/customers/me/orders/expirations',
        queryParameters: {
          'withinDays': withinDays,
          '_': DateTime.now().millisecondsSinceEpoch,
        },
        options: Options(
          headers: const {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
        ),
      );
      if (response.statusCode == 200) {
        final List<dynamic> data = response.data is List ? response.data as List : const [];
        _expirations = data.map((json) => ExpiringOrderModel.fromJson(json as Map<String, dynamic>)).toList();
        _expirationsError = null;
      }
    } on DioException catch (e) {
      if (_expirations.isEmpty) {
        _expirationsError = 'Failed to load expirations: ${e.message}';
      }
    } catch (e) {
      if (_expirations.isEmpty) {
        _expirationsError = 'An unexpected error occurred.';
      }
    } finally {
      _isLoadingExpirations = false;
      notifyListeners();
    }
  }
}
