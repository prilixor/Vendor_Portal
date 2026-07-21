import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/providers/vendor_location_provider.dart';
import '../../core/theme.dart';
import '../../core/utils/place_search.dart';
import '../../features/onboarding/onboarding_widgets.dart';

/// State → City dependent pickers (Vendor Web parity: `/vendors/locations/states`).
class StateCityPickerFields extends StatefulWidget {
  final TextEditingController stateController;
  final TextEditingController cityController;
  final String? initialStateName;
  final String? initialCityName;
  final String? stateError;
  final String? cityError;
  final bool stateFirst;

  /// When state is missing (e.g. service area only stores city), reverse-geocode pin.
  final double? hintLatitude;
  final double? hintLongitude;

  const StateCityPickerFields({
    super.key,
    required this.stateController,
    required this.cityController,
    this.initialStateName,
    this.initialCityName,
    this.stateError,
    this.cityError,
    this.stateFirst = true,
    this.hintLatitude,
    this.hintLongitude,
  });

  @override
  State<StateCityPickerFields> createState() => _StateCityPickerFieldsState();
}

class _StateCityPickerFieldsState extends State<StateCityPickerFields> {
  String? _selectedStateIso2;
  bool _bootstrapped = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _bootstrap());
  }

  Future<void> _bootstrap() async {
    if (_bootstrapped) return;
    _bootstrapped = true;
    final loc = Provider.of<VendorLocationProvider>(context, listen: false);
    var stateName =
        (widget.initialStateName ?? widget.stateController.text).trim();
    var cityName =
        (widget.initialCityName ?? widget.cityController.text).trim();

    // Service areas API stores city only — recover state from pin / city lookup.
    if (stateName.isEmpty &&
        widget.hintLatitude != null &&
        widget.hintLongitude != null) {
      final search = PlaceSearch();
      try {
        final rev = await search.reverse(
          latitude: widget.hintLatitude!,
          longitude: widget.hintLongitude!,
        );
        if (rev?.state != null && rev!.state!.isNotEmpty) {
          stateName = rev.state!;
          widget.stateController.text = stateName;
        }
        if (cityName.isEmpty && rev?.city != null && rev!.city!.isNotEmpty) {
          cityName = rev.city!;
          widget.cityController.text = cityName;
        }
      } finally {
        search.close();
      }
    }

    // Fallback: geocode the city name, then reverse the top hit for state.
    if (stateName.isEmpty && cityName.isNotEmpty) {
      final search = PlaceSearch();
      try {
        final hits = await search.search(
          query: cityName,
          latitude: widget.hintLatitude ?? 23.0,
          longitude: widget.hintLongitude ?? 72.5,
          limit: 3,
        );
        if (hits.isNotEmpty) {
          final rev = await search.reverse(
            latitude: hits.first.lat,
            longitude: hits.first.lng,
          );
          if (rev?.state != null && rev!.state!.isNotEmpty) {
            stateName = rev.state!;
            widget.stateController.text = stateName;
          }
        }
      } finally {
        search.close();
      }
    }

    if (stateName.isEmpty) {
      await loc.fetchStates();
      if (mounted) setState(() {});
      return;
    }

    // Keep controller in sync (hint text alone does not paint the field value).
    if (widget.stateController.text.trim().isEmpty) {
      widget.stateController.text = stateName;
    }
    if (cityName.isNotEmpty && widget.cityController.text.trim().isEmpty) {
      widget.cityController.text = cityName;
    }

    final iso2 = await loc.bootstrapSelection(
      stateName: stateName,
      cityName: cityName,
    );
    if (!mounted) return;
    setState(() => _selectedStateIso2 = iso2);
  }

  Future<void> _pickState(VendorLocationProvider loc) async {
    if (loc.states.isEmpty) {
      await loc.fetchStates();
    }
    if (!mounted || loc.states.isEmpty) return;
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppTheme.card(context),
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => _LocationPickerSheet(
        title: 'Select state',
        items: loc.states.map((s) => (value: s.iso2, label: s.name)).toList(),
        onSelected: (value, label) {
          setState(() {
            _selectedStateIso2 = value;
            widget.stateController.text = label;
            widget.cityController.clear();
          });
          loc.fetchCities(value);
        },
      ),
    );
  }

  Future<void> _pickCity(VendorLocationProvider loc) async {
    if (_selectedStateIso2 == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a state first.')),
      );
      return;
    }
    if (loc.isLoadingCities) return;
    if (loc.cities.isEmpty) {
      await loc.fetchCities(_selectedStateIso2!);
    }
    if (!mounted || loc.cities.isEmpty) {
      if (mounted && !loc.isLoadingCities) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No cities found for this state.')),
        );
      }
      return;
    }
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppTheme.card(context),
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => _LocationPickerSheet(
        title: 'Select city',
        items: loc.cities.map((c) => (value: c.name, label: c.name)).toList(),
        onSelected: (value, label) {
          widget.cityController.text = label;
          setState(() {});
        },
      ),
    );
  }

  Widget _stateField(VendorLocationProvider loc) {
    return GestureDetector(
      onTap: () => _pickState(loc),
      child: AbsorbPointer(
        child: OnboardingTextField(
          controller: widget.stateController,
          label: 'State',
          hint: loc.isLoadingStates ? 'Loading states…' : 'Select state',
          suffix: loc.isLoadingStates
              ? const Padding(
                  padding: EdgeInsets.all(12),
                  child: SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.accent),
                  ),
                )
              : const Icon(Icons.expand_more_rounded, color: AppTheme.accent),
        ),
      ),
    );
  }

  Widget _cityField(VendorLocationProvider loc) {
    final disabled = _selectedStateIso2 == null;
    return GestureDetector(
      onTap: disabled ? null : () => _pickCity(loc),
      child: AbsorbPointer(
        child: OnboardingTextField(
          controller: widget.cityController,
          label: 'City',
          enabled: !disabled,
          hint: disabled
              ? 'Select state first'
              : loc.isLoadingCities
                  ? 'Loading cities…'
                  : 'Select city',
          suffix: loc.isLoadingCities
              ? const Padding(
                  padding: EdgeInsets.all(12),
                  child: SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.accent),
                  ),
                )
              : Icon(
                  Icons.expand_more_rounded,
                  color: disabled ? Colors.white24 : AppTheme.accent,
                ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<VendorLocationProvider>(
      builder: (context, loc, _) {
        final fields = widget.stateFirst
            ? [_stateField(loc), _cityField(loc)]
            : [_cityField(loc), _stateField(loc)];

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (loc.errorMessage != null) ...[
              OnboardingHintBanner(
                icon: Icons.error_outline,
                message: loc.errorMessage!,
              ),
            ],
            ...fields,
            if (widget.stateError != null)
              _FieldErrorText(widget.stateError!),
            if (widget.cityError != null)
              _FieldErrorText(widget.cityError!),
          ],
        );
      },
    );
  }
}

