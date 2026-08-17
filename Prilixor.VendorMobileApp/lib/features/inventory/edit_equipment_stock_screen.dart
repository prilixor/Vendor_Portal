import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/models/vendor_catalog_model.dart';
import '../../core/providers/vendor_catalog_provider.dart';
import '../../core/providers/vendor_profile_provider.dart';
import '../../core/theme.dart';

class EditEquipmentStockScreen extends StatefulWidget {
  final String listingId;

  const EditEquipmentStockScreen({super.key, required this.listingId});

  @override
  State<EditEquipmentStockScreen> createState() =>
      _EditEquipmentStockScreenState();
}

class _EditEquipmentStockScreenState extends State<EditEquipmentStockScreen> {
  final _totalController = TextEditingController();
  final _reservedController = TextEditingController();
  final _rentedController = TextEditingController();
  final _blockedController = TextEditingController();
  bool _initialized = false;

  @override
  void dispose() {
    _totalController.dispose();
    _reservedController.dispose();
    _rentedController.dispose();
    _blockedController.dispose();
    super.dispose();
  }

  void _initFromRecord(InventoryRecord record) {
    if (_initialized) return;
    _totalController.text = '${record.total}';
    _reservedController.text = '${record.reserved}';
    _rentedController.text = '${record.rented}';
    _blockedController.text = '${record.blocked}';
    _initialized = true;
  }

  int _parse(TextEditingController c) =>
      int.tryParse(c.text.trim()) ?? 0;

  Future<void> _save(InventoryRecord record) async {
    final pending =
        Provider.of<VendorProfileProvider>(context, listen: false).isPending;
    if (pending) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Account pending approval — stock changes are disabled.'),
        ),
      );
      return;
    }

    final vendorId =
        Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;

    final provider =
        Provider.of<VendorCatalogProvider>(context, listen: false);
    final ok = await provider.upsertEquipmentInventory(
      vendorId: vendorId,
      listingId: widget.listingId,
      previous: record,
      total: _parse(_totalController),
      reserved: _parse(_reservedController),
      rented: _parse(_rentedController),
      blocked: _parse(_blockedController),
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

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<VendorCatalogProvider>(context);
    final record = provider.inventoryForListing(widget.listingId);
    if (record == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Edit stock')),
        body: Center(
          child: Text('Record not found.', style: TextStyle(color: context.appColors.textMuted)),
        ),
      );
    }
    _initFromRecord(record);

    return Scaffold(
      appBar: AppBar(title: const Text('Edit stock')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            record.productName,
            style: TextStyle(
              color: context.appColors.textPrimary,
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Adjust total, reserved, rented, and blocked counts. Available is calculated automatically.',
            style: TextStyle(color: context.appColors.textSecondary, fontSize: 13),
          ),
          const SizedBox(height: 16),
          _StockField(label: 'Total quantity', controller: _totalController),
          const SizedBox(height: 12),
          _StockField(label: 'Reserved', controller: _reservedController),
          const SizedBox(height: 12),
          _StockField(label: 'Rented', controller: _rentedController),
          const SizedBox(height: 12),
          _StockField(label: 'Blocked', controller: _blockedController),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: provider.saving ? null : () => _save(record),
            style: ElevatedButton.styleFrom(
              minimumSize: const Size.fromHeight(48),
              backgroundColor: AppTheme.accent,
            ),
            child: provider.saving
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Save stock'),
          ),
        ],
      ),
    );
  }
}

class _StockField extends StatelessWidget {
  final String label;
  final TextEditingController controller;

  const _StockField({required this.label, required this.controller});

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: TextInputType.number,
      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
      style: TextStyle(color: context.appColors.textPrimary),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyle(color: context.appColors.textSecondary),
        filled: true,
        fillColor: AppTheme.card(context),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: context.appColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: context.appColors.border),
        ),
      ),
    );
  }
}
