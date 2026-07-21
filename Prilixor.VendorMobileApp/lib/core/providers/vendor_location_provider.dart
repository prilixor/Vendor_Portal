import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../api/api_client.dart';
import '../models/vendor_onboarding_model.dart';

class VendorLocationProvider extends ChangeNotifier {
  final ApiClient _api = ApiClient();

  List<LocationState> _states = [];
  List<LocationCity> _cities = [];
  bool _loadingStates = false;
  bool _loadingCities = false;
  String? _errorMessage;

  List<LocationState> get states => _states;
  List<LocationCity> get cities => _cities;
  bool get isLoadingStates => _loadingStates;
  bool get isLoadingCities => _loadingCities;
  String? get errorMessage => _errorMessage;

  Future<void> fetchStates() async {
    if (_states.isNotEmpty || _loadingStates) return;
    _loadingStates = true;
    _errorMessage = null;
    notifyListeners();
    try {
      final response = await _api.dio.get('/vendors/locations/states');
      final data = response.data is List ? response.data as List : const [];
      _states = data
          .whereType<Map>()
          .map((e) => LocationState.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } on DioException catch (e) {
      _errorMessage = 'Failed to load states: ${e.message}';
    } catch (_) {
      _errorMessage = 'Failed to load states.';
    } finally {
      _loadingStates = false;
      notifyListeners();
    }
  }

  Future<void> fetchCities(String stateIso2) async {
    if (stateIso2.trim().isEmpty) return;
    _loadingCities = true;
    _errorMessage = null;
    _cities = [];
    notifyListeners();
    try {
      final response = await _api.dio.get(
        '/vendors/locations/states/${Uri.encodeComponent(stateIso2)}/cities',
      );
      final data = response.data is List ? response.data as List : const [];
      _cities = data
          .whereType<Map>()
          .map((e) => LocationCity.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } on DioException catch (e) {
      _errorMessage = 'Failed to load cities: ${e.message}';
      _cities = [];
    } catch (_) {
      _errorMessage = 'Failed to load cities.';
      _cities = [];
    } finally {
      _loadingCities = false;
      notifyListeners();
    }
  }

  String? resolveStateIso2(String stateValue) {
    final value = stateValue.trim();
    if (value.isEmpty) return null;
    for (final state in _states) {
      if (state.name.toLowerCase() == value.toLowerCase() ||
          state.iso2.toLowerCase() == value.toLowerCase()) {
        return state.iso2;
      }
    }
    return null;
  }

  Future<String?> bootstrapSelection({
    required String stateName,
    required String cityName,
  }) async {
    await fetchStates();
    final iso2 = resolveStateIso2(stateName);
    if (iso2 != null) {
      await fetchCities(iso2);
    }
    return iso2;
  }

}
