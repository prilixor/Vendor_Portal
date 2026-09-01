import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/models/vendor_catalog_model.dart';
import '../../core/providers/vendor_catalog_provider.dart';
import '../../core/theme.dart';
import '../../shared/widgets/brand_page_loader.dart';
import '../../shared/widgets/inventory_kpi_strip.dart';
import '../../shared/widgets/listing_thumb.dart';
import 'inventory_detail_screen.dart';
import 'track_serial_screen.dart';

InventoryTotals _sumRecords(Iterable<InventoryRecord> rows) {
  var total = 0;
  var available = 0;
  var reserved = 0;
  var rented = 0;
  var blocked = 0;
  for (final row in rows) {
    total += row.total;
    available += row.available;
    reserved += row.reserved;
    rented += row.rented;
    blocked += row.blocked;
  }
  return InventoryTotals(
    total: total,
    available: available,
    reserved: reserved,
    rented: rented,
    blocked: blocked,
  );
}

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
    final equipmentTotals = _sumRecords(
      provider.inventoryRecords.where((r) => !r.isChemical),
    );
    final chemicalTotals = _sumRecords(
      provider.inventoryRecords.where((r) => r.isChemical),
    );
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
              child: _KpiStrip(
                totals: totals,
                equipment: equipmentTotals,
                chemical: chemicalTotals,
              ),
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
                  ? const BrandPageLoader()
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
  final InventoryTotals equipment;
  final InventoryTotals chemical;

  const _KpiStrip({
    required this.totals,
    required this.equipment,
    required this.chemical,
  });

  void _openSplit(
    BuildContext context, {
    required String label,
    required int combined,
    required int equipmentCount,
    required int chemicalCount,
    required Color color,
  }) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      backgroundColor: context.appColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$label stock',
                  style: TextStyle(
                    color: context.appColors.textPrimary,
                    fontWeight: FontWeight.w800,
                    fontSize: 18,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'How this combined count splits between equipment and chemicals.',
                  style: TextStyle(
                    color: context.appColors.textMuted,
                    fontSize: 13,
                    height: 1.35,
                  ),
                ),
                const SizedBox(height: 16),
                _SplitCountRow(
                  label: 'Equipment',
                  value: equipmentCount,
                  color: color,
                ),
                const SizedBox(height: 8),
                _SplitCountRow(
                  label: 'Chemicals',
                  value: chemicalCount,
                  color: color,
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Divider(height: 1, color: context.appColors.border),
                ),
                _SplitCountRow(
                  label: 'All stock',
                  value: combined,
                  color: color,
                  emphasize: true,
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final chips = [
      (
        label: 'Total',
        tooltip: 'Total units in catalog. Tap for equipment vs chemical counts.',
        value: totals.total,
        equipment: equipment.total,
        chemical: chemical.total,
        color: context.appColors.textPrimary,
      ),
      (
        label: 'Available',
        tooltip: 'Available units ready to fulfill. Tap for equipment vs chemical counts.',
        value: totals.available,
        equipment: equipment.available,
        chemical: chemical.available,
        color: const Color(0xFF10B981),
      ),
      (
        label: 'Reserved',
        tooltip: 'Reserved — held for pending orders. Tap for equipment vs chemical counts.',
        value: totals.reserved,
        equipment: equipment.reserved,
        chemical: chemical.reserved,
        color: const Color(0xFFF59E0B),
      ),
      (
        label: 'Rented',
        tooltip: 'Rented units currently out. Tap for equipment vs chemical counts.',
        value: totals.rented,
        equipment: equipment.rented,
        chemical: chemical.rented,
        color: const Color(0xFF3B82F6),
      ),
      (
        label: 'Blocked',
        tooltip: 'Blocked units that cannot be sold or rented. Tap for equipment vs chemical counts.',
        value: totals.blocked,
        equipment: equipment.blocked,
        chemical: chemical.blocked,
        color: const Color(0xFFEF4444),
      ),
    ];

    return InventoryKpiStrip(
      metrics: [
        for (final chip in chips)
          InventoryKpiMetric(
            label: chip.label,
            value: chip.value,
            color: chip.color,
            tooltip: chip.tooltip,
            onTap: () => _openSplit(
              context,
              label: chip.label,
              combined: chip.value,
              equipmentCount: chip.equipment,
              chemicalCount: chip.chemical,
              color: chip.color,
            ),
          ),
      ],
    );
  }
}

