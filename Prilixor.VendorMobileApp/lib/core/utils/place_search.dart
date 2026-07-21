import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

/// Place result from Photon / Nominatim (same providers as Vendor Web MapPicker).
class PlaceSearchResult {
  final String label;
  final double lat;
  final double lng;

  const PlaceSearchResult({
    required this.label,
    required this.lat,
    required this.lng,
  });
}

/// Client-side geocoding used by map pickers.
/// Photon first, then Nominatim nearby + global — mirrors seller-sparkle-ui MapPicker.
class PlaceSearch {
  PlaceSearch({
    this.userAgent = 'PrilixorVendor/1.0 (com.prilixor.vendor; support@prilixor.com)',
  }) : _dio = Dio(
          BaseOptions(
            connectTimeout: const Duration(seconds: 12),
            receiveTimeout: const Duration(seconds: 12),
            headers: {
              'Accept': 'application/json',
              // Photon/Nominatim often block the default Dart User-Agent.
              'User-Agent': userAgent,
            },
          ),
        );

  final String userAgent;
  final Dio _dio;

  void close() => _dio.close();

  /// Reverse-geocode pin coordinates → state/city (used when editing areas that only store city).
  Future<({String? state, String? city})?> reverse({
    required double latitude,
    required double longitude,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        'https://nominatim.openstreetmap.org/reverse',
        queryParameters: {
          'format': 'jsonv2',
          'lat': latitude,
          'lon': longitude,
          'addressdetails': 1,
        },
      );
      final address = response.data?['address'];
      if (address is! Map) return null;
      final state = address['state']?.toString().trim();
      final city = (address['city'] ??
              address['town'] ??
              address['village'] ??
              address['municipality'] ??
              address['county'] ??
              address['state_district'])
          ?.toString()
          .trim();
      return (
        state: (state == null || state.isEmpty) ? null : state,
        city: (city == null || city.isEmpty) ? null : city,
      );
    } catch (e, st) {
      debugPrint('Reverse geocode failed: $e\n$st');
      return null;
    }
  }

  Future<List<PlaceSearchResult>> search({
    required String query,
    required double latitude,
    required double longitude,
    int limit = 10,
  }) async {
    final trimmed = query.trim();
    if (trimmed.length < 2) return const [];

    try {
      final photon = await _searchPhoton(
        query: trimmed,
        latitude: latitude,
        longitude: longitude,
        limit: limit,
      );
      if (photon.isNotEmpty) return photon;
    } catch (e, st) {
      debugPrint('Photon search failed: $e\n$st');
    }

    try {
      return await _searchNominatim(
        query: trimmed,
        latitude: latitude,
        longitude: longitude,
        limit: limit,
      );
    } catch (e, st) {
      debugPrint('Nominatim search failed: $e\n$st');
      rethrow;
    }
  }

  Future<List<PlaceSearchResult>> _searchPhoton({
    required String query,
    required double latitude,
    required double longitude,
    required int limit,
  }) async {
    final response = await _dio.get<Map<String, dynamic>>(
      'https://photon.komoot.io/api/',
      queryParameters: {
        'q': query,
        'lat': latitude,
        'lon': longitude,
        'limit': limit,
        'lang': 'en',
      },
    );
    final features = response.data?['features'];
    if (features is! List) return const [];

    final parsed = <PlaceSearchResult>[];
    for (final item in features) {
      if (item is! Map) continue;
      final geometry = item['geometry'];
      if (geometry is! Map) continue;
      final coords = geometry['coordinates'];
      if (coords is! List || coords.length < 2) continue;
      final lng = (coords[0] as num).toDouble();
      final lat = (coords[1] as num).toDouble();
      final props = item['properties'];
      parsed.add(
        PlaceSearchResult(
          label: _formatPhotonLabel(props is Map ? props : const {}),
          lat: lat,
          lng: lng,
        ),
      );
    }
    return parsed;
  }

  Future<List<PlaceSearchResult>> _searchNominatim({
    required String query,
    required double latitude,
    required double longitude,
    required int limit,
  }) async {
    const nearbyDelta = 0.8;
    final left = longitude - nearbyDelta;
    final right = longitude + nearbyDelta;
    final top = latitude + nearbyDelta;
    final bottom = latitude - nearbyDelta;

    final nearby = await _dio.get<List<dynamic>>(
      'https://nominatim.openstreetmap.org/search',
      queryParameters: {
        'format': 'jsonv2',
        'addressdetails': 1,
        'limit': limit,
        'bounded': 1,
        'viewbox': '$left,$top,$right,$bottom',
        'q': query,
      },
    );

    var merged = _parseNominatim(nearby.data);
    if (merged.length < 6) {
      final global = await _dio.get<List<dynamic>>(
        'https://nominatim.openstreetmap.org/search',
        queryParameters: {
          'format': 'jsonv2',
          'addressdetails': 1,
          'limit': limit,
          'q': query,
        },
      );
      final globalParsed = _parseNominatim(global.data);
      final seen = <String>{for (final p in merged) '${p.lat},${p.lng}'};
      for (final item in globalParsed) {
        final key = '${item.lat},${item.lng}';
        if (seen.add(key)) merged.add(item);
      }
    }

    if (merged.length > limit) {
      merged = merged.sublist(0, limit);
    }
    return merged;
  }

  List<PlaceSearchResult> _parseNominatim(List<dynamic>? data) {
    if (data == null) return [];
    final out = <PlaceSearchResult>[];
    for (final item in data) {
      if (item is! Map) continue;
      final lat = double.tryParse(item['lat']?.toString() ?? '');
      final lng = double.tryParse(item['lon']?.toString() ?? '');
      if (lat == null || lng == null) continue;
      final label = item['display_name']?.toString().trim();
      out.add(
        PlaceSearchResult(
          label: (label == null || label.isEmpty) ? 'Unnamed place' : label,
          lat: lat,
          lng: lng,
        ),
      );
    }
    return out;
  }

  String _formatPhotonLabel(Map<dynamic, dynamic> properties) {
    final parts = [
      properties['name'],
      properties['street'],
      properties['district'],
      properties['city'],
      properties['state'],
      properties['postcode'],
      properties['country'],
    ]
        .whereType<String>()
        .where((s) => s.trim().isNotEmpty)
        .toList();
    return parts.isEmpty ? 'Unnamed place' : parts.join(', ');
  }
}
