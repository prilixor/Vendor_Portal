import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/providers/location_provider.dart';
import '../../core/theme.dart';
import '../../shared/widgets/required_field_ux.dart';

/// State → City dependent pickers (same API as Vendor Web onboarding).
class StateCityPickerFields extends StatefulWidget {
  final TextEditingController stateController;
  final TextEditingController cityController;
  final String? initialStateName;
  final String? initialCityName;
  final String? stateError;
  final String? cityError;

  const StateCityPickerFields({
    super.key,
    required this.stateController,
    required this.cityController,
    this.initialStateName,
    this.initialCityName,
    this.stateError,
    this.cityError,
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
    final loc = Provider.of<LocationProvider>(context, listen: false);
    final stateName = widget.initialStateName ?? widget.stateController.text;
    final cityName = widget.initialCityName ?? widget.cityController.text;
    if (stateName.trim().isEmpty) {
      await loc.fetchStates();
      if (mounted) setState(() {});
      return;
    }
    final iso2 = await loc.bootstrapSelection(
      stateName: stateName,
      cityName: cityName,
    );
    if (!mounted) return;
    setState(() => _selectedStateIso2 = iso2);
  }

  Future<void> _pickState(LocationProvider loc) async {
    if (loc.states.isEmpty) await loc.fetchStates();
    if (!mounted || loc.states.isEmpty) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: context.appColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
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

  Future<void> _pickCity(LocationProvider loc) async {
    if (_selectedStateIso2 == null) {
      showRequiredFieldsBlocked(context, message: 'Please select a state first.');
      return;
    }
    if (loc.isLoadingCities) return;
    if (loc.cities.isEmpty) await loc.fetchCities(_selectedStateIso2!);
    if (!mounted || loc.cities.isEmpty) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: context.appColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
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

  Widget _field({
    required TextEditingController controller,
    required String label,
    required String hint,
    required VoidCallback? onTap,
    required Widget? suffix,
    String? errorText,
    bool enabled = true,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: AbsorbPointer(
        child: TextFormField(
          controller: controller,
          enabled: enabled,
          style: TextStyle(color: context.appColors.textPrimary),
          decoration: requiredInputDecoration(
            context,
            label: label,
            required: true,
            hintText: hint,
            errorText: errorText,
            fillColor: context.appColors.background,
            suffixIcon: suffix,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<LocationProvider>(
      builder: (context, loc, _) {
        return Column(
          children: [
            if (loc.errorMessage != null) ...[
              Container(
                width: double.infinity,
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.redAccent.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.redAccent.withValues(alpha: 0.25)),
                ),
                child: Text(
                  loc.errorMessage!,
                  style: const TextStyle(color: Colors.redAccent, fontSize: 12),
                ),
              ),
            ],
            _field(
              controller: widget.stateController,
              label: 'State',
              hint: loc.isLoadingStates ? 'Loading states…' : 'Select state',
              onTap: () => _pickState(loc),
              errorText: widget.stateError,
              suffix: loc.isLoadingStates
                  ? const Padding(
                      padding: EdgeInsets.all(12),
                      child: SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF6C63FF)),
                      ),
                    )
                  : const Icon(Icons.expand_more_rounded, color: Color(0xFF6C63FF)),
            ),
            const SizedBox(height: 12),
            _field(
              controller: widget.cityController,
              label: 'City',
              hint: _selectedStateIso2 == null
                  ? 'Select state first'
                  : loc.isLoadingCities
                      ? 'Loading cities…'
                      : 'Select city',
              onTap: _selectedStateIso2 == null ? null : () => _pickCity(loc),
              errorText: widget.cityError,
              enabled: _selectedStateIso2 != null,
              suffix: loc.isLoadingCities
                  ? const Padding(
                      padding: EdgeInsets.all(12),
                      child: SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF6C63FF)),
                      ),
                    )
                  : Icon(
                      Icons.expand_more_rounded,
                      color: _selectedStateIso2 == null ? context.appColors.textMuted : const Color(0xFF6C63FF),
                    ),
            ),
          ],
        );
      },
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
    final colors = context.appColors;
    final filtered = widget.items
        .where((item) => item.label.toLowerCase().contains(_query.toLowerCase()))
        .toList();

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.62,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Text(
                widget.title,
                style: TextStyle(color: colors.textPrimary, fontSize: 18, fontWeight: FontWeight.bold),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextField(
                style: TextStyle(color: colors.textPrimary),
                decoration: InputDecoration(
                  hintText: 'Search…',
                  hintStyle: TextStyle(color: colors.textMuted),
                  prefixIcon: Icon(Icons.search, color: colors.textMuted),
                  filled: true,
                  fillColor: colors.background,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide.none,
                  ),
                ),
                onChanged: (v) => setState(() => _query = v),
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: ListView.builder(
                itemCount: filtered.length,
                itemBuilder: (context, index) {
                  final item = filtered[index];
                  return ListTile(
                    title: Text(item.label, style: TextStyle(color: colors.textPrimary)),
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
