import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/models/vendor_onboarding_model.dart';
import '../../core/providers/vendor_profile_provider.dart';
import '../../core/utils/device_location.dart';
import '../../core/utils/place_search.dart';
import '../../shared/widgets/required_field_ux.dart';
import '../../shared/widgets/state_city_picker.dart';
import '../../core/providers/vendor_service_area_provider.dart';
import '../../core/theme.dart';
import '../onboarding/onboarding_widgets.dart';
import 'service_area_map_picker.dart';

class ServiceAreasScreen extends StatefulWidget {
  const ServiceAreasScreen({super.key});

  @override
  State<ServiceAreasScreen> createState() => _ServiceAreasScreenState();
}

class _ServiceAreasScreenState extends State<ServiceAreasScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final vendorId = Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    await Provider.of<VendorServiceAreaProvider>(context, listen: false)
        .fetchAreas(vendorId);
  }

  Future<void> _openEditor({VendorServiceArea? area}) async {
    final vendorId = Provider.of<AuthProvider>(context, listen: false).vendorId;
    final profileProvider =
        Provider.of<VendorProfileProvider>(context, listen: false);
    // Profile.state is used to prefill the State picker (areas API has city only).
    if (vendorId != null && profileProvider.profile == null) {
      await profileProvider.fetchProfile(vendorId);
    }
    if (!mounted) return;
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => ServiceAreaEditScreen(existing: area),
      ),
    );
    if (changed == true && mounted) await _load();
  }

  Future<void> _delete(VendorServiceArea area) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.card(context),
        title: const Text('Delete area?', style: TextStyle(color: Colors.white)),
        content: Text(
          'Remove ${area.areaName} (${area.city})?',
          style: TextStyle(color: Colors.white.withValues(alpha: 0.75)),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    final vendorId = Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    final provider = Provider.of<VendorServiceAreaProvider>(context, listen: false);
    final ok = await provider.deleteArea(vendorId, area.id);
    if (!mounted) return;
    if (!ok && provider.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(provider.error!), backgroundColor: Colors.redAccent),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<VendorServiceAreaProvider>(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Service Areas'),
        actions: [
          IconButton(
            tooltip: 'Add service area',
            icon: const Icon(Icons.add),
            onPressed: () => _openEditor(),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: AppTheme.accent,
        onRefresh: _load,
        child: provider.loading && provider.areas.isEmpty
            ? const Center(child: CircularProgressIndicator(color: AppTheme.accent))
            : ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
                children: [
                  _ServiceAreasHeader(count: provider.areas.length),
                  if (provider.error != null && provider.areas.isEmpty) ...[
                    const SizedBox(height: 12),
                    Text(
                      provider.error!,
                      style: const TextStyle(color: Colors.redAccent),
                    ),
                  ],
                  if (provider.areas.isEmpty) ...[
                    const SizedBox(height: 32),
                    Icon(Icons.map_outlined, size: 48, color: Colors.white.withValues(alpha: 0.2)),
                    const SizedBox(height: 12),
                    Text(
                      'No service areas yet',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.55),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Add a zone on the map where you fulfill rentals.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.white.withValues(alpha: 0.4), fontSize: 13),
                    ),
                  ] else ...[
                    const SizedBox(height: 16),
                    ...provider.areas.map(
                      (area) => Padding(
                        padding: const EdgeInsets.only(bottom: 14),
                        child: _ServiceAreaCard(
                          area: area,
                          onTap: () => _openEditor(area: area),
                          onDelete: () => _delete(area),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openEditor(),
        backgroundColor: AppTheme.accent,
        icon: const Icon(Icons.add_location_alt_outlined),
        label: const Text('Add area'),
      ),
    );
  }
}

class _ServiceAreasHeader extends StatelessWidget {
  final int count;

  const _ServiceAreasHeader({required this.count});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppTheme.accent.withValues(alpha: 0.18),
            AppTheme.card(context),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.accent.withValues(alpha: 0.22)),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppTheme.accent.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.map_outlined, color: AppTheme.accent),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Delivery zones',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  count == 0
                      ? 'Place pins for your zones. Coverage radius is set by Admin.'
                      : '$count active ${count == 1 ? 'area' : 'areas'} · radius set by Admin',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.58),
                    fontSize: 12,
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

class _ServiceAreaCard extends StatelessWidget {
  final VendorServiceArea area;
  final VoidCallback onTap;
  final VoidCallback onDelete;

  const _ServiceAreaCard({
    required this.area,
    required this.onTap,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppTheme.card(context),
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ClipRRect(
                borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
                child: ServiceAreaMapPicker(
                  latitude: area.centerLatitude,
                  longitude: area.centerLongitude,
                  radiusKm: area.serviceRadiusKm,
                  showRadius: true,
                  interactive: false,
                  height: 150,
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 12, 8, 14),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            area.areaName,
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                              fontSize: 16,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              Icon(
                                Icons.place_outlined,
                                size: 14,
                                color: Colors.white.withValues(alpha: 0.45),
                              ),
                              const SizedBox(width: 4),
                              Expanded(
                                child: Text(
                                  area.city,
                                  style: TextStyle(
                                    color: Colors.white.withValues(alpha: 0.55),
                                    fontSize: 13,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Wrap(
                            spacing: 8,
                            runSpacing: 6,
                            children: [
                              _InfoChip(
                                icon: Icons.radar,
                                label: '${area.serviceRadiusKm.toStringAsFixed(0)} km radius',
                              ),
                              if (!area.isRadiusSetByAdmin)
                                const _InfoChip(
                                  icon: Icons.pending_actions_outlined,
                                  label: 'Needs Admin review',
                                ),
                              _InfoChip(
                                icon: Icons.pin_drop_outlined,
                                label:
                                    '${area.centerLatitude.toStringAsFixed(4)}, ${area.centerLongitude.toStringAsFixed(4)}',
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      tooltip: 'Edit',
                      onPressed: onTap,
                      icon: const Icon(Icons.edit_outlined, color: AppTheme.accent),
                    ),
                    IconButton(
                      tooltip: 'Delete',
                      onPressed: onDelete,
                      icon: const Icon(Icons.delete_outline, color: Colors.redAccent),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  final IconData icon;
  final String label;

  const _InfoChip({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: Colors.white54),
          const SizedBox(width: 4),
          Text(label, style: const TextStyle(color: Colors.white60, fontSize: 11)),
        ],
      ),
    );
  }
}

class ServiceAreaEditScreen extends StatefulWidget {
  final VendorServiceArea? existing;

  const ServiceAreaEditScreen({super.key, this.existing});

  @override
  State<ServiceAreaEditScreen> createState() => _ServiceAreaEditScreenState();
}

class _ServiceAreaEditScreenState extends State<ServiceAreaEditScreen> {
  late final TextEditingController _nameController;
  late final TextEditingController _stateController;
  late final TextEditingController _cityController;
  late final TextEditingController _latController;
  late final TextEditingController _lngController;
  late double _latitude;
  late double _longitude;
  late double _radius;
  bool _locating = false;
  bool _resolvingAddress = false;
  /// True after user moves pin via search/tap/GPS/manual coords (or when editing existing).
  late bool _pinConfirmed;
  int _stateCityKey = 0;
  final PlaceSearch _placeSearch = PlaceSearch();

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    final profile = Provider.of<VendorProfileProvider>(context, listen: false).profile;
    final defaultLat = e?.centerLatitude ?? profile?.latitude ?? 23.0225;
    final defaultLng = e?.centerLongitude ?? profile?.longitude ?? 72.5714;

    _latitude = defaultLat;
    _longitude = defaultLng;
    _radius = e?.serviceRadiusKm ?? 5;
    _pinConfirmed = e != null;

    _nameController = TextEditingController(text: e?.areaName ?? '');
    // Areas API has no state field — start from profile, then picker reverse-geocodes pin.
    _stateController = TextEditingController(text: profile?.state.trim() ?? '');
    _cityController =
        TextEditingController(text: (e?.city ?? profile?.city ?? '').trim());
    _latController = TextEditingController(text: _latitude.toStringAsFixed(6));
    _lngController = TextEditingController(text: _longitude.toStringAsFixed(6));
  }

  @override
  void dispose() {
    _nameController.dispose();
    _stateController.dispose();
    _cityController.dispose();
    _latController.dispose();
    _lngController.dispose();
    _placeSearch.close();
    super.dispose();
  }

  Future<void> _setLocation(double lat, double lng) async {
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180 || (lat == 0 && lng == 0)) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please set a valid map location.'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    setState(() {
      _latitude = lat;
      _longitude = lng;
      _latController.text = lat.toStringAsFixed(6);
      _lngController.text = lng.toStringAsFixed(6);
      _pinConfirmed = true;
      _resolvingAddress = true;
    });

    final rev = await _placeSearch.reverse(latitude: lat, longitude: lng);
    if (!mounted) return;

    final state = rev?.state?.trim();
    final city = rev?.city?.trim();
    var remountPicker = false;

    if (state != null && state.isNotEmpty) {
      _stateController.text = state;
      remountPicker = true;
    }
    if (city != null && city.isNotEmpty) {
      _cityController.text = city;
      remountPicker = true;
    }
    if (remountPicker) _stateCityKey++;

    setState(() => _resolvingAddress = false);

    final missing = <String>[];
    if (_cityController.text.trim().isEmpty) missing.add('city');
    if (_stateController.text.trim().isEmpty) missing.add('state');

    if (!mounted || missing.isEmpty) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'Map pin saved. Please fill required ${missing.join(', ')}.',
        ),
      ),
    );
  }

  Future<void> _applyManualCoordinates() async {
    final lat = double.tryParse(_latController.text.trim());
    final lng = double.tryParse(_lngController.text.trim());
    if (lat == null || lng == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter valid latitude and longitude.')),
      );
      return;
    }
    await _setLocation(lat, lng);
  }

  Future<void> _useCurrentLocation() async {
    setState(() => _locating = true);
    try {
      final result = await resolveDeviceLocation();
      if (!mounted) return;
      if (!result.ok) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result.errorMessage ?? 'Could not get GPS location.'),
            backgroundColor: Colors.redAccent,
            action: result.shouldOpenSettings
                ? SnackBarAction(
                    label: 'Settings',
                    textColor: Colors.white,
                    onPressed: Geolocator.openAppSettings,
                  )
                : null,
          ),
        );
        return;
      }
      await _setLocation(result.latitude!, result.longitude!);
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Future<void> _save() async {
    if (_nameController.text.trim().isEmpty || _cityController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Area name and city are required.')),
      );
      return;
    }

    if (!_pinConfirmed ||
        _latitude < -90 ||
        _latitude > 90 ||
        _longitude < -180 ||
        _longitude > 180 ||
        (_latitude == 0 && _longitude == 0)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Place the pin on the map (search, tap, GPS, or enter coordinates) before saving. Area name and city alone are not enough.',
          ),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    final vendorId = Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    final provider = Provider.of<VendorServiceAreaProvider>(context, listen: false);
    final ok = await provider.saveArea(
      vendorId: vendorId,
      areaName: _nameController.text,
      city: _cityController.text,
      latitude: _latitude,
      longitude: _longitude,
      radiusKm: _radius,
      serviceAreaId: widget.existing?.id,
    );
    if (!mounted) return;
    if (ok) {
      Navigator.pop(context, true);
    } else if (provider.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(provider.error!), backgroundColor: Colors.redAccent),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final saving = Provider.of<VendorServiceAreaProvider>(context).saving;
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.existing == null ? 'Add service area' : 'Edit service area'),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        children: [
          OnboardingFormSection(
            title: 'Area details',
            subtitle: 'Pick the state first, then the city for this service zone.',
            child: Column(
              children: [
                const RequiredFieldsNote(),
                OnboardingTextField(controller: _nameController, label: 'Area name'),
                StateCityPickerFields(
                  key: ValueKey('service-area-state-city-$_stateCityKey'),
                  stateController: _stateController,
                  cityController: _cityController,
                  initialStateName: _stateController.text,
                  initialCityName: _cityController.text,
                  hintLatitude: _latitude,
                  hintLongitude: _longitude,
                ),
                if (_resolvingAddress)
                  const Padding(
                    padding: EdgeInsets.only(top: 8),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                        SizedBox(width: 8),
                        Text(
                          'Resolving address from pin…',
                          style: TextStyle(color: Colors.white54, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          OnboardingFormSection(
            title: 'Pin on map',
            subtitle:
                'Search, tap the map, or use GPS — pin is required for coverage. Area name/city alone are not enough.',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (!_pinConfirmed)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Text(
                      'Map pin not confirmed yet — move the pin to continue.',
                      style: TextStyle(
                        color: Colors.amber.shade200,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  )
                else
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Text(
                      'Pin set: ${_latitude.toStringAsFixed(4)}, ${_longitude.toStringAsFixed(4)}',
                      style: const TextStyle(
                        color: Color(0xFF34D399),
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                OutlinedButton.icon(
                  onPressed: _locating ? null : _useCurrentLocation,
                  icon: _locating
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.my_location_rounded),
                  label: Text(_locating ? 'Getting location…' : 'Use my current location'),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(44),
                    foregroundColor: AppTheme.accent,
                    side: BorderSide(color: AppTheme.accent.withValues(alpha: 0.45)),
                  ),
                ),
                const SizedBox(height: 12),
                ServiceAreaMapPicker(
                  latitude: _latitude,
                  longitude: _longitude,
                  radiusKm: _radius,
                  showRadius: true,
                  height: 280,
                  onLocationChanged: (point) =>
                      _setLocation(point.latitude, point.longitude),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: OnboardingTextField(
                        controller: _latController,
                        label: 'Latitude',
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        onChanged: (_) {},
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OnboardingTextField(
                        controller: _lngController,
                        label: 'Longitude',
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        onChanged: (_) {},
                      ),
                    ),
                  ],
                ),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton.icon(
                    onPressed: _applyManualCoordinates,
                    icon: const Icon(Icons.sync, size: 16),
                    label: const Text('Apply coordinates to map'),
                  ),
                ),
              ],
            ),
          ),
          OnboardingFormSection(
            title: 'Coverage radius',
            subtitle:
                'Radius is reviewed and set by Admin. You only need to place the pin for this area.',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Service radius', style: TextStyle(color: Colors.white70)),
                    Text(
                      '${_radius.toStringAsFixed(0)} km',
                      style: const TextStyle(
                        color: AppTheme.accent,
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  widget.existing == null
                      ? 'New areas start at a default radius until Admin sets coverage.'
                      : (widget.existing!.isRadiusSetByAdmin
                          ? 'Coverage radius is set by Admin and cannot be changed here.'
                          : 'Default radius — pending Admin review. You cannot change it here.'),
                  style: const TextStyle(color: Colors.white54, fontSize: 12),
                ),
              ],
            ),
          ),
          ElevatedButton(
            onPressed: saving ? null : _save,
            style: ElevatedButton.styleFrom(
              minimumSize: const Size.fromHeight(52),
              backgroundColor: AppTheme.accent,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            child: saving
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Save area', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }
}
