import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../api/api_client.dart';
import '../models/favorite_model.dart';

class FavoriteProvider extends ChangeNotifier {
  final ApiClient _apiClient = ApiClient();

  List<FavoriteModel> _favorites = [];
  bool _isLoading = false;
  String? _errorMessage;

  List<FavoriteModel> get favorites => _favorites;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Set<String> get favoriteListingIds => _favorites.map((f) => f.vendorProductListingId).toSet();

  Future<void> fetchFavorites() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _apiClient.dio.get('/customers/me/favorites');
      if (response.statusCode == 200) {
        final List<dynamic> data = response.data;
        _favorites = data.map((json) => FavoriteModel.fromJson(json)).toList();
      }
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        _favorites = [];
        _errorMessage = null;
      } else {
        _errorMessage = 'Failed to load favorites. Please try again.';
      }
    } catch (_) {
      _errorMessage = 'An unexpected error occurred.';
    }

    _isLoading = false;
    notifyListeners();
  }

  Future<bool> addFavorite(String listingId) async {
    try {
      final response = await _apiClient.dio.post(
        '/customers/me/favorites',
        data: {'vendorProductListingId': listingId},
      );
      if (response.statusCode == 200 || response.statusCode == 201) {
        final newFav = FavoriteModel.fromJson(response.data);
        _favorites.add(newFav);
        notifyListeners();
        return true;
      }
    } catch (e) {
      _errorMessage = 'Failed to add favorite.';
    }
    return false;
  }

  Future<bool> removeFavorite(String listingId) async {
    try {
      final response = await _apiClient.dio.delete('/customers/me/favorites/$listingId');
      if (response.statusCode == 200 || response.statusCode == 204) {
        _favorites.removeWhere((f) => f.vendorProductListingId == listingId);
        notifyListeners();
        return true;
      }
    } catch (e) {
      _errorMessage = 'Failed to remove favorite.';
    }
    return false;
  }

  bool isFavorite(String listingId) {
    return favoriteListingIds.contains(listingId);
  }

  Future<void> toggleFavorite(String listingId) async {
    if (isFavorite(listingId)) {
      await removeFavorite(listingId);
    } else {
      await addFavorite(listingId);
    }
  }
}
