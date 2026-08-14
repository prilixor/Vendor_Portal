import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/models/vendor_catalog_model.dart';
import '../../core/providers/vendor_catalog_provider.dart';
import '../../core/theme.dart';
import 'inventory_detail_screen.dart';
import 'track_serial_screen.dart';

class InventoryScreen extends StatefulWidget {
  const InventoryScreen({super.key});

  @override
  State<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends State<InventoryScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  final _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    final vendorId =
        Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null || vendorId.isEmpty) return;
    await Provider.of<VendorCatalogProvider>(context, listen: false)
        .fetchCatalog(vendorId, silent: silent);
  }

  List<InventoryRecord> _filtered(List<InventoryRecord> rows, bool chemicals) {
    final q = _searchQuery.trim().toLowerCase();
    return rows
        .where((row) => row.isChemical == chemicals)
        .where((row) => q.isEmpty || row.productName.toLowerCase().contains(q))
        .toList()
      ..sort((a, b) => a.productName.compareTo(b.productName));
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<VendorCatalogProvider>(context);
    final totals = provider.inventoryTotals;
    final isChemicalTab = _tabController.index == 1;
    final filtered = _filtered(provider.inventoryRecords, isChemicalTab);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Inventory'),
        actions: [
          IconButton(
            tooltip: 'Track serial number',
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const TrackSerialScreen()),
              );
            },
            icon: const Icon(Icons.search),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          onTap: (_) => setState(() {}),
          indicatorColor: const Color(0xFF6C63FF),
          tabs: [
            Tab(
              text:
                  'Equipment (${provider.inventoryRecords.where((r) => !r.isChemical).length})',
            ),
            Tab(
              text:
                  'Chemicals (${provider.inventoryRecords.where((r) => r.isChemical).length})',
            ),
          ],
        ),
      ),
      body: RefreshIndicator(
        color: const Color(0xFF6C63FF),
        onRefresh: () => _load(),
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: _KpiStrip(totals: totals),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextField(
                controller: _searchController,
                style: TextStyle(color: context.appColors.textPrimary),
                decoration: InputDecoration(
                  hintText: 'Search product…',
                  hintStyle: TextStyle(color: context.appColors.textMuted),
                  prefixIcon: Icon(Icons.search, color: context.appColors.textMuted),
                  filled: true,
                  fillColor: context.appColors.surface,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide.none,
                  ),
                ),
                onChanged: (v) => setState(() => _searchQuery = v),
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: provider.loading && provider.inventoryRecords.isEmpty
                  ? const Center(
                      child: CircularProgressIndicator(color: Color(0xFF6C63FF)),
                    )
                  : filtered.isEmpty
                      ? ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: [
                            SizedBox(
                              height: MediaQuery.of(context).size.height * 0.4,
                              child: Center(
                                child: Text(
                                  _searchQuery.isNotEmpty
                                      ? 'No matching inventory records found.'
                                      : 'No inventory records found.',
                                  style: TextStyle(color: context.appColors.textMuted),
                                ),
                              ),
                            ),
                          ],
                        )
                      : ListView.separated(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                          itemCount: filtered.length,
                          separatorBuilder: (context, index) =>
                              const SizedBox(height: 10),
                          itemBuilder: (context, index) {
                            final row = filtered[index];
                            return _InventoryCard(
                              record: row,
                              onTap: () {
                                Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) => InventoryDetailScreen(
                                      listingId: row.listingId,
                                    ),
                                  ),
                                );
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

class _KpiStrip extends StatelessWidget {
  final InventoryTotals totals;
  const _KpiStrip({required this.totals});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: context.appColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: context.appColors.border),
      ),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          _KpiChip(label: 'Total', value: totals.total, color: context.appColors.textPrimary),
          _KpiChip(label: 'Available', value: totals.available, color: const Color(0xFF10B981)),
          _KpiChip(label: 'Reserved', value: totals.reserved, color: const Color(0xFFF59E0B)),
          _KpiChip(label: 'Rented', value: totals.rented, color: const Color(0xFF3B82F6)),
          _KpiChip(label: 'Blocked', value: totals.blocked, color: const Color(0xFFEF4444)),
        ],
      ),
    );
  }
}

class _KpiChip extends StatelessWidget {
  final String label;
  final int value;
  final Color color;

  const _KpiChip({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(color: color, fontSize: 11)),
          Text(
            '$value',
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.bold,
              fontSize: 16,
            ),
          ),
        ],
      ),
    );
  }
}

class _InventoryCard extends StatelessWidget {
  final InventoryRecord record;
  final VoidCallback onTap;

  const _InventoryCard({required this.record, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final util = record.utilization.clamp(0, 100).toStringAsFixed(0);

    return Material(
      color: context.appColors.surface,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: context.appColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                record.productName,
                style: TextStyle(
                  color: context.appColors.textPrimary,
                  fontWeight: FontWeight.w700,
                  fontSize: 15,
                ),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 12,
                runSpacing: 6,
                children: [
                  _Stat('Total', record.total),
                  _Stat('Avail', record.available),
                  _Stat('Reserved', record.reserved),
                  if (!record.isChemical) _Stat('Rented', record.rented),
                  if (record.blocked > 0) _Stat('Blocked', record.blocked),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                record.isChemical
                    ? 'Chemical · variant stock'
                    : 'Utilization $util%',
                style: TextStyle(color: context.appColors.textMuted, fontSize: 12),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  final String label;
  final int value;
  const _Stat(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Text(
      '$label: $value',
      style: const TextStyle(color: Color(0xFF6C63FF), fontSize: 12),
    );
  }
}
