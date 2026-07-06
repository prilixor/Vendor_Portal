import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../api/api_client.dart';
import 'package:dio/dio.dart';

class AuthProvider extends ChangeNotifier {
  final ApiClient _apiClient = ApiClient();
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  bool _isAuthenticated = false;
  bool get isAuthenticated => _isAuthenticated;

  String? _errorMessage;
  String? get errorMessage => _errorMessage;

  // Login Method
  Future<bool> login(String email, String password) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _apiClient.dio.post(
        '/auth/login',
        data: {
          'email': email,
          'password': password,
          'role': 'customer',
        },
      );

      if (response.statusCode == 200) {
        final data = response.data;
        
        // Ensure properties match your .NET LoginResponse class
        final token = data['token'];
        final refreshToken = data['refreshToken'];

        // Securely store both tokens on the device
        await _storage.write(key: 'jwt_token', value: token);
        await _storage.write(key: 'refresh_token', value: refreshToken);

        _isAuthenticated = true;
        _isLoading = false;
        notifyListeners();
        return true;
      }
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        _errorMessage = 'Invalid email or password';
      } else if (e.response?.statusCode == 400) {
        final data = e.response?.data;
        if (data is Map<String, dynamic>) {
          _errorMessage = data['detail'] ?? data['message'] ?? 'Bad Request';
        } else {
          _errorMessage = 'Bad Request';
        }
      } else {
        _errorMessage = 'An error occurred: ${e.message}';
      }
    } catch (e) {
      _errorMessage = 'An unexpected error occurred.';
    }

    _isLoading = false;
    notifyListeners();
    return false;
  }

  // Logout Method
  Future<void> logout() async {
    await _storage.delete(key: 'jwt_token');
    await _storage.delete(key: 'refresh_token');
    _isAuthenticated = false;
    notifyListeners();
  }

  Future<bool> registerCustomer(String email, String password, String fullName, String? phone) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _apiClient.dio.post(
        '/customers/register',
        data: {
          'email': email,
          'password': password,
          'fullName': fullName,
          if (phone != null && phone.isNotEmpty) 'phoneNumber': phone,
        },
      );
      if (response.statusCode == 200 || response.statusCode == 201) {
        _isLoading = false;
        notifyListeners();
        return true;
      }
    } on DioException catch (e) {
      if (e.response?.statusCode == 400 || e.response?.statusCode == 409) {
        _errorMessage = e.response?.data?['message'] ?? 'Registration failed. Email might already exist.';
      } else {
        _errorMessage = 'An error occurred: ${e.message}';
      }
    } catch (e) {
      _errorMessage = 'An unexpected error occurred.';
    }

    _isLoading = false;
    notifyListeners();
    return false;
  }

  Future<bool> forgotPassword(String email) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _apiClient.dio.post(
        '/auth/forgot-password',
        data: {
          'email': email,
        },
      );
      if (response.statusCode == 200) {
        _isLoading = false;
        notifyListeners();
        return true;
      }
    } on DioException catch (e) {
      _errorMessage = e.response?.data?['message'] ?? 'Failed to request password reset.';
    } catch (e) {
      _errorMessage = 'An unexpected error occurred.';
    }

    _isLoading = false;
    notifyListeners();
    return false;
  }

  // Change Password Method
  Future<bool> changePassword(String email, String currentPassword, String newPassword) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _apiClient.dio.post(
        '/auth/change-password',
        data: {
          'email': email,
          'currentPassword': currentPassword,
          'newPassword': newPassword,
        },
      );
      if (response.statusCode == 200) {
        _isLoading = false;
        notifyListeners();
        return true;
      }
    } on DioException catch (e) {
      _errorMessage = e.response?.data?['message'] ?? 'Failed to change password.';
    } catch (e) {
      _errorMessage = 'An unexpected error occurred.';
    }

    _isLoading = false;
    notifyListeners();
    return false;
  }
}
