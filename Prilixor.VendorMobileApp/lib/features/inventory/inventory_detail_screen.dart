import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/models/vendor_catalog_model.dart';
import '../../core/providers/vendor_catalog_provider.dart';
import '../../core/providers/vendor_profile_provider.dart';
import '../../core/theme.dart';
import '../../shared/widgets/inventory_kpi_strip.dart';
import 'edit_chemical_stock_screen.dart';
import 'edit_equipment_stock_screen.dart';
import 'listing_assets_screen.dart';

class InventoryDetailScreen extends StatefulWidget {
  final String listingId;

  const InventoryDetailScreen({super.key, required this.listingId});

  @override
  State<InventoryDetailScreen> createState() => _InventoryDetailScreenState();
}

class _InventoryDetailScreenState extends State<InventoryDetailScreen> {
  List<InventoryMovement> _movements = const [];
  bool _movementsLoading = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadMovements());
  }

  Future<void> _loadMovements() async {
    final vendorId =
        Provider.of<AuthProvider>(context, listen: false).vendorId;
    final provider =
        Provider.of<VendorCatalogProvider>(context, listen: false);
    final record = provider.inventoryForListing(widget.listingId);
    if (vendorId == null || record == null) return;

    setState(() => _movementsLoading = true);
    final rows = await provider.fetchMovementsForListing(
      vendorId,
      widget.listingId,
      record.productName,
    );
    if (!mounted) return;
    setState(() {
      _movements = rows;
      _movementsLoading = false;
    });
  }

  Future<void> _adjustStock({required bool stockIn}) async {
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

    final qtyController = TextEditingController(text: '1');
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.card(context),
        title: Text(
          stockIn ? 'Stock in' : 'Stock out',
          style: TextStyle(color: context.appColors.textPrimary),
        ),
        content: TextField(
          controller: qtyController,
          keyboardType: TextInputType.number,
          style: TextStyle(color: context.appColors.textPrimary),
          decoration: InputDecoration(
            labelText: 'Quantity',
            labelStyle: TextStyle(color: context.appColors.textMuted),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Apply'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    final qty = int.tryParse(qtyController.text.trim()) ?? 0;
    final vendorId =
        Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;

    final provider =
        Provider.of<VendorCatalogProvider>(context, listen: false);
    final ok = await provider.adjustEquipmentStock(
      vendorId: vendorId,
      listingId: widget.listingId,
      stockIn: stockIn,
      quantity: qty,
    );
    if (!mounted) return;
    if (ok) {
      await _loadMovements();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(stockIn ? 'Stock added.' : 'Stock removed.')),
      );
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
    final variants = provider.variantInventoryFor(widget.listingId);
    final pending =
        Provider.of<VendorProfileProvider>(context).isPending;

    if (record == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Inventory')),
        body: Center(
          child: Text('Record not found.', style: TextStyle(color: context.appColors.textMuted)),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Inventory detail')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            record.productName,
            style: TextStyle(
              color: context.appColors.textPrimary,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 12),
          InventoryKpiStrip.fromRecord(record, context),
          const SizedBox(height: 16),
          if (record.isChemical) ...[
            OutlinedButton.icon(
              onPressed: pending || provider.saving
                  ? null
                  : () async {
                      final changed = await Navigator.of(context).push<bool>(
                        MaterialPageRoute(
                          builder: (_) => EditChemicalStockScreen(
                            listingId: widget.listingId,
                          ),
                        ),
                      );
                      if (changed == true && mounted) {
                        await _loadMovements();
                      }
                    },
              icon: const Icon(Icons.edit_outlined),
              label: const Text('Edit packaging stock'),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
                foregroundColor: AppTheme.accent,
                side: BorderSide(color: context.appColors.border),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Variant stock',
              style: TextStyle(color: context.appColors.textPrimary, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            if (variants.isEmpty)
              Text(
                'No packaging stock yet. Tap Edit packaging stock to add units per size.',
                style: TextStyle(color: context.appColors.textMuted, fontSize: 13),
              )
            else
              ...variants.map(
                (v) => Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppTheme.card(context),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: context.appColors.border),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          '${v.label} · ${v.sku}',
                          style: TextStyle(color: context.appColors.textPrimary),
                        ),
                      ),
                      Text(
                        'Total ${v.totalQuantity}',
                        style: const TextStyle(color: AppTheme.accent),
                      ),
                    ],
                  ),
                ),
              ),
          ] else ...[
            OutlinedButton.icon(
              onPressed: pending || provider.saving
                  ? null
                  : () async {
                      final changed = await Navigator.of(context).push<bool>(
                        MaterialPageRoute(
                          builder: (_) => EditEquipmentStockScreen(
                            listingId: widget.listingId,
                          ),
                        ),
                      );
                      if (changed == true && mounted) {
                        await _loadMovements();
                      }
                    },
              icon: const Icon(Icons.edit_outlined),
              label: const Text('Edit stock levels'),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
                foregroundColor: AppTheme.accent,
                side: BorderSide(color: context.appColors.border),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: pending || provider.saving
                        ? null
                        : () => _adjustStock(stockIn: true),
                    icon: const Icon(Icons.add),
                    label: const Text('Stock in'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.green,
                      side: BorderSide(color: context.appColors.border),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: pending || provider.saving
                        ? null
                        : () => _adjustStock(stockIn: false),
                    icon: const Icon(Icons.remove),
                    label: const Text('Stock out'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.orange,
                      side: BorderSide(color: context.appColors.border),
                    ),
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => ListingAssetsScreen(
                    listingId: widget.listingId,
                    productName: record.productName,
                    isChemical: record.isChemical,
                  ),
                ),
              );
            },
            icon: const Icon(Icons.qr_code_2_outlined),
            label: Text(record.isChemical
                ? 'Manage batch / serial numbers'
                : 'Manage serial numbers'),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(48),
              foregroundColor: context.appColors.textPrimary,
              side: BorderSide(color: context.appColors.border),
            ),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: Text(
                  'Recent movements',
                  style: TextStyle(
                    color: context.appColors.textPrimary,
                    fontWeight: FontWeight.w600,
                    fontSize: 16,
                  ),
                ),
              ),
              if (_movementsLoading)
                const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
            ],
          ),
          const SizedBox(height: 8),
          if (_movements.isEmpty && !_movementsLoading)
            Text(
              'No movement history yet.',
              style: TextStyle(color: context.appColors.textMuted),
            )
          else
            ..._movements.take(25).map(
                  (m) => Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppTheme.card(context),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: context.appColors.border),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                m.typeLabel,
                                style: TextStyle(
                                  color: context.appColors.textPrimary,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              Text(
                                m.reference,
                                style: TextStyle(
                                  color: context.appColors.textMuted,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Text(
                          '${m.quantity > 0 ? '+' : ''}${m.quantity}',
                          style: const TextStyle(
                            color: AppTheme.accent,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
        ],
      ),
    );
  }
}
