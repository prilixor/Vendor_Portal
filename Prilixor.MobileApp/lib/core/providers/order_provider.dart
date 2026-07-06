import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../api/api_client.dart';
import '../models/order_model.dart';

class OrderProvider extends ChangeNotifier {
  final ApiClient _apiClient = ApiClient();

  List<OrderModel> _orders = [];
  List<OrderModel> get orders => _orders;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _errorMessage;
  String? get errorMessage => _errorMessage;

  // Stats computation
  int get activeRentalsCount => _orders.where((o) => o.status.toLowerCase() == 'active').length;
  double get activeRentalsTotal => _orders.where((o) => o.status.toLowerCase() == 'active').fold(0, (sum, item) => sum + item.totalAmount);
  
  int get upcomingDeliveriesCount => _orders.where((o) {
        final s = o.status.toLowerCase();
        return s == 'confirmed' || s == 'in transit' || s == 'pending';
      }).length;

  Future<void> fetchOrders() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _apiClient.dio.get('/customers/me/orders');
      if (response.statusCode == 200) {
        final List<dynamic> data = response.data;
        _orders = data.map((json) => OrderModel.fromJson(json)).toList();
      }
    } on DioException catch (e) {
      _errorMessage = 'Failed to load orders: ${e.message}';
    } catch (e) {
      _errorMessage = 'An unexpected error occurred.';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
