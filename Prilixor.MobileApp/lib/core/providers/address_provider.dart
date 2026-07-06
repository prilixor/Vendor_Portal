import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../api/api_client.dart';
import '../models/address_model.dart';

class AddressProvider extends ChangeNotifier {
  final ApiClient _apiClient = ApiClient();

  List<AddressModel> _addresses = [];
  bool _isLoading = false;
  String? _errorMessage;

  List<AddressModel> get addresses => _addresses;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> fetchAddresses() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _apiClient.dio.get('/customers/me/addresses');
      if (response.statusCode == 200) {
        final List<dynamic> data = response.data;
        _addresses = data.map((json) => AddressModel.fromJson(json)).toList();
      }
    } on DioException catch (e) {
      _errorMessage = 'Failed to load addresses: ${e.message}';
    } catch (e) {
      _errorMessage = 'An unexpected error occurred.';
    }

    _isLoading = false;
    notifyListeners();
  }

  Future<bool> addAddress({
    required String line1,
    required String city,
    required String state,
    required String postal,
    String? label,
    double? latitude,
    double? longitude,
    bool setAsDefault = false,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _apiClient.dio.post(
        '/customers/me/addresses',
        data: {
          'line1': line1,
          'city': city,
          'state': state,
          'postal': postal,
          'label': label,
          'latitude': latitude,
          'longitude': longitude,
          'setAsDefault': setAsDefault,
        },
        options: Options(contentType: Headers.jsonContentType),
      );
      if (response.statusCode == 200 || response.statusCode == 201) {
        await fetchAddresses();
        return true;
      }
    } on DioException catch (e) {
      _errorMessage = e.response?.data?['detail'] ?? 'Failed to add address.';
    } catch (e) {
      _errorMessage = 'An unexpected error occurred.';
    }

    _isLoading = false;
    notifyListeners();
    return false;
  }

  Future<bool> updateAddress(String addressId, {
    required String line1,
    required String city,
    required String state,
    required String postal,
    String? label,
    double? latitude,
    double? longitude,
    bool setAsDefault = false,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _apiClient.dio.put(
        '/customers/me/addresses/$addressId',
        data: {
          'addressId': addressId,
          'line1': line1,
          'city': city,
          'state': state,
          'postal': postal,
          'label': label,
          'latitude': latitude,
          'longitude': longitude,
          'setAsDefault': setAsDefault,
        },
        options: Options(contentType: Headers.jsonContentType),
      );
      if (response.statusCode == 200) {
        await fetchAddresses();
        return true;
      }
    } on DioException catch (e) {
      _errorMessage = e.response?.data?['detail'] ?? 'Failed to update address.';
    } catch (e) {
      _errorMessage = 'An unexpected error occurred.';
    }

    _isLoading = false;
    notifyListeners();
    return false;
  }

  Future<bool> deleteAddress(String addressId) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _apiClient.dio.delete('/customers/me/addresses/$addressId');
      if (response.statusCode == 200) {
        _addresses.removeWhere((a) => a.id == addressId);
        _isLoading = false;
        notifyListeners();
        return true;
      }
    } on DioException catch (e) {
      _errorMessage = e.response?.data?['detail'] ?? 'Failed to delete address.';
    } catch (e) {
      _errorMessage = 'An unexpected error occurred.';
    }

    _isLoading = false;
    notifyListeners();
    return false;
  }
}
