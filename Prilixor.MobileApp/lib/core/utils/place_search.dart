import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

/// Place result from Photon / Nominatim (same providers as Vendor Web MapPicker).
class PlaceSearchResult {
  final String label;
  final double lat;
  final double lng;
  final ReverseGeocodeResult? address;

  const PlaceSearchResult({
    required this.label,
    required this.lat,
    required this.lng,
    this.address,
  });
}

/// Structured fields from reverse geocode — any may be null when OSM has no match.
class ReverseGeocodeResult {
  final String? line1;
  final String? city;
  final String? state;
  final String? postal;

  const ReverseGeocodeResult({
    this.line1,
    this.city,
    this.state,
    this.postal,
  });

  bool get hasAnyField =>
      (line1 != null && line1!.isNotEmpty) ||
      (city != null && city!.isNotEmpty) ||
      (state != null && state!.isNotEmpty) ||
      (postal != null && postal!.isNotEmpty);

  /// Prefer [primary] per field, then fill gaps from [fallback].
  static ReverseGeocodeResult? merge(
    ReverseGeocodeResult? primary,
    ReverseGeocodeResult? fallback,
  ) {
    if (primary == null && fallback == null) return null;
    String? pick(String? first, String? second) {
      final a = first?.trim();
      if (a != null && a.isNotEmpty) return a;
      final b = second?.trim();
      if (b != null && b.isNotEmpty) return b;
      return null;
    }

    final merged = ReverseGeocodeResult(
      line1: pick(primary?.line1, fallback?.line1),
      city: pick(primary?.city, fallback?.city),
      state: pick(primary?.state, fallback?.state),
      postal: pick(primary?.postal, fallback?.postal),
    );
    return merged.hasAnyField ? merged : null;
  }
}

/// Client-side geocoding for Customer map picker.
class PlaceSearch {
  PlaceSearch({
    this.userAgent =
        'BlinksMedCustomer/1.0 (com.prilixor.prilixor_mobile; support@blinksmed.com)',
  }) : _dio = Dio(
          BaseOptions(
            connectTimeout: const Duration(seconds: 12),
            receiveTimeout: const Duration(seconds: 12),
            headers: {
              'Accept': 'application/json',
              // Browsers forbid setting User-Agent; only send it on native.
              if (!kIsWeb) 'User-Agent': userAgent,
            },
          ),
        );

  final String userAgent;
  final Dio _dio;

  void close() => _dio.close();

  /// Reverse-geocode pin → address line / state / city / postal when available.
  /// Nominatim first (same as the website), then Photon if that lookup is empty.
  Future<ReverseGeocodeResult?> reverse({
    required double latitude,
    required double longitude,
  }) async {
    ReverseGeocodeResult? nominatim;
    try {
      nominatim = await _reverseNominatim(latitude, longitude);
    } catch (e, st) {
      debugPrint('Nominatim reverse failed: $e\n$st');
    }
    if (nominatim != null &&
        nominatim.line1 != null &&
        nominatim.city != null &&
        nominatim.state != null &&
        nominatim.postal != null) {
      return nominatim;
    }

    ReverseGeocodeResult? photon;
    try {
      photon = await _reversePhoton(latitude, longitude);
    } catch (e, st) {
      debugPrint('Photon reverse failed: $e\n$st');
    }
    return ReverseGeocodeResult.merge(nominatim, photon);
  }

  Future<ReverseGeocodeResult?> _reverseNominatim(double latitude, double longitude) async {
    final response = await _dio.get(
      'https://nominatim.openstreetmap.org/reverse',
      queryParameters: {
        'format': 'jsonv2',
        'lat': latitude,
        'lon': longitude,
        'addressdetails': 1,
      },
    );
    final data = response.data;
    if (data is! Map) return null;
    final address = data['address'];
    if (address is! Map) return null;
    return _fromNominatimAddress(address, data['name']?.toString());
  }

