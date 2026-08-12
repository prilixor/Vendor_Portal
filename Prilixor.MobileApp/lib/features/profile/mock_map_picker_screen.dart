import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../core/theme.dart';
import '../../core/utils/debouncer.dart';
import '../../core/utils/place_search.dart';

class MockMapPickerScreen extends StatefulWidget {
  const MockMapPickerScreen({super.key});

  @override
  State<MockMapPickerScreen> createState() => _MockMapPickerScreenState();
}

class _MockMapPickerScreenState extends State<MockMapPickerScreen> {
  LatLng _center = const LatLng(23.0225, 72.5714);
  final MapController _mapController = MapController();
  final PlaceSearch _placeSearch = PlaceSearch();
  final TextEditingController _searchController = TextEditingController();
  final Debouncer _placeSearchDebouncer = Debouncer(duration: placeSearchDebounce);
  bool _isSearching = false;
  bool _isConfirming = false;

  @override
  void initState() {
    super.initState();
    _searchController.addListener(_onPlaceSearchTextChanged);
  }

  void _onPlaceSearchTextChanged() {
    final trimmed = _searchController.text.trim();
    if (trimmed.length < 2) return;
    _placeSearchDebouncer.run(() => _searchLocation(trimmed));
  }

  @override
  void dispose() {
    _placeSearchDebouncer.dispose();
    _searchController.removeListener(_onPlaceSearchTextChanged);
    _searchController.dispose();
    _placeSearch.close();
    super.dispose();
  }

  Future<void> _searchLocation(String query) async {
    if (query.trim().isEmpty) return;
    setState(() => _isSearching = true);
    try {
      final results = await _placeSearch.search(
        query: query,
        latitude: _center.latitude,
        longitude: _center.longitude,
        limit: 5,
      );
      if (!mounted) return;
      if (results.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Location not found')),
        );
        return;
      }
      final first = results.first;
      final pos = LatLng(first.lat, first.lng);
      _mapController.move(pos, 15.0);
      setState(() => _center = pos);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Unable to search right now.')),
      );
    } finally {
      if (mounted) setState(() => _isSearching = false);
    }
  }

  Future<void> _confirmLocation() async {
    if (_isConfirming) return;
    setState(() => _isConfirming = true);
    try {
      final rev = await _placeSearch.reverse(
        latitude: _center.latitude,
        longitude: _center.longitude,
      );
      if (!mounted) return;
      Navigator.pop(context, {
        'latitude': _center.latitude,
        'longitude': _center.longitude,
        'line1': rev?.line1,
        'city': rev?.city,
        'state': rev?.state,
        'postal': rev?.postal,
        'resolved': rev?.hasAnyField == true,
      });
    } catch (_) {
      if (!mounted) return;
      // Still return pin — form fields stay mandatory for the user.
      Navigator.pop(context, {
        'latitude': _center.latitude,
        'longitude': _center.longitude,
        'resolved': false,
      });
    } finally {
      if (mounted) setState(() => _isConfirming = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.background,
        elevation: 0,
        title: Text('Pick Location', style: TextStyle(color: colors.textPrimary)),
        iconTheme: IconThemeData(color: colors.textPrimary),
      ),
      body: Stack(
        children: [
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _center,
              initialZoom: 13.0,
              onPositionChanged: (MapCamera camera, bool hasGesture) {
                setState(() {
                  _center = camera.center;
                });
              },
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.prilixor.prilixor_mobile',
              ),
            ],
          ),
          const Center(
            child: Padding(
              padding: EdgeInsets.only(bottom: 40.0),
              child: Icon(Icons.location_on, size: 50, color: Color(0xFF6C63FF)),
            ),
          ),
          Positioned(
            top: 16,
            left: 16,
            right: 16,
            child: Container(
              decoration: BoxDecoration(
                color: colors.surface,
                borderRadius: BorderRadius.circular(12),
                boxShadow: const [
                  BoxShadow(
                    color: Colors.black45,
                    blurRadius: 10,
                    offset: Offset(0, 4),
                  ),
                ],
              ),
              child: TextField(
                controller: _searchController,
                style: TextStyle(color: colors.textPrimary),
                textInputAction: TextInputAction.search,
                decoration: InputDecoration(
                  hintText: 'Search area / landmark / pincode...',
                  hintStyle: TextStyle(color: colors.textMuted),
                  prefixIcon: Icon(Icons.search, color: colors.textMuted),
                  suffixIcon: _isSearching
                      ? const Padding(
                          padding: EdgeInsets.all(12),
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Color(0xFF6C63FF),
                          ),
                        )
                      : null,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide.none,
                  ),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 14,
                  ),
                ),
                onSubmitted: (value) {
                  _placeSearchDebouncer.cancel();
                  _searchLocation(value);
                },
              ),
            ),
          ),
          Positioned(
            bottom: 32,
            left: 24,
            right: 24,
            child: SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _isConfirming ? null : _confirmLocation,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF6C63FF),
                  disabledBackgroundColor: const Color(0xFF6C63FF).withValues(alpha: 0.5),
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: _isConfirming
                    ? const SizedBox(
                        height: 22,
                        width: 22,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text(
                        'Confirm Location',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
