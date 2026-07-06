import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../api/api_client.dart';
import '../models/location_model.dart';

class LocationProvider extends ChangeNotifier {
  final ApiClient _apiClient = ApiClient();

  List<StateModel> _states = [];
  List<CityModel> _cities = [];
  bool _isLoadingStates = false;
  bool _isLoadingCities = false;
  String? _errorMessage;

  List<StateModel> get states => _states;
  List<CityModel> get cities => _cities;
  bool get isLoadingStates => _isLoadingStates;
  bool get isLoadingCities => _isLoadingCities;
  String? get errorMessage => _errorMessage;

  Future<void> fetchStates() async {
    if (_states.isNotEmpty) return; // Cache it
    _isLoadingStates = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _apiClient.dio.get('/vendors/locations/states');
      if (response.statusCode == 200) {
        final List<dynamic> data = response.data;
        _states = data.map((json) => StateModel.fromJson(json)).toList();
      }
    } on DioException catch (e) {
      _errorMessage = 'Failed to load states: ${e.message}';
    } catch (e) {
      _errorMessage = 'An unexpected error occurred.';
    }

    _isLoadingStates = false;
    notifyListeners();
  }

  Future<void> fetchCities(String stateIso2) async {
    _isLoadingCities = true;
    _errorMessage = null;
    _cities = [];
    notifyListeners();

    try {
      final response = await _apiClient.dio.get('/vendors/locations/states/$stateIso2/cities');
      if (response.statusCode == 200) {
        final List<dynamic> data = response.data;
        _cities = data.map((json) => CityModel.fromJson(json)).toList();
      }
    } on DioException catch (e) {
      _errorMessage = 'Failed to load cities: ${e.message}';
    } catch (e) {
      _errorMessage = 'An unexpected error occurred.';
    }

    _isLoadingCities = false;
    notifyListeners();
  }

  void clearCities() {
    _cities = [];
    notifyListeners();
  }
}
