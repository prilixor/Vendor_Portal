import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/providers/address_provider.dart';
import '../../core/models/address_model.dart';
import '../../core/providers/location_provider.dart';
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
    
    String? selectedStateIso2;
    String? selectedCityName = existingAddress?.city;
    double? latitude = existingAddress?.latitude;
    double? longitude = existingAddress?.longitude;

    final locProvider = Provider.of<LocationProvider>(context, listen: false);
    locProvider.fetchStates().then((_) {
      if (existingAddress != null && existingAddress.state.isNotEmpty) {
        try {
          final match = locProvider.states.firstWhere(
            (s) => s.name.toLowerCase() == existingAddress.state.toLowerCase() || s.iso2.toLowerCase() == existingAddress.state.toLowerCase(),
          );
          selectedStateIso2 = match.iso2;
        } catch (_) {
          selectedStateIso2 = existingAddress.state;
        }
        if (selectedStateIso2 != null) {
          locProvider.fetchCities(selectedStateIso2!);
        }
      }
    });

    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1E293B),
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (context, setState) {
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
                        Text(existingAddress == null ? 'Add New Address' : 'Edit Address', style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
                        TextButton.icon(
                          onPressed: () async {
                            final result = await Navigator.push(context, MaterialPageRoute(builder: (_) => const MockMapPickerScreen()));
                            if (result != null && result is Map) {
                              setState(() {
                                latitude = result['latitude'] as double?;
                                longitude = result['longitude'] as double?;
                              });
                            }
                          },
                          icon: const Icon(Icons.map, color: Color(0xFF6C63FF)),
                          label: const Text('Pick on Map', style: TextStyle(color: Color(0xFF6C63FF))),
                        )
                      ],
                    ),
                    if (latitude != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 16.0),
                        child: Text('Map location selected: $latitude, $longitude', style: const TextStyle(color: Colors.green, fontSize: 12)),
                      ),
                    const SizedBox(height: 16),
                    _buildTextField(labelCtrl, 'Label (e.g. Home, Office)'),
                    const SizedBox(height: 12),
                    _buildTextField(streetCtrl, 'Street Address'),
                    const SizedBox(height: 12),
                    
                    // State Dropdown
                    Consumer<LocationProvider>(
                      builder: (context, loc, _) {
                        return GestureDetector(
                          onTap: () {
                            if (loc.states.isEmpty) return;
                            _showPickerSheet(
                              context,
                              title: 'Select State',
                              items: loc.states.map((s) => {'value': s.iso2, 'label': s.name}).toList(),
                              onSelected: (val, label) {
                                setState(() {
                                  selectedStateIso2 = val;
                                  stateCtrl.text = label;
                                  selectedCityName = null;
                                  cityCtrl.clear();
                                });
                                loc.fetchCities(val);
                              },
                            );
                          },
                          child: AbsorbPointer(
                            child: _buildTextField(stateCtrl, 'State', hint: 'Select State'),
                          ),
                        );
                      },
                    ),
                    const SizedBox(height: 12),
                    
                    // City Dropdown
                    Consumer<LocationProvider>(
                      builder: (context, loc, _) {
                        return GestureDetector(
                          onTap: () {
                            if (selectedStateIso2 == null) {
                              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please select a state first')));
                              return;
                            }
                            if (loc.isLoadingCities) return;
                            _showPickerSheet(
                              context,
                              title: 'Select City',
                              items: loc.cities.map((c) => {'value': c.name, 'label': c.name}).toList(),
                              onSelected: (val, label) {
                                setState(() {
                                  selectedCityName = val;
                                  cityCtrl.text = label;
                                });
                              },
                            );
                          },
                          child: AbsorbPointer(
                            child: _buildTextField(cityCtrl, 'City', hint: loc.isLoadingCities ? 'Loading cities...' : 'Select City'),
                          ),
                        );
                      },
                    ),
                    
                    const SizedBox(height: 12),
                    _buildTextField(zipCtrl, 'Postal Code', isNumber: true),
                    const SizedBox(height: 24),
                    SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF6C63FF)),
                        onPressed: () async {
                          if (streetCtrl.text.isEmpty || selectedCityName == null || selectedStateIso2 == null) {
                            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please fill all required fields')));
                            return;
                          }
                          
                          bool success;
                          if (existingAddress == null) {
                            success = await provider.addAddress(
                              label: labelCtrl.text.isNotEmpty ? labelCtrl.text : 'Home',
                              line1: streetCtrl.text,
                              city: cityCtrl.text.isNotEmpty ? cityCtrl.text : selectedCityName!,
                              state: stateCtrl.text.isNotEmpty ? stateCtrl.text : selectedStateIso2!,
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
                              city: cityCtrl.text.isNotEmpty ? cityCtrl.text : selectedCityName!,
                              state: stateCtrl.text.isNotEmpty ? stateCtrl.text : selectedStateIso2!,
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

  Widget _buildTextField(TextEditingController controller, String label, {bool isNumber = false, String? hint}) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white10,
        borderRadius: BorderRadius.circular(8),
      ),
      child: TextFormField(
        controller: controller,
        keyboardType: isNumber ? TextInputType.number : TextInputType.text,
        style: const TextStyle(color: Colors.white),
        decoration: InputDecoration(
          labelText: label,
          hintText: hint,
          labelStyle: const TextStyle(color: Colors.white70),
          hintStyle: const TextStyle(color: Colors.white38),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        ),
      ),
    );
  }

  void _showPickerSheet(BuildContext context, {required String title, required List<Map<String, String>> items, required Function(String, String) onSelected}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF1E293B),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (context) {
        return Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
          child: _PickerSheet(title: title, items: items, onSelected: onSelected),
        );
      },
    );
  }



  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<AddressProvider>(context);

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        title: const Text('Delivery Addresses', style: TextStyle(color: Colors.white)),
        backgroundColor: const Color(0xFF0F172A),
        iconTheme: const IconThemeData(color: Colors.white),
        elevation: 0,
      ),
      body: provider.isLoading && provider.addresses.isEmpty
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF6C63FF)))
          : provider.addresses.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.location_off_outlined, size: 64, color: Colors.white24),
                      const SizedBox(height: 16),
                      const Text('No addresses found.', style: TextStyle(color: Colors.white70, fontSize: 16)),
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
                        color: const Color(0xFF1E293B),
                        borderRadius: BorderRadius.circular(12),
                        border: addr.isDefault ? Border.all(color: const Color(0xFF6C63FF).withValues(alpha: 0.5)) : null,
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: const BoxDecoration(color: Colors.white10, shape: BoxShape.circle),
                            child: const Icon(Icons.location_on, color: Color(0xFF6C63FF)),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Text(addr.label ?? 'Address', style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
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
                                Text('${addr.line1}, ${addr.city}, ${addr.state} ${addr.postal}', style: const TextStyle(color: Colors.white70, fontSize: 14)),
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

class _PickerSheet extends StatefulWidget {
  final String title;
  final List<Map<String, String>> items;
  final Function(String, String) onSelected;

  const _PickerSheet({required this.title, required this.items, required this.onSelected});

  @override
  State<_PickerSheet> createState() => _PickerSheetState();
}

class _PickerSheetState extends State<_PickerSheet> {
  String _searchQuery = '';

  @override
  Widget build(BuildContext context) {
    final filteredItems = widget.items.where((i) => i['label']!.toLowerCase().contains(_searchQuery.toLowerCase())).toList();

    return Container(
      height: MediaQuery.of(context).size.height * 0.6,
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          Text(widget.title, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          TextField(
            style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(
              hintText: 'Search...',
              hintStyle: const TextStyle(color: Colors.white54),
              prefixIcon: const Icon(Icons.search, color: Colors.white54),
              filled: true,
              fillColor: Colors.white10,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            ),
            onChanged: (val) => setState(() => _searchQuery = val),
          ),
          const SizedBox(height: 16),
          Expanded(
            child: ListView.builder(
              itemCount: filteredItems.length,
              itemBuilder: (context, index) {
                final item = filteredItems[index];
                return ListTile(
                  title: Text(item['label']!, style: const TextStyle(color: Colors.white)),
                  onTap: () {
                    widget.onSelected(item['value']!, item['label']!);
                    Navigator.pop(context);
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
