import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../api/api_client.dart';
import '../models/medical_model.dart';

class MedicalProvider extends ChangeNotifier {
  final ApiClient _apiClient = ApiClient();

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
          _errorMessage = 'This doctor profile is inactive. Please use another Unique ID.';
          return null;
        }
        _lastLookup = doctor;
        return doctor;
      }
      _errorMessage = 'Doctor not found for this Unique ID.';
    } on DioException catch (e) {
      _errorMessage = e.response?.data?['detail']?.toString() ??
          e.response?.data?['message']?.toString() ??
          e.message ??
          'Doctor not found for this Unique ID.';
    } catch (_) {
      _errorMessage = 'Doctor not found for this Unique ID.';
    } finally {
      _isLookingUp = false;
      notifyListeners();
    }
    return null;
  }
}