class _FieldErrorText extends StatelessWidget {
  final String message;

  const _FieldErrorText(this.message);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        message,
        style: const TextStyle(color: Colors.redAccent, fontSize: 12),
      ),
    );
  }
}

class _LocationPickerSheet extends StatefulWidget {
  final String title;
  final List<({String value, String label})> items;
  final void Function(String value, String label) onSelected;

  const _LocationPickerSheet({
    required this.title,
    required this.items,
    required this.onSelected,
  });

  @override
  State<_LocationPickerSheet> createState() => _LocationPickerSheetState();
}

class _LocationPickerSheetState extends State<_LocationPickerSheet> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final filtered = widget.items
        .where((item) => item.label.toLowerCase().contains(_query.toLowerCase()))
        .toList();

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.62,
        child: Column(
          children: [
            const SizedBox(height: 8),
            Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 12, 8),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      widget.title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close, color: Colors.white54),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextField(
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  hintText: 'Search…',
                  hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.35)),
                  prefixIcon: const Icon(Icons.search_rounded, color: AppTheme.accent),
                  filled: true,
                  fillColor: AppTheme.bg(context),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide.none,
                  ),
                ),
                onChanged: (v) => setState(() => _query = v),
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: filtered.isEmpty
                  ? Center(
                      child: Text(
                        'No matches',
                        style: TextStyle(color: Colors.white.withValues(alpha: 0.5)),
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(8, 0, 8, 16),
                      itemCount: filtered.length,
                      separatorBuilder: (context, index) => Divider(
                        height: 1,
                        color: Colors.white.withValues(alpha: 0.06),
                      ),
                      itemBuilder: (context, index) {
                        final item = filtered[index];
                        return ListTile(
                          title: Text(
                            item.label,
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          onTap: () {
                            widget.onSelected(item.value, item.label);
                            Navigator.pop(context);
                          },
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
