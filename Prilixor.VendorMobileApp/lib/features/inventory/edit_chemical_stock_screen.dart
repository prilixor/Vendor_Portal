import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/models/vendor_catalog_model.dart';
import '../../core/providers/vendor_catalog_provider.dart';
import '../../core/providers/vendor_profile_provider.dart';
import '../../shared/widgets/brand_page_loader.dart';
import '../../shared/widgets/chemical_variant_stock_fields.dart';

/// Edit chemical stock by packaging size — mirrors Vendor Web Inventory dialog.
class EditChemicalStockScreen extends StatefulWidget {
  final String listingId;

  const EditChemicalStockScreen({super.key, required this.listingId});

  @override
  State<EditChemicalStockScreen> createState() => _EditChemicalStockScreenState();
}

class _EditChemicalStockScreenState extends State<EditChemicalStockScreen> {
  List<ChemicalVariantStockRow> _rows = const [];
  bool _loading = true;
  int _previousTotal = 0;
  String _productName = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final vendorId =
        Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;

    final provider =
        Provider.of<VendorCatalogProvider>(context, listen: false);
    final record = provider.inventoryForListing(widget.listingId);
    final variantRows =
        await provider.fetchVariantInventory(vendorId, widget.listingId);

    if (!mounted) return;
    setState(() {
      _productName = record?.productName ?? 'Chemical listing';
      _previousTotal = record?.total ?? 0;
      if (variantRows.isNotEmpty) {
        _rows = variantRows.map(ChemicalVariantStockRow.fromVariantInventory).toList();
      } else {
        final listingRow = provider.rowForListing(widget.listingId);
        final productId = listingRow?.listing.productId;
        CatalogProduct? product;
        if (productId != null) {
          for (final p in provider.products) {
            if (p.id == productId) {
              product = p;
              break;
            }
          }
        }
        _rows = (product?.variants ?? const [])
            .where((v) => v.isActive && (v.id ?? '').isNotEmpty)
            .map(ChemicalVariantStockRow.fromCatalogVariant)
            .toList();
      }
      _loading = false;
    });
  }

  Future<void> _save() async {
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
    final ok = await provider.updateChemicalVariantStock(
      vendorId: vendorId,
      listingId: widget.listingId,
      previousTotal: _previousTotal,
      rows: _rows,
    );

    if (!mounted) return;
    if (ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Chemical stock updated by packaging size.')),
      );
      Navigator.pop(context, true);
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
    final pending = Provider.of<VendorProfileProvider>(context).isPending;
    final editTotal = _rows.fold<int>(0, (sum, row) => sum + row.total);

    return Scaffold(
      appBar: AppBar(title: const Text('Edit packaging stock')),
      body: _loading
          ? const BrandPageLoader()
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  _productName,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Total units: $editTotal (was $_previousTotal)',
                  style: const TextStyle(color: Colors.white54),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Edit total units per packaging size. Reserved and available update automatically.',
                  style: TextStyle(color: Colors.white54, fontSize: 13),
                ),
                const SizedBox(height: 12),
                ChemicalVariantStockFields(
                  rows: _rows,
                  readOnly: pending,
                  onChanged: pending
                      ? (_) {}
                      : (rows) => setState(() => _rows = rows),
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: pending || provider.saving || _rows.isEmpty
                      ? null
                      : _save,
                  style: ElevatedButton.styleFrom(
                    minimumSize: const Size.fromHeight(52),
                  ),
                  child: provider.saving
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text(
                          'Save stock',
                          style: TextStyle(fontWeight: FontWeight.bold),
                        ),
                ),
              ],
            ),
    );
  }
}
