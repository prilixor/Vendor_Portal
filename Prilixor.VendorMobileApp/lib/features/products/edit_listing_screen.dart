import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/models/vendor_catalog_model.dart';
import '../../core/providers/vendor_catalog_provider.dart';
import '../../core/providers/vendor_profile_provider.dart';

/// Edit listing status — catalog name is always the Admin product/chemical name.
class EditListingScreen extends StatefulWidget {
  final String listingId;

  const EditListingScreen({super.key, required this.listingId});

  @override
  State<EditListingScreen> createState() => _EditListingScreenState();
}

class _EditListingScreenState extends State<EditListingScreen> {
  ListingUiStatus _status = ListingUiStatus.inactive;
  bool _initialized = false;

  void _initFromRow(VendorListingRow row) {
    if (_initialized) return;
    _status = row.status;
    _initialized = true;
  }

  Future<void> _save(VendorListingRow row) async {
    final pending =
        Provider.of<VendorProfileProvider>(context, listen: false).isPending;
    if (pending) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Available once your account is approved.'),
        ),
      );
      return;
    }

    final vendorId =
        Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;

    final provider =
        Provider.of<VendorCatalogProvider>(context, listen: false);
    final ok = await provider.updateListing(
      vendorId: vendorId,
      row: row,
      listingTitle: row.productName.trim().isNotEmpty
          ? row.productName.trim()
          : row.listing.listingTitle,
      status: _status,
      availableQuantity: row.listing.availableQuantity,
    );
    if (!mounted) return;
    if (ok) {
      Navigator.of(context).pop(true);
    } else if (provider.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(provider.error!),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  String _statusLabel(ListingUiStatus status) {
    switch (status) {
      case ListingUiStatus.active:
        return 'Active';
      case ListingUiStatus.inactive:
        return 'Inactive';
      case ListingUiStatus.draft:
        return 'Draft';
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<VendorCatalogProvider>(context);
    final row = provider.rowForListing(widget.listingId);
    if (row == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Edit listing')),
        body: const Center(
          child: Text('Listing not found.', style: TextStyle(color: Colors.white54)),
        ),
      );
    }
    _initFromRow(row);

    return Scaffold(
      appBar: AppBar(title: const Text('Edit listing')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _ReadOnlyField(label: 'Category', value: row.categoryName),
          const SizedBox(height: 12),
          _ReadOnlyField(
            label: 'Catalog name (from Admin)',
            value: row.productName.trim().isNotEmpty
                ? row.productName
                : row.listing.listingTitle,
          ),
          const SizedBox(height: 6),
          const Text(
            'Customers always see this Admin product/chemical name.',
            style: TextStyle(color: Colors.white38, fontSize: 11),
          ),
          const SizedBox(height: 16),
          const Text(
            'Status',
            style: TextStyle(color: Colors.white54, fontSize: 13),
          ),
          const SizedBox(height: 8),
          ...ListingUiStatus.values.map(
            (status) => RadioListTile<ListingUiStatus>(
              tileColor: const Color(0xFF1E293B),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
                side: const BorderSide(color: Colors.white12),
              ),
              title: Text(
                _statusLabel(status),
                style: const TextStyle(color: Colors.white),
              ),
              value: status,
              groupValue: _status,
              activeColor: const Color(0xFF6C63FF),
              onChanged: provider.saving
                  ? null
                  : (v) => setState(() => _status = v ?? _status),
            ),
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: provider.saving ? null : () => _save(row),
            style: ElevatedButton.styleFrom(
              minimumSize: const Size.fromHeight(48),
              backgroundColor: const Color(0xFF6C63FF),
            ),
            child: provider.saving
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Save changes'),
          ),
        ],
      ),
    );
  }
}

class _ReadOnlyField extends StatelessWidget {
  final String label;
  final String value;

  const _ReadOnlyField({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.white12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: Colors.white54, fontSize: 12)),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}
