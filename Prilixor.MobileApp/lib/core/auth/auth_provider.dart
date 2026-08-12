import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:dio/dio.dart';
import 'package:jwt_decoder/jwt_decoder.dart';
import '../api/api_client.dart';

class AuthProvider extends ChangeNotifier {
  final ApiClient _apiClient = ApiClient();
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  bool _isAuthenticated = false;
  bool get isAuthenticated => _isAuthenticated;

  bool _isBootstrapping = true;
  bool get isBootstrapping => _isBootstrapping;

  String? _errorMessage;
  String? get errorMessage => _errorMessage;

  AuthProvider() {
    // When API refresh fails, clear local session so AuthGate shows Welcome/Login.
    _apiClient.onSessionExpired = () {
      _isAuthenticated = false;
      notifyListeners();
    };
  }

  /// Restore session from stored JWT (web-like stay logged in).
  /// If access token expired, tries refresh once.
  ///
  /// Bounded so a hung secure-storage / refresh call cannot leave AuthGate
  /// on BrandSplash forever (especially painful on Flutter web).
  Future<bool> tryRestoreSession() async {
    _isBootstrapping = true;
    notifyListeners();
    try {
      return await _restoreSessionBody().timeout(
        const Duration(seconds: 8),
        onTimeout: () {
          _isAuthenticated = false;
          return false;
        },
      );
    } catch (_) {
      _isAuthenticated = false;
      return false;
    } finally {
      _isBootstrapping = false;
      notifyListeners();
    }
  }

  Future<bool> _restoreSessionBody() async {
    final token = await _storage.read(key: 'jwt_token');
    if (token == null || token.trim().isEmpty) {
      _isAuthenticated = false;
      return false;
    }

    // Token still valid — keep session.
    if (!JwtDecoder.isExpired(token)) {
      _isAuthenticated = true;
      return true;
    }

    // Access token expired — try refresh before forcing login.
    final refresh = await _storage.read(key: 'refresh_token');
    if (refresh == null || refresh.trim().isEmpty) {
      await logout();
      return false;
    }

    try {
      final refreshDio = Dio(
        BaseOptions(
          baseUrl: _apiClient.baseUrl,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          connectTimeout: const Duration(seconds: 6),
          receiveTimeout: const Duration(seconds: 6),
        ),
      );
      final response = await refreshDio.post(
        '/auth/refresh',
        data: {
          'token': token,
          'refreshToken': refresh,
        },
      );
      if (response.statusCode == 200 && response.data is Map) {
        final data = Map<String, dynamic>.from(response.data as Map);
        final newToken = data['token']?.toString();
        final newRefresh = data['refreshToken']?.toString();
        if (newToken != null && newToken.isNotEmpty) {
          await _storage.write(key: 'jwt_token', value: newToken);
          if (newRefresh != null && newRefresh.isNotEmpty) {
            await _storage.write(key: 'refresh_token', value: newRefresh);
          }
          _isAuthenticated = true;
          return true;
        }
      }
    } catch (_) {
      // Fall through to logout.
    }

    await logout();
    return false;
  }

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
        final token = data['token'];
        final refreshToken = data['refreshToken'];

        await _storage.write(key: 'jwt_token', value: token);
        if (refreshToken != null) {
          await _storage.write(key: 'refresh_token', value: refreshToken);
        }

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
    } catch (_) {
      _errorMessage = 'An unexpected error occurred.';
    }

    _isLoading = false;
    notifyListeners();
    return false;
  }

  Future<void> logout() async {
    await _storage.delete(key: 'jwt_token');
    await _storage.delete(key: 'refresh_token');
    // Re-prompt location on next login if they still have no delivery address.
    await _storage.delete(key: 'locationPromptDismissed');
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
          if (phone != null && phone.isNotEmpty) 'phone': phone,
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
    } catch (_) {
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
    } catch (_) {
      _errorMessage = 'An unexpected error occurred.';
    }

    _isLoading = false;
    notifyListeners();
    return false;
  }

  Future<bool> verifyEmail(String token) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      final response = await _apiClient.dio.get(
        '/auth/verify-email',
        queryParameters: {'token': token},
      );
      if (response.statusCode == 200) {
        _isLoading = false;
        notifyListeners();
        return true;
      }
    } on DioException catch (e) {
      _errorMessage = e.response?.data?['detail']?.toString() ??
          e.response?.data?['message']?.toString() ??
          'Email verification failed.';
    } catch (_) {
      _errorMessage = 'Email verification failed.';
    }
    _isLoading = false;
    notifyListeners();
    return false;
  }

  Future<bool> resendVerification(String email) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      final response = await _apiClient.dio.post(
        '/auth/resend-verification',
        data: {'email': email},
      );
      if (response.statusCode == 200) {
        _isLoading = false;
        notifyListeners();
        return true;
      }
    } on DioException catch (e) {
      _errorMessage = e.response?.data?['detail']?.toString() ??
          e.response?.data?['message']?.toString() ??
          'Failed to resend verification email.';
    } catch (_) {
      _errorMessage = 'Failed to resend verification email.';
    }
    _isLoading = false;
    notifyListeners();
    return false;
  }

  Future<bool> resetPassword({
    required String token,
    required String newPassword,
    required String confirmPassword,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      final response = await _apiClient.dio.post(
        '/auth/reset-password',
        data: {
          'token': token,
          'newPassword': newPassword,
          'confirmPassword': confirmPassword,
        },
      );
      if (response.statusCode == 200) {
        _isLoading = false;
        notifyListeners();
        return true;
      }
    } on DioException catch (e) {
      _errorMessage = e.response?.data?['detail']?.toString() ??
          e.response?.data?['message']?.toString() ??
          'Failed to reset password.';
    } catch (_) {
      _errorMessage = 'Failed to reset password.';
    }
    _isLoading = false;
    notifyListeners();
    return false;
  }

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
    } catch (_) {
      _errorMessage = 'An unexpected error occurred.';
    }

    _isLoading = false;
    notifyListeners();
    return false;
  }
}
