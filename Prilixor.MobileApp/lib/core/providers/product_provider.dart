import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../api/api_client.dart';
import '../models/product_model.dart';
import '../models/category_model.dart';

class ProductProvider extends ChangeNotifier {
  final ApiClient _apiClient = ApiClient();

  List<ProductModel> _products = [];
  List<ProductModel> get products => _products;

  List<CategoryModel> _categories = [];
  List<CategoryModel> get categories => _categories;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _errorMessage;
  String? get errorMessage => _errorMessage;

  Future<void> fetchCategories() async {
    try {
      final response = await _apiClient.dio.get('/customers/catalog/categories');
      if (response.statusCode == 200) {
        final List<dynamic> data = response.data;
        _categories = data.map((json) => CategoryModel.fromJson(json)).toList();
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Error fetching categories: $e');
    }
  }

  Future<void> fetchProducts({String? categoryId, String? search}) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final Map<String, dynamic> queryParams = {};
      if (categoryId != null) queryParams['category'] = categoryId;
      if (search != null && search.isNotEmpty) queryParams['search'] = search;

      final response = await _apiClient.dio.get('/customers/catalog/listings', queryParameters: queryParams);
      if (response.statusCode == 200) {
        final List<dynamic> data = response.data;
        _products = data.map((json) => ProductModel.fromJson(json)).toList();
      }
    } on DioException catch (e) {
      _errorMessage = 'Failed to load products: ${e.message}';
    } catch (e) {
      _errorMessage = 'An unexpected error occurred.';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
