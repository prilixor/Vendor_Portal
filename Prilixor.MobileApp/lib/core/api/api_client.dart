import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;

  late Dio dio;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  // Pointing to your local .NET API running on localhost:5001
  final String baseUrl = "https://localhost:5001/api";

  ApiClient._internal() {
    dio = Dio(
      BaseOptions(
        baseUrl: baseUrl,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 10),
        headers: {
          'Accept': 'application/json',
        },
      ),
    );

    // Add Token Interceptor to automatically append JWT to requests
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          // Check for token in secure storage
          final token = await _storage.read(key: 'jwt_token');
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (DioException e, handler) async {
          // TODO: Implement Refresh Token rotation logic here if 401 Unauthorized
          return handler.next(e);
        },
      ),
    );
  }
}
