import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../core/theme.dart';
import '../../core/utils/debouncer.dart';
import '../../core/utils/place_search.dart';

class ServiceAreaMapPicker extends StatefulWidget {
  final double latitude;
  final double longitude;
  final double radiusKm;
  final ValueChanged<LatLng>? onLocationChanged;
  final bool showRadius;
  final bool interactive;
  final double height;

  const ServiceAreaMapPicker({
    super.key,
    required this.latitude,
    required this.longitude,
    this.radiusKm = 5,
    this.onLocationChanged,
    this.showRadius = true,
    this.interactive = true,
    this.height = 260,
  });

  @override
  State<ServiceAreaMapPicker> createState() => _ServiceAreaMapPickerState();
}

class _ServiceAreaMapPickerState extends State<ServiceAreaMapPicker> {
  final MapController _mapController = MapController();
  final TextEditingController _searchController = TextEditingController();
  final PlaceSearch _placeSearch = PlaceSearch();

  final Debouncer _placeSearchDebouncer = Debouncer(duration: placeSearchDebounce);
  bool _searching = false;
  List<PlaceSearchResult> _results = [];
  String? _searchError;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _syncMapView());
  }

  @override
  void didUpdateWidget(covariant ServiceAreaMapPicker oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.latitude != widget.latitude ||
        oldWidget.longitude != widget.longitude) {
      _syncMapView();
    }
  }

  @override
  void dispose() {
    _placeSearchDebouncer.dispose();
    _searchController.dispose();
    _placeSearch.close();
    super.dispose();
  }

  LatLng get _center => LatLng(widget.latitude, widget.longitude);

  void _syncMapView() {
    if (!mounted) return;
    final zoom = _mapController.camera.zoom;
    _mapController.move(_center, zoom == 0 ? 13 : zoom);
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
      _searching = true;
      _searchError = null;
    });
    try {
      final parsed = await _placeSearch.search(
        query: query,
        latitude: widget.latitude,
        longitude: widget.longitude,
        limit: 10,
      );
      if (!mounted) return;
      setState(() {
        _results = parsed;
        _searchError = parsed.isEmpty ? 'No matching areas found.' : null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _results = [];
        _searchError = 'Unable to search right now.';
      });
    } finally {
      if (mounted) setState(() => _searching = false);
    }
  }

  void _selectResult(PlaceSearchResult result) {
    widget.onLocationChanged?.call(LatLng(result.lat, result.lng));
    _searchController.text = result.label;
    setState(() {
      _results = [];
      _searchError = null;
    });
    FocusScope.of(context).unfocus();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (widget.interactive) ...[
          TextField(
            controller: _searchController,
            style: TextStyle(color: context.appColors.textPrimary),
            textInputAction: TextInputAction.search,
            onChanged: _onSearchChanged,
            onSubmitted: (value) {
              _placeSearchDebouncer.cancel();
              final trimmed = value.trim();
              if (trimmed.length >= 2) {
                _runSearch(trimmed);
              }
            },
            decoration: InputDecoration(
              hintText: 'Search area, landmark, shop or address',
              hintStyle: TextStyle(color: context.appColors.textMuted),
              prefixIcon: const Icon(Icons.search, color: AppTheme.accent),
              suffixIcon: _searching
                  ? const Padding(
                      padding: EdgeInsets.all(12),
                      child: SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppTheme.accent,
                        ),
                      ),
                    )
                  : null,
              filled: true,
              fillColor: AppTheme.bg(context),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: context.appColors.border),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: context.appColors.border),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: AppTheme.accent),
              ),
            ),
          ),
          if (_results.isNotEmpty || _searchError != null) ...[
            const SizedBox(height: 8),
            Container(
              constraints: const BoxConstraints(maxHeight: 160),
              decoration: BoxDecoration(
                color: AppTheme.card(context),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: context.appColors.border),
              ),
              child: _results.isNotEmpty
                  ? ListView.separated(
                      shrinkWrap: true,
                      itemCount: _results.length,
                      separatorBuilder: (context, index) => Divider(
                        height: 1,
                        color: context.appColors.border,
                      ),
                      itemBuilder: (context, index) {
                        final result = _results[index];
                        return ListTile(
                          dense: true,
                          title: Text(
                            result.label,
                            style: TextStyle(color: context.appColors.textPrimary, fontSize: 13),
                          ),
                          onTap: () => _selectResult(result),
                        );
                      },
                    )
                  : Padding(
                      padding: const EdgeInsets.all(12),
                      child: Text(
                        _searchError!,
                        style: TextStyle(
                          color: context.appColors.textMuted,
                          fontSize: 12,
                        ),
                      ),
                    ),
            ),
          ],
          const SizedBox(height: 12),
        ],
        ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: SizedBox(
            height: widget.height,
            child: Stack(
              children: [
                FlutterMap(
                  mapController: _mapController,
                  options: MapOptions(
                    initialCenter: _center,
                    initialZoom: 13,
                    interactionOptions: InteractionOptions(
                      flags: widget.interactive
                          ? InteractiveFlag.all
                          : InteractiveFlag.none,
                    ),
                    onTap: widget.interactive && widget.onLocationChanged != null
                        ? (_, point) {
                            widget.onLocationChanged!(point);
                          }
                        : null,
                  ),
                  children: [
                    TileLayer(
                      urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'com.prilixor.vendor',
                    ),
                    if (widget.showRadius)
                      CircleLayer(
                        circles: [
                          CircleMarker(
                            point: _center,
                            radius: widget.radiusKm * 1000,
                            useRadiusInMeter: true,
                            color: AppTheme.accent.withValues(alpha: 0.18),
                            borderColor: AppTheme.accent.withValues(alpha: 0.75),
                            borderStrokeWidth: 2,
                          ),
                        ],
                      ),
                    MarkerLayer(
                      markers: [
                        Marker(
                          point: _center,
                          width: 42,
                          height: 42,
                          child: const Icon(
                            Icons.location_on,
                            color: AppTheme.accent,
                            size: 42,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                Positioned(
                  left: 10,
                  bottom: 10,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppTheme.card(context).withValues(alpha: 0.92),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: context.appColors.border),
                    ),
                    child: Text(
                      '${widget.latitude.toStringAsFixed(4)}, ${widget.longitude.toStringAsFixed(4)}',
                      style: TextStyle(color: context.appColors.textPrimary, fontSize: 11),
                    ),
                  ),
                ),
                if (widget.interactive)
                  Positioned(
                    right: 10,
                    top: 10,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppTheme.card(context).withValues(alpha: 0.92),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: context.appColors.border),
                      ),
                      child: Text(
                        'Tap map to move pin',
                        style: TextStyle(
                          color: context.appColors.textSecondary,
                          fontSize: 10,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
