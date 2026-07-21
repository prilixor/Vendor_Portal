import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:jwt_decoder/jwt_decoder.dart';

import '../api/api_client.dart';
import '../storage/secure_storage.dart';

class AuthProvider extends ChangeNotifier {
  final ApiClient _apiClient = ApiClient();
  final FlutterSecureStorage _storage = appSecureStorage;

  static const _kVendorId = 'vendor_id';
  static const _kVendorEmail = 'vendor_email';
  static const _kVendorName = 'vendor_name';

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  bool _isAuthenticated = false;
  bool get isAuthenticated => _isAuthenticated;

  bool _isBootstrapping = true;
  bool get isBootstrapping => _isBootstrapping;

  String? _errorMessage;
  String? get errorMessage => _errorMessage;

  String? _vendorId;
  String? get vendorId => _vendorId;

  String? _email;
  String? get email => _email;

  String? _displayName;
  String? get displayName => _displayName;

  AuthProvider() {
    _apiClient.onSessionExpired = () {
      _isAuthenticated = false;
      _vendorId = null;
      _email = null;
      _displayName = null;
      notifyListeners();
    };
  }

  /// Ends splash/bootstrap even if secure-storage/network hangs.
  /// Keeps any session already restored; only clears auth when nothing was set.
  Future<void> forceEndBootstrap({bool clearAuth = true}) async {
    if (!_isBootstrapping) return;
    _isBootstrapping = false;
    if (clearAuth && !_isAuthenticated) {
      _isAuthenticated = false;
    }
    notifyListeners();
  }

