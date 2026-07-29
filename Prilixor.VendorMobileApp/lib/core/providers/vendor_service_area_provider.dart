import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../api/api_client.dart';
import '../models/vendor_onboarding_model.dart';

class VendorServiceAreaProvider extends ChangeNotifier {
  final ApiClient _api = ApiClient();

  bool _loading = false;
  bool get loading => _loading;

  bool _saving = false;
  bool get saving => _saving;

  String? _error;
  String? get error => _error;

  List<VendorServiceArea> _areas = [];
  List<VendorServiceArea> get areas => _areas;

  Future<void> fetchAreas(String vendorId) async {
    if (vendorId.isEmpty) return;
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final response = await _api.dio.get('/vendors/$vendorId/service-areas');
      _areas = _parseList(response.data)
          .map((e) => VendorServiceArea.fromJson(e))
          .toList();
    } on DioException catch (e) {
      _error = _dioMessage(e, 'Failed to load service areas.');
    } catch (_) {
      _error = 'Failed to load service areas.';
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<bool> saveArea({
    required String vendorId,
    required String areaName,
    required String city,
    required double latitude,
    required double longitude,
    required double radiusKm,
    String? serviceAreaId,
  }) async {
    if (areaName.trim().isEmpty || city.trim().isEmpty) {
      _error = 'Area name and city are required.';
      notifyListeners();
      return false;
    }
    _saving = true;
    _error = null;
    notifyListeners();
    try {
      final payload = {
        'vendorId': vendorId,
        'areaName': areaName.trim(),
        'city': city.trim(),
        'centerLatitude': latitude,
        'centerLongitude': longitude,
        'serviceRadiusKm': radiusKm,
        'isActive': true,
      };
      if (serviceAreaId != null && serviceAreaId.isNotEmpty) {
        await _api.dio.put(
          '/vendors/$vendorId/service-areas/$serviceAreaId',
          data: {...payload, 'serviceAreaId': serviceAreaId},
        );
      } else {
        await _api.dio.post('/vendors/$vendorId/service-areas', data: payload);
      }
      await fetchAreas(vendorId);
      return true;
    } on DioException catch (e) {
      _error = _dioMessage(e, 'Failed to save service area.');
      return false;
    } catch (_) {
      _error = 'Failed to save service area.';
      return false;
    } finally {
      _saving = false;
      notifyListeners();
    }
  }

  Future<bool> deleteArea(String vendorId, String serviceAreaId) async {
    _saving = true;
    _error = null;
    notifyListeners();
    try {
      await _api.dio.delete('/vendors/$vendorId/service-areas/$serviceAreaId');
      await fetchAreas(vendorId);
      return true;
    } on DioException catch (e) {
      _error = _dioMessage(e, 'Failed to delete service area.');
      return false;
    } catch (_) {
      _error = 'Failed to delete service area.';
      return false;
    } finally {
      _saving = false;
      notifyListeners();
    }
  }

  List<Map<String, dynamic>> _parseList(dynamic data) {
    if (data is! List) return const [];
    return data
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  String _dioMessage(DioException e, String fallback) {
    final data = e.response?.data;
    if (data is Map) {
      final detail = data['detail'] ?? data['message'];
      final title = data['title']?.toString();
      var text = detail?.toString().trim() ?? '';
      // Never show bare machine codes like vendors.service_area.location_required
      if (text.isEmpty &&
          title != null &&
          title.contains(' ') &&
          !RegExp(r'^[a-z0-9_.-]+$', caseSensitive: false).hasMatch(title)) {
        text = title;
      }
      text = text
          .replaceAll(RegExp(r'\s*\[[^\]]+\]\s*'), ' ')
          .replaceAll(
            RegExp(
              r'\b(?:vendors|customers|admins|documents|bank_accounts|auth|vendor_service_areas)\.[a-z0-9_]+(?:\.[a-z0-9_]+)*\b',
              caseSensitive: false,
            ),
            ' ',
          )
          .replaceAll(RegExp(r'\s{2,}'), ' ')
          .trim();
      if (text.isNotEmpty) return text;
      if (title == 'vendors.service_area.location_required') {
        return 'Place the pin on the map (search, click, or drag) before saving this service area.';
      }
    }
    return fallback;
  }
}