class _SplitCountRow extends StatelessWidget {
  final String label;
  final int value;
  final Color color;
  final bool emphasize;

  const _SplitCountRow({
    required this.label,
    required this.value,
    required this.color,
    this.emphasize = false,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: TextStyle(
              color: context.appColors.textPrimary,
              fontWeight: emphasize ? FontWeight.w800 : FontWeight.w600,
              fontSize: emphasize ? 16 : 15,
            ),
          ),
        ),
        Text(
          '$value',
          style: TextStyle(
            color: color,
            fontWeight: FontWeight.w800,
            fontSize: emphasize ? 20 : 18,
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
      ],
    );
  }
}

class _InventoryCard extends StatelessWidget {
  final InventoryRecord record;
  final VoidCallback onTap;

  const _InventoryCard({required this.record, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final util = record.utilization.clamp(0, 100);
    final utilPct = util.toStringAsFixed(0);
    final cells = <({String label, String semantics, int value, Color color})>[
      (
        label: 'Total',
        semantics: 'Total ${record.total}',
        value: record.total,
        color: context.appColors.textPrimary,
      ),
      (
        label: 'Available',
        semantics: 'Available ${record.available}',
        value: record.available,
        color: const Color(0xFF10B981),
      ),
      if (!record.isChemical)
        (
          label: 'Rented',
          semantics: 'Rented ${record.rented}',
          value: record.rented,
          color: const Color(0xFF3B82F6),
        ),
      (
        label: 'Reserved',
        semantics: 'Reserved ${record.reserved} — held for pending orders',
        value: record.reserved,
        color: const Color(0xFFF59E0B),
      ),
      (
        label: 'Blocked',
        semantics: 'Blocked ${record.blocked}',
        value: record.blocked,
        color: const Color(0xFFEF4444),
      ),
    ];

    return Material(
      color: context.appColors.surface,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: context.appColors.border.withValues(alpha: 0.7)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: context.isDarkMode ? 0.12 : 0.04),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ListingThumb(
                url: record.primaryImageUrl,
                size: 52,
                semanticsLabel: '${record.productName} photo',
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      record.productName,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: context.appColors.textPrimary,
                        fontWeight: FontWeight.w800,
                        fontSize: 14,
                        height: 1.25,
                        letterSpacing: -0.1,
                      ),
                    ),
                    const SizedBox(height: 8),
                    _UtilizationMeter(percent: util, label: utilPct),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        for (final cell in cells)
                          Expanded(
                            child: _CountCell(
                              label: cell.label,
                              semanticsLabel: cell.semantics,
                              value: cell.value,
                              color: cell.color,
                            ),
                          ),
                      ],
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

class _CountCell extends StatelessWidget {
  final String label;
  final String semanticsLabel;
  final int value;
  final Color color;

  const _CountCell({
    required this.label,
    required this.semanticsLabel,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: semanticsLabel,
      child: Column(
        children: [
          SizedBox(
            height: 13,
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                label,
                maxLines: 1,
                style: TextStyle(
                  color: context.appColors.textMuted,
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  height: 1.1,
                ),
              ),
            ),
          ),
          const SizedBox(height: 3),
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              '$value',
              style: TextStyle(
                color: color,
                fontWeight: FontWeight.w800,
                fontSize: 14,
                height: 1.1,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _UtilizationMeter extends StatelessWidget {
  final num percent;
  final String label;

  const _UtilizationMeter({required this.percent, required this.label});

  @override
  Widget build(BuildContext context) {
    final t = (percent / 100).clamp(0.0, 1.0).toDouble();
    return Semantics(
      label: 'Utilization $label percent',
      child: Row(
        children: [
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: LinearProgressIndicator(
                value: t,
                minHeight: 6,
                backgroundColor: context.appColors.border,
                color: const Color(0xFF6C63FF),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            '$label%',
            style: TextStyle(
              color: context.appColors.textPrimary,
              fontSize: 11,
              fontWeight: FontWeight.w800,
              height: 1.1,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}
