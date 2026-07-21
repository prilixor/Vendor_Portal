import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../api/api_client.dart';
import '../models/vendor_profile_model.dart';

class VendorProfileProvider extends ChangeNotifier {
  final ApiClient _api = ApiClient();

  VendorProfile? _profile;
  VendorProfile? get profile => _profile;

  VendorStatus? _status;
  VendorStatus? get status => _status;

  bool _loading = false;
  bool get loading => _loading;

  bool _saving = false;
  bool get saving => _saving;

  String? _error;
  String? get error => _error;

  bool get isPending => _status?.isPending == true;

  Future<void> fetchStatus(String vendorId, {bool silent = false}) async {
    if (vendorId.isEmpty) return;
    if (!silent) {
      _loading = true;
      notifyListeners();
    }
    try {
      final response = await _api.dio.get('/vendors/$vendorId');
      if (response.data is Map) {
        _status = VendorStatus.fromJson(
          Map<String, dynamic>.from(response.data as Map),
        );
      }
    } catch (_) {
      // Keep previous status on background failures.
    } finally {
      if (!silent) _loading = false;
      notifyListeners();
    }
  }

  Future<void> fetchProfile(String vendorId) async {
    if (vendorId.isEmpty) return;
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final response = await _api.dio.get('/vendors/$vendorId/profile');
      if (response.data is Map) {
        _profile = VendorProfile.fromJson(
          Map<String, dynamic>.from(response.data as Map),
        );
      }
    } on DioException catch (e) {
      _error = e.response?.data is Map
          ? (e.response!.data['detail'] ?? e.response!.data['message'])
                  ?.toString() ??
              'Failed to load profile.'
          : 'Failed to load profile.';
      _profile = null;
    } catch (_) {
      _error = 'Failed to load profile.';
      _profile = null;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<bool> saveProfile({
    required String vendorId,
    required String ownerName,
    required String supportPhone,
  }) async {
    final current = _profile;
    if (current == null) {
      _error = 'Complete onboarding profile first to update settings.';
      notifyListeners();
      return false;
    }
    _saving = true;
    _error = null;
    notifyListeners();
    try {
      final payload = current
          .copyWith(ownerName: ownerName.trim(), supportPhone: supportPhone.trim())
          .toUpsertPayload();
      final response = await _api.dio.put(
        '/vendors/$vendorId/profile',
        data: payload,
      );
      if (response.data is Map) {
        _profile = VendorProfile.fromJson(
          Map<String, dynamic>.from(response.data as Map),
        );
      }
      return true;
    } on DioException catch (e) {
      _error = e.response?.data is Map
          ? (e.response!.data['detail'] ?? e.response!.data['message'])
                  ?.toString() ??
              'Failed to save profile.'
          : 'Failed to save profile.';
      return false;
    } catch (_) {
      _error = 'Failed to save profile.';
      return false;
    } finally {
      _saving = false;
      notifyListeners();
    }
  }
}
