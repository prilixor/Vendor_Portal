import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/providers/address_provider.dart';
import '../../core/models/address_model.dart';
import '../../core/theme.dart';
import '../../shared/widgets/required_field_ux.dart';
import '../../shared/widgets/state_city_picker.dart';
import 'mock_map_picker_screen.dart';

class AddressesScreen extends StatefulWidget {
  const AddressesScreen({super.key});

  @override
  State<AddressesScreen> createState() => _AddressesScreenState();
}

class _AddressesScreenState extends State<AddressesScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<AddressProvider>(context, listen: false).fetchAddresses();
    });
  }

  void _showAddAddressSheet(BuildContext context, AddressProvider provider, {AddressModel? existingAddress}) {
    final labelCtrl = TextEditingController(text: existingAddress?.label ?? (existingAddress != null ? 'Address' : ''));
    final streetCtrl = TextEditingController(text: existingAddress?.line1 ?? '');
    final zipCtrl = TextEditingController(text: existingAddress?.postal ?? '');

    final stateCtrl = TextEditingController(text: existingAddress?.state ?? '');
    final cityCtrl = TextEditingController(text: existingAddress?.city ?? '');

    double? latitude = existingAddress?.latitude;
    double? longitude = existingAddress?.longitude;
    final hasExistingPin = latitude != null &&
        longitude != null &&
        !(latitude == 0 && longitude == 0);
    var pinConfirmed = hasExistingPin;
    // Remount State→City pickers when map fills new state/city values.
    int stateCityKey = 0;
    String? line1Error;
    String? stateError;
    String? cityError;
    String? postalError;
    String? locationError;

    void applyMapResult(Map result, void Function(void Function()) setState) {
      final nextLat = (result['latitude'] as num?)?.toDouble();
      final nextLng = (result['longitude'] as num?)?.toDouble();
      if (nextLat == null ||
          nextLng == null ||
          (nextLat == 0 && nextLng == 0)) {
        return;
      }
      latitude = nextLat;
      longitude = nextLng;
      pinConfirmed = true;
      locationError = null;

      final subLocality = (result['subLocality'] as String?)?.trim() ?? '';
      final locality = (result['locality'] as String?)?.trim() ?? '';
      final administrativeArea = (result['administrativeArea'] as String?)?.trim() ?? '';
      final postalCode = (result['postalCode'] as String?)?.trim() ?? '';
      final addressLine = (result['addressLine'] as String?)?.trim() ?? '';

      final parts = <String>[];
      if (subLocality.isNotEmpty) parts.add(subLocality);
      if (locality.isNotEmpty) parts.add(locality);
      final derivedStreet = parts.isNotEmpty ? parts.join(', ') : addressLine;
      if (derivedStreet.isNotEmpty) {
        streetCtrl.text = derivedStreet;
        line1Error = null;
      }
      if (administrativeArea.isNotEmpty) {
        stateCtrl.text = administrativeArea;
        stateError = null;
      }
      if (locality.isNotEmpty) {
        cityCtrl.text = locality;
        cityError = null;
      }
      if (postalCode.isNotEmpty) {
        zipCtrl.text = postalCode;
        postalError = null;
      }
      stateCityKey++;
      setState(() {});

      final missing = <String>[];
      if (streetCtrl.text.trim().isEmpty) missing.add('address line');
      if (stateCtrl.text.trim().isEmpty) missing.add('state');
      if (cityCtrl.text.trim().isEmpty) missing.add('city');
      if (zipCtrl.text.trim().isEmpty) missing.add('postal code');
      if (missing.isNotEmpty && context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Map pin saved. Please fill required ${missing.join(', ')}.',
            ),
          ),
        );
      }
    }

    showModalBottomSheet(
      context: context,
      backgroundColor: context.appColors.surface,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (context, setState) {
            final colors = context.appColors;
            return Padding(
              padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom, left: 24, right: 24, top: 24),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(existingAddress == null ? 'Add New Address' : 'Edit Address', style: TextStyle(color: colors.textPrimary, fontSize: 20, fontWeight: FontWeight.bold)),
                        TextButton.icon(
                          onPressed: () async {
                            final result = await Navigator.push(
                              context,
                              MaterialPageRoute(builder: (_) => const MockMapPickerScreen()),
                            );
                            if (result != null && result is Map) {
                              applyMapResult(Map<String, dynamic>.from(result), setState);
                            }
                          },
                          icon: const Icon(Icons.map, color: Color(0xFF6C63FF)),
                          label: const Text('Pick on Map', style: TextStyle(color: Color(0xFF6C63FF))),
                        )
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Address text alone is not enough. Use Pick on Map to set delivery coordinates.',
                      style: TextStyle(color: colors.textMuted, fontSize: 12),
                    ),
                    if (pinConfirmed && latitude != null && longitude != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 8.0),
                        child: Text(
                          'Pin set: ${latitude!.toStringAsFixed(4)}, ${longitude!.toStringAsFixed(4)}',
                          style: const TextStyle(color: Color(0xFF34D399), fontSize: 12, fontWeight: FontWeight.w600),
                        ),
                      )
                    else
                      const Padding(
                        padding: EdgeInsets.only(top: 8.0),
                        child: Text(
                          'Map pin not confirmed yet — tap Pick on Map to continue.',
                          style: TextStyle(color: Color(0xFFFBBF24), fontSize: 12, fontWeight: FontWeight.w600),
                        ),
                      ),
                    if (locationError != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text(locationError!, style: const TextStyle(color: Colors.redAccent, fontSize: 12)),
                      ),
                    const RequiredFieldsNote(padding: EdgeInsets.only(top: 8, bottom: 12)),
                    _buildTextField(labelCtrl, 'Label (optional)'),
                    const SizedBox(height: 12),
                    _buildTextField(
                      streetCtrl,
                      'Address line',
                      required: true,
                      errorText: line1Error,
                      onChanged: (_) {
                        if (line1Error != null) setState(() => line1Error = null);
                      },
                    ),
                    const SizedBox(height: 12),
                    StateCityPickerFields(
                      key: ValueKey('state-city-$stateCityKey-${stateCtrl.text}-${cityCtrl.text}'),
                      stateController: stateCtrl,
                      cityController: cityCtrl,
                      initialStateName: stateCtrl.text.trim().isNotEmpty ? stateCtrl.text : existingAddress?.state,
                      initialCityName: cityCtrl.text.trim().isNotEmpty ? cityCtrl.text : existingAddress?.city,
                      stateError: stateError,
                      cityError: cityError,
                    ),
                    const SizedBox(height: 12),
                    _buildTextField(
                      zipCtrl,
                      'Postal Code',
                      required: true,
                      isNumber: true,
                      errorText: postalError,
                      onChanged: (_) {
                        if (postalError != null) setState(() => postalError = null);
                      },
                    ),
                    const SizedBox(height: 24),
                    SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF6C63FF)),
                        onPressed: () async {
                          final l1 = requiredMessage(streetCtrl.text, message: 'Address line is required');
                          final st = requiredMessage(stateCtrl.text, message: 'State is required');
                          final ct = requiredMessage(cityCtrl.text, message: 'City is required');
                          final zip = requiredMessage(zipCtrl.text, message: 'Postal code is required');
                          final loc = (!pinConfirmed ||
                                  latitude == null ||
                                  longitude == null ||
                                  (latitude == 0 && longitude == 0))
                              ? 'Place the pin on the map before saving. Address text alone is not enough for delivery.'
                              : null;
                          setState(() {
                            line1Error = l1;
                            stateError = st;
                            cityError = ct;
                            postalError = zip;
                            locationError = loc;
                          });
                          if (l1 != null || st != null || ct != null || zip != null || loc != null) {
                            if (loc != null) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text(loc), backgroundColor: Colors.redAccent),
                              );
                            } else {
                              showRequiredFieldsBlocked(context);
                            }
                            return;
                          }

                          final bool success;
                          if (existingAddress == null) {
                            success = await provider.addAddress(
                              label: labelCtrl.text.isNotEmpty ? labelCtrl.text : 'Home',
                              line1: streetCtrl.text,
                              city: cityCtrl.text.trim(),
                              state: stateCtrl.text.trim(),
                              postal: zipCtrl.text,
                              latitude: latitude,
                              longitude: longitude,
                              setAsDefault: provider.addresses.isEmpty,
                            );
                          } else {
                            success = await provider.updateAddress(
                              existingAddress.id,
                              label: labelCtrl.text.isNotEmpty ? labelCtrl.text : 'Home',
                              line1: streetCtrl.text,
                              city: cityCtrl.text.trim(),
                              state: stateCtrl.text.trim(),
                              postal: zipCtrl.text,
                              latitude: latitude,
                              longitude: longitude,
                              setAsDefault: existingAddress.isDefault,
                            );
                          }

                          if (success && context.mounted) {
                            Navigator.pop(context);
                          } else if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(provider.errorMessage ?? 'Failed')));
                          }
                        },
                        child: Text(existingAddress == null ? 'Save Address' : 'Update Address', style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildTextField(
    TextEditingController controller,
    String label, {
    bool isNumber = false,
    String? hint,
    bool required = false,
    String? errorText,
    ValueChanged<String>? onChanged,
  }) {
    final colors = context.appColors;
    return TextFormField(
      controller: controller,
      keyboardType: isNumber ? TextInputType.number : TextInputType.text,
      style: TextStyle(color: colors.textPrimary),
      onChanged: onChanged,
      decoration: requiredInputDecoration(
        context,
        label: label,
        required: required,
        hintText: hint,
        errorText: errorText,
        fillColor: colors.background,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<AddressProvider>(context);
    final colors = context.appColors;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        title: Text('Delivery Addresses', style: TextStyle(color: colors.textPrimary)),
        backgroundColor: colors.background,
        iconTheme: IconThemeData(color: colors.textPrimary),
        elevation: 0,
      ),
      body: provider.isLoading && provider.addresses.isEmpty
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF6C63FF)))
          : provider.addresses.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.location_off_outlined, size: 64, color: colors.textMuted),
                      const SizedBox(height: 16),
                      Text('No addresses found.', style: TextStyle(color: colors.textSecondary, fontSize: 16)),
                      const SizedBox(height: 24),
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF6C63FF)),
                        onPressed: () => _showAddAddressSheet(context, provider),
                        child: const Text('Add Address', style: TextStyle(color: Colors.white)),
                      ),
                    ],
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: provider.addresses.length,
                  separatorBuilder: (context, index) => const SizedBox(height: 12),
                  itemBuilder: (context, index) {
                    final addr = provider.addresses[index];
                    return Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: colors.surface,
                        borderRadius: BorderRadius.circular(12),
                        border: addr.isDefault ? Border.all(color: const Color(0xFF6C63FF).withValues(alpha: 0.5)) : Border.all(color: colors.border),
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(color: colors.surfaceElevated, shape: BoxShape.circle),
                            child: const Icon(Icons.location_on, color: Color(0xFF6C63FF)),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Text(addr.label ?? 'Address', style: TextStyle(color: colors.textPrimary, fontSize: 16, fontWeight: FontWeight.bold)),
                                    if (addr.isDefault) ...[
                                      const SizedBox(width: 8),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                        decoration: BoxDecoration(color: const Color(0xFF6C63FF).withValues(alpha: 0.2), borderRadius: BorderRadius.circular(4)),
                                        child: const Text('DEFAULT', style: TextStyle(color: Color(0xFF6C63FF), fontSize: 10, fontWeight: FontWeight.bold)),
                                      ),
                                    ],
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Text('${addr.line1}, ${addr.city}, ${addr.state} ${addr.postal}', style: TextStyle(color: colors.textSecondary, fontSize: 14)),
                              ],
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.edit_outlined, color: Colors.blueAccent),
                            onPressed: () => _showAddAddressSheet(context, provider, existingAddress: addr),
                          ),
                          IconButton(
                            icon: const Icon(Icons.delete_outline, color: Colors.redAccent),
                            onPressed: () => provider.deleteAddress(addr.id),
                          ),
                        ],
                      ),
                    );
                  },
                ),
      floatingActionButton: provider.addresses.isNotEmpty
          ? FloatingActionButton(
              backgroundColor: const Color(0xFF6C63FF),
              onPressed: () => _showAddAddressSheet(context, provider),
              child: const Icon(Icons.add, color: Colors.white),
            )
          : null,
    );
  }
}
