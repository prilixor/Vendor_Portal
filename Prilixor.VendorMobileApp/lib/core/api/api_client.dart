import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../config/app_urls.dart';
import '../storage/secure_storage.dart';
import '../auth/vendor_auth_storage.dart';

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;

  late Dio dio;
  final FlutterSecureStorage _storage = appSecureStorage;

  /// Called when refresh fails / session is no longer valid.
  void Function()? onSessionExpired;

  bool _isRefreshing = false;
  final List<Completer<String?>> _refreshWaiters = [];

  /// In-memory JWT so concurrent GETs after login don't each hit secure storage.
  String? _cachedAccessToken;

  // [AppUrls.apiBaseUrl] uses local API on Flutter Web localhost (avoids prod CORS).
  final String baseUrl = AppUrls.apiBaseUrl;

  /// Vendor portal web UI (terms, privacy) ?" vendor subdomain, not api host.
  String get portalWebBaseUrl => AppUrls.portalWebBaseUrl;

  ApiClient._internal() {
    dio = Dio(
      BaseOptions(
        baseUrl: baseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 20),
        headers: {'Accept': 'application/json'},
      ),
    );

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _resolveAccessToken();
          if (token != null && token.trim().isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (DioException e, handler) async {
          final status = e.response?.statusCode;
          final path = e.requestOptions.path;

          final isAuthCall =
              path.contains('/auth/login') ||
              path.contains('/auth/refresh') ||
              path.contains('/auth/forgot-password') ||
              path.contains('/auth/phone/') ||
              path.contains('/auth/change-password') ||
              path.contains('/auth/resend-verification') ||
              path.contains('/vendors/register');

          if (status != 401 || isAuthCall) {
            return handler.next(e);
          }

          try {
            final newToken = await _refreshAccessToken();
            if (newToken == null || newToken.isEmpty) {
              await _forceSessionExpired();
              return handler.next(e);
            }

            final req = e.requestOptions;
            req.headers['Authorization'] = 'Bearer $newToken';
            final response = await dio.fetch(req);
            return handler.resolve(response);
          } catch (_) {
            await _forceSessionExpired();
            return handler.next(e);
          }
        },
      ),
    );
  }

  /// Prefer memory; fall back to secure storage once and cache.
  Future<String?> _resolveAccessToken() async {
    final cached = _cachedAccessToken;
    if (cached != null && cached.trim().isNotEmpty) return cached;
    final stored = await _storage.read(key: VendorAuthStorage.jwtToken);
    if (stored != null && stored.trim().isNotEmpty) {
      _cachedAccessToken = stored;
      return stored;
    }
    return null;
  }

  /// Call after login / session restore so the next request stampede skips storage I/O.
  void setAccessToken(String? token) {
    final trimmed = token?.trim();
    _cachedAccessToken = (trimmed == null || trimmed.isEmpty) ? null : trimmed;
  }

  void clearAccessToken() {
    _cachedAccessToken = null;
  }

  Future<void> _forceSessionExpired() async {
    clearAccessToken();
    await _storage.delete(key: VendorAuthStorage.jwtToken);
    await _storage.delete(key: VendorAuthStorage.refreshToken);
    onSessionExpired?.call();
  }

  Future<String?> _refreshAccessToken() async {
    if (_isRefreshing) {
      final waiter = Completer<String?>();
      _refreshWaiters.add(waiter);
      return waiter.future;
    }

    _isRefreshing = true;
    try {
      final access = await _resolveAccessToken();
      final refresh = await _storage.read(key: VendorAuthStorage.refreshToken);
      if (access == null ||
          access.trim().isEmpty ||
          refresh == null ||
          refresh.trim().isEmpty) {
        _notifyWaiters(null);
        return null;
      }

      final refreshDio = Dio(
        BaseOptions(
          baseUrl: baseUrl,
          connectTimeout: const Duration(seconds: 15),
          receiveTimeout: const Duration(seconds: 15),
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        ),
      );

      final response = await refreshDio.post(
        '/auth/refresh',
        data: {'token': access, 'refreshToken': refresh},
      );

      if (response.statusCode == 200 && response.data is Map) {
        final data = Map<String, dynamic>.from(response.data as Map);
        final newToken = data['token']?.toString();
        final newRefresh = data['refreshToken']?.toString();
        if (newToken != null && newToken.isNotEmpty) {
          setAccessToken(newToken);
          await _storage.write(
            key: VendorAuthStorage.jwtToken,
            value: newToken,
          );
          if (newRefresh != null && newRefresh.isNotEmpty) {
            await _storage.write(
              key: VendorAuthStorage.refreshToken,
              value: newRefresh,
            );
          }
          _notifyWaiters(newToken);
          return newToken;
        }
      }
      _notifyWaiters(null);
      return null;
    } catch (_) {
      _notifyWaiters(null);
      return null;
    } finally {
      _isRefreshing = false;
    }
  }

  void _notifyWaiters(String? token) {
    final waiters = List<Completer<String?>>.from(_refreshWaiters);
    _refreshWaiters.clear();
    for (final w in waiters) {
      if (!w.isCompleted) w.complete(token);
    }
  }

  /// Twilio Phone OTP Endpoints
  Future<Response> sendPhoneOtp(String phone, String role) {
    return dio.post('/auth/phone/send-otp', data: {'phone': phone, 'role': role});
  }

  Future<Response> verifyPhoneOtp(String phone, String code, String role) {
    return dio.post('/auth/phone/verify-otp', data: {'phone': phone, 'code': code, 'role': role});
  }

  Future<Response> sendForgotPasswordSmsOtp(String phone, String role) {
    return dio.post('/auth/forgot-password/sms/send-otp', data: {'phone': phone, 'role': role});
  }

  Future<Response> verifyForgotPasswordSmsOtp(String phone, String code, String role) {
    return dio.post('/auth/forgot-password/sms/verify-otp', data: {'phone': phone, 'code': code, 'role': role});
  }

  Future<Response> resetPasswordWithSmsOtp({
    required String phone,
    required String resetToken,
    required String newPassword,
    required String confirmPassword,
    required String role,
  }) {
    return dio.post(
      '/auth/forgot-password/sms/reset',
      data: {
        'phone': phone,
        'resetToken': resetToken,
        'newPassword': newPassword,
        'confirmPassword': confirmPassword,
        'role': role,
      },
    );
  }
}
