import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

import '../../core/theme.dart';
import '../../core/utils/debouncer.dart';
import '../../core/utils/device_location.dart';
import '../../core/utils/place_search.dart';

class MockMapPickerScreen extends StatefulWidget {
  final double? initialLatitude;
  final double? initialLongitude;

  const MockMapPickerScreen({
    super.key,
    this.initialLatitude,
    this.initialLongitude,
  });

  @override
  State<MockMapPickerScreen> createState() => _MockMapPickerScreenState();
}

class _MockMapPickerScreenState extends State<MockMapPickerScreen> {
  static const _defaultCenter = LatLng(23.0225, 72.5714);
  static const _accent = Color(0xFF6C63FF);

  late LatLng _center;
  final MapController _mapController = MapController();
  final PlaceSearch _placeSearch = PlaceSearch();
  final TextEditingController _searchController = TextEditingController();
  final Debouncer _placeSearchDebouncer = Debouncer(duration: placeSearchDebounce);
  final Debouncer _reverseDebouncer = Debouncer(duration: const Duration(milliseconds: 450));

  bool _isSearching = false;
  bool _isConfirming = false;
  bool _isLocating = false;
  bool _isResolving = false;
  List<PlaceSearchResult> _results = [];
  String? _searchError;
  ReverseGeocodeResult? _preview;
  String? _previewHeadline;

