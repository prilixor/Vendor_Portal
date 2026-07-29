import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../api/api_client.dart';
import '../models/medical_model.dart';
import '../utils/user_friendly_error.dart';

class MedicalProvider extends ChangeNotifier {
  final ApiClient _apiClient = ApiClient();

  static const _notFoundMessage =
      'No doctor found for this Unique ID. Please check the ID and try again.';

  bool _isLookingUp = false;
  bool get isLookingUp => _isLookingUp;

  String? _errorMessage;
  String? get errorMessage => _errorMessage;

  DoctorModel? _lastLookup;
  DoctorModel? get lastLookup => _lastLookup;

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  Future<DoctorModel?> getDoctorByCode(String uniqueCode) async {
    final code = uniqueCode.trim().toUpperCase();
    if (code.isEmpty) {
      _errorMessage = 'Enter the doctor\'s Unique ID';
      notifyListeners();
      return null;
    }

    _isLookingUp = true;
    _errorMessage = null;
    _lastLookup = null;
    notifyListeners();

    try {
      final response = await _apiClient.dio.get(
        '/medical-directory/doctors/by-code/${Uri.encodeComponent(code)}',
      );
      if (response.statusCode == 200 && response.data is Map<String, dynamic>) {
        final doctor = DoctorModel.fromJson(response.data as Map<String, dynamic>);
        if (!doctor.isActive) {
          _errorMessage =
              'This doctor profile is inactive. Please use another Unique ID.';
          return null;
        }
        _lastLookup = doctor;
        return doctor;
      }
      _errorMessage = _notFoundMessage;
    } on DioException catch (e) {
      final status = e.response?.statusCode;
      if (status == 404) {
        _errorMessage = _messageFromResponse(e.response?.data) ?? _notFoundMessage;
      } else if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout ||
          e.type == DioExceptionType.connectionError) {
        _errorMessage =
            'Unable to look up this doctor right now. Please check your connection and try again.';
      } else {
        _errorMessage = _messageFromResponse(e.response?.data) ??
            userFriendlyDioMessage(e.response?.data, e.message, _notFoundMessage);
      }
    } catch (_) {
      _errorMessage = _notFoundMessage;
    } finally {
      _isLookingUp = false;
      notifyListeners();
    }
    return null;
  }

  /// API 404 body is often a list of `{ code, message }` (FluentResults), not ProblemDetails.
  String? _messageFromResponse(dynamic data) {
    try {
      if (data is List && data.isNotEmpty) {
        final first = data.first;
        if (first is Map) {
          final code = first['code']?.toString();
          final message = first['message']?.toString() ?? first['description']?.toString();
          if (code == 'directory.doctor_not_found' ||
              (message != null && message.toLowerCase().contains('not found'))) {
            return _notFoundMessage;
          }
          if (message != null && message.trim().isNotEmpty) {
            return userFriendlyApiError({'code': code, 'detail': message}, _notFoundMessage);
          }
        }
      }
      if (data is Map) {
        return userFriendlyApiError(data, _notFoundMessage);
      }
    } catch (_) {
      // Never let response parsing break the lookup flow.
    }
    return null;
  }
}
