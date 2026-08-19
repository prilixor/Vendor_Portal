import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../api/api_client.dart';
import '../models/profile_model.dart';

class ProfileProvider extends ChangeNotifier {
  final ApiClient _apiClient = ApiClient();

  ProfileModel? _profile;
  ProfileModel? get profile => _profile;

  List<AddressModel> _addresses = [];
  List<AddressModel> get addresses => _addresses;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _errorMessage;
  String? get errorMessage => _errorMessage;

  Future<void> fetchProfile() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _apiClient.dio.get('/customers/me/profile');
      if (response.statusCode == 200 && response.data is Map) {
        _profile = ProfileModel.fromJson(Map<String, dynamic>.from(response.data as Map));
      }
    } on DioException catch (e) {
      if (e.response?.statusCode == 401 || e.response?.statusCode == 403) {
        _profile = null;
        _errorMessage = 'auth_required';
      } else {
        _errorMessage = 'Failed to load profile. Please try again.';
      }
    } catch (_) {
      _errorMessage = 'An unexpected error occurred.';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void clearProfile() {
    _profile = null;
    _errorMessage = null;
    notifyListeners();
  }

  Future<bool> updateProfile(String name, String phone, {String? email}) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    bool success = false;
    try {
      final payload = <String, dynamic>{
        'fullName': name.trim(),
        'phone': phone.trim().isEmpty ? null : phone.trim(),
      };
      if (email != null && email.trim().isNotEmpty) {
        payload['email'] = email.trim();
      }
      final response = await _apiClient.dio.put(
        '/customers/me/profile',
        data: payload,
      );
      if (response.statusCode == 200 || response.statusCode == 204) {
        success = true;
        if (response.data is Map) {
          _profile = ProfileModel.fromJson(Map<String, dynamic>.from(response.data as Map));
        } else {
          await fetchProfile();
        }
      }
    } on DioException catch (e) {
      _errorMessage = e.response?.data?['detail']?.toString() ??
          e.response?.data?['title']?.toString() ??
          'Failed to update profile.';
    } catch (e) {
      _errorMessage = 'Failed to update profile.';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
    return success;
  }

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
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> addAddress(AddressModel address) async {
    _isLoading = true;
    notifyListeners();
    bool success = false;
    try {
      final response = await _apiClient.dio.post(
        '/customers/me/addresses',
        data: address.toJson(),
      );
      if (response.statusCode == 200 || response.statusCode == 201) {
        success = true;
        await fetchAddresses();
      }
    } catch (e) {
      _errorMessage = 'Failed to add address.';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
    return success;
  }

  Future<bool> deleteAddress(String id) async {
    _isLoading = true;
    notifyListeners();
    bool success = false;
    try {
      final response = await _apiClient.dio.delete('/customers/me/addresses/$id');
      if (response.statusCode == 200 || response.statusCode == 204) {
        success = true;
        await fetchAddresses();
      }
    } catch (e) {
      _errorMessage = 'Failed to delete address.';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
    return success;
  }
}