  @override
  void initState() {
    super.initState();
    final lat = widget.initialLatitude;
    final lng = widget.initialLongitude;
    final hasInitial = lat != null &&
        lng != null &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180 &&
        !(lat == 0 && lng == 0);
    _center = hasInitial ? LatLng(lat, lng) : _defaultCenter;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _mapController.move(_center, hasInitial ? 16 : 13);
      _resolvePreview(_center);
    });
  }

  @override
  void dispose() {
    _placeSearchDebouncer.dispose();
    _reverseDebouncer.dispose();
    _searchController.dispose();
    _placeSearch.close();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    final trimmed = value.trim();
    if (trimmed.length < 2) {
      setState(() {
        _results = [];
        _searchError = null;
      });
      return;
    }
    _placeSearchDebouncer.run(() => _runSearch(trimmed));
  }

  Future<void> _runSearch(String query) async {
    setState(() {
      _isSearching = true;
      _searchError = null;
    });
    try {
      final results = await _placeSearch.search(
        query: query,
        latitude: _center.latitude,
        longitude: _center.longitude,
        limit: 8,
      );
      if (!mounted) return;
      setState(() {
        _results = results;
        _searchError = results.isEmpty ? 'No matching places found.' : null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _results = [];
        _searchError = 'Unable to search right now.';
      });
    } finally {
      if (mounted) setState(() => _isSearching = false);
    }
  }

  void _selectResult(PlaceSearchResult result) {
    final pos = LatLng(result.lat, result.lng);
    _searchController.text = result.label;
    setState(() {
      _center = pos;
      _results = [];
      _searchError = null;
      _previewHeadline = result.label;
    });
    _mapController.move(pos, 16);
    FocusScope.of(context).unfocus();
    _resolvePreview(pos);
  }

  void _onMapEvent(MapEvent event) {
    // Update pin only when the gesture finishes — avoids jank from setState every frame.
    if (event is MapEventMoveEnd || event is MapEventFlingAnimationEnd) {
      final next = event.camera.center;
      if ((next.latitude - _center.latitude).abs() < 1e-7 &&
          (next.longitude - _center.longitude).abs() < 1e-7) {
        return;
      }
      setState(() => _center = next);
      _reverseDebouncer.run(() => _resolvePreview(next));
    }
  }

  void _onMapTapped(TapPosition _, LatLng point) {
    setState(() {
      _center = point;
      _results = [];
      _searchError = null;
    });
    _mapController.move(point, _mapController.camera.zoom);
    FocusScope.of(context).unfocus();
    _resolvePreview(point);
  }

  Future<void> _resolvePreview(LatLng point) async {
    setState(() {
      _isResolving = true;
      _preview = null;
    });
    try {
      final rev = await _placeSearch.reverse(
        latitude: point.latitude,
        longitude: point.longitude,
      );
      if (!mounted) return;
      setState(() {
        _preview = rev;
        if (rev != null && rev.hasAnyField) {
          _previewHeadline = [
            rev.line1,
            rev.city,
            rev.state,
            rev.postal,
          ].whereType<String>().where((s) => s.trim().isNotEmpty).join(', ');
        }
      });
    } finally {
      if (mounted) setState(() => _isResolving = false);
    }
  }

  Future<void> _useMyLocation() async {
    if (_isLocating) return;
    setState(() => _isLocating = true);
    try {
      final result = await resolveDeviceLocation();
      if (!mounted) return;
      if (!result.ok) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result.errorMessage ?? 'Unable to get location.'),
            action: result.shouldOpenSettings
                ? SnackBarAction(
                    label: 'Settings',
                    onPressed: () => Geolocator.openAppSettings(),
                  )
                : null,
          ),
        );
        return;
      }
      final pos = LatLng(result.latitude!, result.longitude!);
      setState(() {
        _center = pos;
        _results = [];
        _searchError = null;
      });
      _mapController.move(pos, 16);
      await _resolvePreview(pos);
    } finally {
      if (mounted) setState(() => _isLocating = false);
    }
  }

  Future<void> _confirmLocation() async {
    if (_isConfirming) return;
    setState(() => _isConfirming = true);
    try {
      var rev = _preview;
      if (rev == null || !rev.hasAnyField) {
        rev = await _placeSearch.reverse(
          latitude: _center.latitude,
          longitude: _center.longitude,
        );
      }
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
    final bottomInset = MediaQuery.paddingOf(context).bottom;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.background,
        elevation: 0,
        title: Text('Pick Location', style: TextStyle(color: colors.textPrimary)),
        iconTheme: IconThemeData(color: colors.textPrimary),
        actions: [
          IconButton(
            tooltip: 'Use my location',
            onPressed: _isLocating ? null : _useMyLocation,
            icon: _isLocating
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: _accent),
                  )
                : const Icon(Icons.my_location, color: _accent),
          ),
        ],
      ),
      body: Stack(
        children: [
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _center,
              initialZoom: 13,
              onMapEvent: _onMapEvent,
              onTap: _onMapTapped,
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.prilixor.prilixor_mobile',
              ),
            ],
          ),

          // Fixed center pin — map moves under it (no MarkerLayer rebuild while panning).
          const IgnorePointer(
            child: Center(
              child: Padding(
                padding: EdgeInsets.only(bottom: 36),
                child: Icon(Icons.location_on, size: 48, color: _accent),
              ),
            ),
          ),

          Positioned(
            top: 12,
            left: 12,
            right: 12,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Material(
                  color: colors.surface,
                  elevation: 6,
                  borderRadius: BorderRadius.circular(12),
                  child: TextField(
                    controller: _searchController,
                    style: TextStyle(color: colors.textPrimary),
                    textInputAction: TextInputAction.search,
                    onChanged: _onSearchChanged,
                    onSubmitted: (value) {
                      _placeSearchDebouncer.cancel();
                      final trimmed = value.trim();
                      if (trimmed.length >= 2) _runSearch(trimmed);
                    },
                    decoration: InputDecoration(
                      hintText: 'Search area, landmark, or pincode…',
                      hintStyle: TextStyle(color: colors.textMuted),
                      prefixIcon: const Icon(Icons.search, color: _accent),
                      suffixIcon: _isSearching
                          ? const Padding(
                              padding: EdgeInsets.all(12),
                              child: SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: _accent,
                                ),
                              ),
                            )
                          : (_searchController.text.isNotEmpty
                              ? IconButton(
                                  icon: Icon(Icons.close, color: colors.textMuted, size: 18),
                                  onPressed: () {
                                    _searchController.clear();
                                    setState(() {
                                      _results = [];
                                      _searchError = null;
                                    });
                                  },
                                )
                              : null),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide.none,
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 14,
                      ),
                    ),
                  ),
                ),
                if (_results.isNotEmpty || _searchError != null) ...[
                  const SizedBox(height: 8),
                  Material(
                    color: colors.surface,
                    elevation: 6,
                    borderRadius: BorderRadius.circular(12),
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxHeight: 220),
                      child: _results.isNotEmpty
                          ? ListView.separated(
                              shrinkWrap: true,
                              padding: EdgeInsets.zero,
                              itemCount: _results.length,
                              separatorBuilder: (_, _) => Divider(
                                height: 1,
                                color: colors.border,
                              ),
                              itemBuilder: (context, index) {
                                final result = _results[index];
                                return ListTile(
                                  dense: true,
                                  leading: const Icon(Icons.place_outlined, color: _accent, size: 20),
                                  title: Text(
                                    result.label,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(color: colors.textPrimary, fontSize: 13),
                                  ),
                                  onTap: () => _selectResult(result),
                                );
                              },
                            )
                          : Padding(
                              padding: const EdgeInsets.all(14),
                              child: Text(
                                _searchError!,
                                style: TextStyle(color: colors.textMuted, fontSize: 13),
                              ),
                            ),
                    ),
                  ),
                ],
              ],
            ),
          ),

          Positioned(
            left: 12,
            right: 12,
            bottom: 16 + bottomInset,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Material(
                  color: colors.surface.withValues(alpha: 0.96),
                  borderRadius: BorderRadius.circular(12),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Padding(
                          padding: EdgeInsets.only(top: 2),
                          child: Icon(Icons.place, color: _accent, size: 20),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Move the map or tap to set pin',
                                style: TextStyle(
                                  color: colors.textMuted,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(height: 4),
                              if (_isResolving)
                                Text(
                                  'Finding address…',
                                  style: TextStyle(color: colors.textSecondary, fontSize: 13),
                                )
                              else if (_previewHeadline != null && _previewHeadline!.isNotEmpty)
                                Text(
                                  _previewHeadline!,
                                  maxLines: 3,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    color: colors.textPrimary,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                    height: 1.3,
                                  ),
                                )
                              else
                                Text(
                                  '${_center.latitude.toStringAsFixed(5)}, ${_center.longitude.toStringAsFixed(5)}',
                                  style: TextStyle(color: colors.textSecondary, fontSize: 13),
                                ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _isConfirming ? null : _confirmLocation,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _accent,
                      disabledBackgroundColor: _accent.withValues(alpha: 0.5),
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
              ],
            ),
          ),
        ],
      ),
    );
  }
}