  Future<ReverseGeocodeResult?> _reversePhoton(double latitude, double longitude) async {
    final response = await _dio.get(
      'https://photon.komoot.io/reverse',
      queryParameters: {
        'lat': latitude,
        'lon': longitude,
        'lang': 'en',
      },
    );
    final data = response.data;
    if (data is! Map) return null;
    final features = data['features'];
    if (features is! List || features.isEmpty) return null;
    final first = features.first;
    if (first is! Map) return null;
    final props = first['properties'];
    if (props is! Map) return null;
    return _fromPhotonProperties(props);
  }

  ReverseGeocodeResult? _fromNominatimAddress(Map address, String? placeName) {
    final state = _trim(address['state']?.toString());
    final city = _trim(
      (address['city'] ??
              address['town'] ??
              address['village'] ??
              address['municipality'] ??
              address['county'] ??
              address['state_district'])
          ?.toString(),
    );
    final postal = _trim(address['postcode']?.toString());
    final line1 = _buildLine1(address, placeName);
    final resolved = ReverseGeocodeResult(
      line1: line1,
      city: city,
      state: state,
      postal: postal,
    );
    return resolved.hasAnyField ? resolved : null;
  }

  ReverseGeocodeResult? _fromPhotonProperties(Map properties) {
    final house = _trim(properties['housenumber']?.toString());
    final street = _trim(properties['street']?.toString());
    final name = _trim(properties['name']?.toString());
    final String? line1;
    if (street != null) {
      line1 = house != null ? '$house $street' : street;
    } else {
      line1 = name ??
          _trim(properties['district']?.toString()) ??
          _trim(properties['locality']?.toString());
    }
    final city = _trim(properties['city']?.toString()) ??
        _trim(properties['district']?.toString()) ??
        _trim(properties['county']?.toString()) ??
        _trim(properties['locality']?.toString());
    final state = _trim(properties['state']?.toString());
    final postal = _trim(properties['postcode']?.toString());
    final resolved = ReverseGeocodeResult(
      line1: line1,
      city: city,
      state: state,
      postal: postal,
    );
    return resolved.hasAnyField ? resolved : null;
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
    final response = await _dio.get(
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
      final propMap = props is Map ? props : const {};
      parsed.add(
        PlaceSearchResult(
          label: _formatPhotonLabel(propMap),
          lat: lat,
          lng: lng,
          address: props is Map ? _fromPhotonProperties(props) : null,
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

    final nearby = await _dio.get(
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

    var merged = _parseNominatim(nearby.data is List ? nearby.data as List : null);
    if (merged.length < 6) {
      final global = await _dio.get(
        'https://nominatim.openstreetmap.org/search',
        queryParameters: {
          'format': 'jsonv2',
          'addressdetails': 1,
          'limit': limit,
          'q': query,
        },
      );
      final globalParsed = _parseNominatim(global.data is List ? global.data as List : null);
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
      final address = item['address'];
      out.add(
        PlaceSearchResult(
          label: (label == null || label.isEmpty) ? 'Unnamed place' : label,
          lat: lat,
          lng: lng,
          address: address is Map
              ? _fromNominatimAddress(address, item['name']?.toString())
              : null,
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

  static String? _trim(String? value) {
    final t = value?.trim();
    if (t == null || t.isEmpty) return null;
    return t;
  }

  static String? _buildLine1(Map address, String? placeName) {
    final house = _trim(address['house_number']?.toString());
    final road = _trim(address['road']?.toString());
    if (road != null) {
      return house != null ? '$house $road' : road;
    }
    final named = _trim(placeName) ??
        _trim(address['neighbourhood']?.toString()) ??
        _trim(address['suburb']?.toString()) ??
        _trim(address['residential']?.toString()) ??
        _trim(address['hamlet']?.toString()) ??
        _trim(address['locality']?.toString());
    return named;
  }
}