  /// Restore session from stored JWT (same pattern as Customer app).
  Future<bool> tryRestoreSession() async {
    _isBootstrapping = true;
    notifyListeners();
    try {
      final token = await _storage.read(key: 'jwt_token').timeout(
            const Duration(seconds: 4),
            onTimeout: () => null,
          );
      if (token == null || token.trim().isEmpty) {
        _isAuthenticated = false;
        return false;
      }

      if (!JwtDecoder.isExpired(token)) {
        await _hydrateUserFromStorageOrJwt(token);
        _isAuthenticated = true;
        return true;
      }

      final refresh = await _storage.read(key: 'refresh_token').timeout(
            const Duration(seconds: 4),
            onTimeout: () => null,
          );
      if (refresh == null || refresh.trim().isEmpty) {
        await logout();
        return false;
      }

      try {
        final refreshDio = Dio(
          BaseOptions(
            baseUrl: _apiClient.baseUrl,
            connectTimeout: const Duration(seconds: 8),
            receiveTimeout: const Duration(seconds: 8),
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
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
            await _hydrateUserFromStorageOrJwt(newToken);
            _isAuthenticated = true;
            return true;
          }
        }
      } catch (_) {
        // Fall through to logout.
      }

      await logout();
      return false;
    } catch (_) {
      _isAuthenticated = false;
      return false;
    } finally {
      _isBootstrapping = false;
      notifyListeners();
    }
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
          'role': 'vendor',
        },
      );

      if (response.statusCode == 200) {
        final data = Map<String, dynamic>.from(response.data as Map);
        final token = data['token']?.toString();
        final refreshToken = data['refreshToken']?.toString();
        final user = data['user'] is Map
            ? Map<String, dynamic>.from(data['user'] as Map)
            : null;

        if (token == null || token.isEmpty) {
          _errorMessage = 'Login succeeded but no token was returned.';
          _isLoading = false;
          notifyListeners();
          return false;
        }

        await _storage.write(key: 'jwt_token', value: token);
        if (refreshToken != null && refreshToken.isNotEmpty) {
          await _storage.write(key: 'refresh_token', value: refreshToken);
        }

        final id = user?['id']?.toString();
        final userEmail = user?['email']?.toString();
        final name = user?['name']?.toString();
        await _persistUser(id: id, email: userEmail, name: name);
        if (_vendorId == null || _vendorId!.isEmpty) {
          await _hydrateUserFromStorageOrJwt(token);
        }

        _isAuthenticated = true;
        _isLoading = false;
        notifyListeners();
        return true;
      }
    } on DioException catch (e) {
      final status = e.response?.statusCode;
      final data = e.response?.data;
      final detail = data is Map
          ? (data['detail'] ?? data['message'] ?? data['title'])?.toString()
          : null;

      if (e.type == DioExceptionType.connectionError ||
          e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.unknown) {
        _errorMessage =
            'Cannot reach API (${_apiClient.baseUrl}). Use the live AWS URL or start local API.';
      } else if (status == 401) {
        _errorMessage = detail ?? 'Invalid email or password';
      } else if (status == 403) {
        _errorMessage =
            detail ?? 'Please verify your email before logging in.';
      } else if (status == 400) {
        _errorMessage = detail ?? 'Bad Request';
      } else {
        _errorMessage = detail ?? 'An error occurred: ${e.message}';
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
    await _storage.delete(key: _kVendorId);
    await _storage.delete(key: _kVendorEmail);
    await _storage.delete(key: _kVendorName);
    _vendorId = null;
    _email = null;
    _displayName = null;
    _isAuthenticated = false;
    notifyListeners();
  }

  Future<bool> registerVendor({
    required String email,
    required String password,
    required String supportPhone,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _apiClient.dio.post(
        '/vendors/register',
        data: {
          'email': email.trim(),
          'password': password,
          'supportPhone': supportPhone.trim(),
        },
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        _isLoading = false;
        notifyListeners();
        return true;
      }
    } on DioException catch (e) {
      _errorMessage = _extractApiMessage(
        e,
        fallback: 'Registration failed.',
      );
      final lower = _errorMessage!.toLowerCase();
      if (lower.contains('already exists') ||
          lower.contains('in use') ||
          lower.contains('taken')) {
        _errorMessage =
            'Registration failed. If an account with this email or phone number exists, please try logging in.';
      }
    } catch (_) {
      _errorMessage = 'An unexpected error occurred.';
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
        data: {'email': email.trim()},
      );
      if (response.statusCode == 200) {
        _isLoading = false;
        notifyListeners();
        return true;
      }
    } on DioException catch (e) {
      _errorMessage = _extractApiMessage(
        e,
        fallback: 'Failed to resend verification email.',
      );
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
        data: {'email': email},
      );
      if (response.statusCode == 200) {
        _isLoading = false;
        notifyListeners();
        return true;
      }
    } on DioException catch (e) {
      _errorMessage = _extractApiMessage(
        e,
        fallback: 'Failed to request password reset.',
      );
    } catch (_) {
      _errorMessage = 'An unexpected error occurred.';
    }

    _isLoading = false;
    notifyListeners();
    return false;
  }

  Future<bool> changePassword(
    String email,
    String currentPassword,
    String newPassword,
  ) async {
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
      final data = e.response?.data;
      _errorMessage = data is Map
          ? (data['message'] ?? data['detail'])?.toString() ??
              'Failed to change password.'
          : 'Failed to change password.';
    } catch (_) {
      _errorMessage = 'An unexpected error occurred.';
    }

    _isLoading = false;
    notifyListeners();
    return false;
  }

  Future<void> _persistUser({
    String? id,
    String? email,
    String? name,
  }) async {
    if (id != null && id.isNotEmpty) {
      _vendorId = id;
      await _storage.write(key: _kVendorId, value: id);
    }
    if (email != null && email.isNotEmpty) {
      _email = email;
      await _storage.write(key: _kVendorEmail, value: email);
    }
    if (name != null && name.isNotEmpty) {
      _displayName = name;
      await _storage.write(key: _kVendorName, value: name);
    }
  }

  Future<void> _hydrateUserFromStorageOrJwt(String token) async {
    _vendorId = await _storage.read(key: _kVendorId);
    _email = await _storage.read(key: _kVendorEmail);
    _displayName = await _storage.read(key: _kVendorName);

    try {
      final decoded = JwtDecoder.decode(token);
      // ASP.NET ClaimTypes.NameIdentifier / Email / Role claim URIs.
      final id = _firstClaim(decoded, const [
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
        'nameid',
        'sub',
      ]);
      final email = _firstClaim(decoded, const [
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
        'email',
      ]);
      if ((_vendorId == null || _vendorId!.isEmpty) &&
          id != null &&
          id.isNotEmpty) {
        _vendorId = id;
        await _storage.write(key: _kVendorId, value: id);
      }
      if ((_email == null || _email!.isEmpty) &&
          email != null &&
          email.isNotEmpty) {
        _email = email;
        await _storage.write(key: _kVendorEmail, value: email);
      }
    } catch (_) {
      // Ignore decode errors; stored values may still be enough.
    }
  }

  String? _firstClaim(Map<String, dynamic> decoded, List<String> keys) {
    for (final key in keys) {
      final value = decoded[key]?.toString();
      if (value != null && value.isNotEmpty) return value;
    }
    return null;
  }

  String _extractApiMessage(DioException e, {required String fallback}) {
    final data = e.response?.data;
    if (data is Map) {
      return (data['detail'] ?? data['message'] ?? data['title'])?.toString() ??
          fallback;
    }
    if (e.type == DioExceptionType.connectionError ||
        e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.unknown) {
      return 'Cannot reach API (${_apiClient.baseUrl}). Use the live AWS URL or start local API.';
    }
    return fallback;
  }
}
