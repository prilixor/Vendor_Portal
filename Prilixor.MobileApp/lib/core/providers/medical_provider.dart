import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../api/api_client.dart';
import '../models/medical_model.dart';

class MedicalProvider extends ChangeNotifier {
  final ApiClient _apiClient = ApiClient();

  List<HospitalModel> _hospitals = [];
  List<HospitalModel> get hospitals => _hospitals;

  List<DoctorModel> _doctors = [];
  List<DoctorModel> get doctors => _doctors;

  bool _isLoadingHospitals = false;
  bool get isLoadingHospitals => _isLoadingHospitals;

  bool _isLoadingDoctors = false;
  bool get isLoadingDoctors => _isLoadingDoctors;

  bool _isSaving = false;
  bool get isSaving => _isSaving;

  String? _errorMessage;
  String? get errorMessage => _errorMessage;

  Future<void> searchHospitals({String search = ''}) async {
    _isLoadingHospitals = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final qs = search.trim().isNotEmpty ? '?search=${Uri.encodeComponent(search.trim())}' : '';
      final response = await _apiClient.dio.get('/medical-directory/hospitals$qs');
      if (response.statusCode == 200) {
        final list = response.data as List<dynamic>? ?? [];
        _hospitals = list
            .map((e) => HospitalModel.fromJson(e as Map<String, dynamic>))
            .toList();
      }
    } on DioException catch (e) {
      _errorMessage = e.response?.data?['detail']?.toString() ?? e.message ?? 'Failed to load hospitals';
    } catch (_) {
      _errorMessage = 'Failed to load hospitals';
    } finally {
      _isLoadingHospitals = false;
      notifyListeners();
    }
  }

  Future<void> searchDoctors({required String hospitalId, String search = ''}) async {
    if (hospitalId.isEmpty) {
      _doctors = [];
      notifyListeners();
      return;
    }

    _isLoadingDoctors = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final params = <String, dynamic>{'hospitalId': hospitalId};
      if (search.trim().isNotEmpty) params['search'] = search.trim();
      final response = await _apiClient.dio.get(
        '/medical-directory/doctors',
        queryParameters: params,
      );
      if (response.statusCode == 200) {
        final list = response.data as List<dynamic>? ?? [];
        _doctors = list
            .map((e) => DoctorModel.fromJson(e as Map<String, dynamic>))
            .toList();
      }
    } on DioException catch (e) {
      _errorMessage = e.response?.data?['detail']?.toString() ?? e.message ?? 'Failed to load doctors';
    } catch (_) {
      _errorMessage = 'Failed to load doctors';
    } finally {
      _isLoadingDoctors = false;
      notifyListeners();
    }
  }

  Future<HospitalModel?> createHospital({
    required String name,
    String? city,
  }) async {
    _isSaving = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _apiClient.dio.post(
        '/medical-directory/hospitals',
        data: {
          'name': name.trim(),
          if (city != null && city.trim().isNotEmpty) 'city': city.trim(),
        },
      );
      if (response.statusCode == 200 || response.statusCode == 201) {
        final hospital = HospitalModel.fromJson(response.data as Map<String, dynamic>);
        _hospitals = [hospital, ..._hospitals.where((h) => h.id != hospital.id)];
        return hospital;
      }
    } on DioException catch (e) {
      _errorMessage = e.response?.data?['detail']?.toString() ??
          e.response?.data?['message']?.toString() ??
          e.message ??
          'Failed to create hospital';
    } catch (_) {
      _errorMessage = 'Failed to create hospital';
    } finally {
      _isSaving = false;
      notifyListeners();
    }
    return null;
  }

  Future<DoctorModel?> createDoctor({
    required String hospitalId,
    required String fullName,
    String? specialization,
  }) async {
    _isSaving = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _apiClient.dio.post(
        '/medical-directory/doctors',
        data: {
          'hospitalId': hospitalId,
          'fullName': fullName.trim(),
          if (specialization != null && specialization.trim().isNotEmpty)
            'specialization': specialization.trim(),
        },
      );
      if (response.statusCode == 200 || response.statusCode == 201) {
        final doctor = DoctorModel.fromJson(response.data as Map<String, dynamic>);
        _doctors = [doctor, ..._doctors.where((d) => d.id != doctor.id)];
        return doctor;
      }
    } on DioException catch (e) {
      _errorMessage = e.response?.data?['detail']?.toString() ??
          e.response?.data?['message']?.toString() ??
          e.message ??
          'Failed to create doctor';
    } catch (_) {
      _errorMessage = 'Failed to create doctor';
    } finally {
      _isSaving = false;
      notifyListeners();
    }
    return null;
  }

  void clearDoctors() {
    _doctors = [];
    notifyListeners();
  }
}
