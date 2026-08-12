import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../config/app_urls.dart';

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;

  late Dio dio;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  /// Called when refresh fails / session is no longer valid.
  void Function()? onSessionExpired;

  bool _isRefreshing = false;
  final List<Completer<String?>> _refreshWaiters = [];

  // [AppUrls.apiBaseUrl] uses local API on Flutter Web localhost (avoids prod CORS).
  final String baseUrl = AppUrls.apiBaseUrl;

  /// Customer portal web UI (terms, privacy) — root host, not api host.
  String get portalWebBaseUrl => AppUrls.portalWebBaseUrl;

  ApiClient._internal() {
    dio = Dio(
      BaseOptions(
        baseUrl: baseUrl,
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 45),
        headers: {'Accept': 'application/json'},
      ),
    );

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _storage.read(key: 'jwt_token');
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
              path.contains('/auth/reset-password') ||
              path.contains('/auth/verify-email') ||
              path.contains('/auth/resend-verification') ||
              path.contains('/auth/change-password') ||
              path.contains('/customers/register');

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

  Future<void> _forceSessionExpired() async {
    await _storage.delete(key: 'jwt_token');
    await _storage.delete(key: 'refresh_token');
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
      final access = await _storage.read(key: 'jwt_token');
      final refresh = await _storage.read(key: 'refresh_token');
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
          connectTimeout: const Duration(seconds: 30),
          receiveTimeout: const Duration(seconds: 30),
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
          await _storage.write(key: 'jwt_token', value: newToken);
          if (newRefresh != null && newRefresh.isNotEmpty) {
            await _storage.write(key: 'refresh_token', value: newRefresh);
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
}
