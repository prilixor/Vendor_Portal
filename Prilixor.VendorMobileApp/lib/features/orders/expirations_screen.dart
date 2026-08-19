import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/models/expiring_order_model.dart';
import '../../core/providers/vendor_order_provider.dart';
import '../../core/theme.dart';
import '../../shared/widgets/brand_page_loader.dart';
import 'order_detail_screen.dart';
import 'order_group_utils.dart';

/// Vendor Web parity — expirations grouped by order, latest window filters.
class ExpirationsScreen extends StatefulWidget {
  const ExpirationsScreen({super.key});

  @override
  State<ExpirationsScreen> createState() => _ExpirationsScreenState();
}

class _ExpirationsScreenState extends State<ExpirationsScreen> {
  final _searchController = TextEditingController();
  String _searchQuery = '';
  int _withinDays = 7;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    final vendorId =
        Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    await Provider.of<VendorOrderProvider>(context, listen: false)
        .fetchExpirations(vendorId, withinDays: _withinDays, silent: silent);
  }

  String _formatEnd(String value) {
    final d = DateTime.tryParse(value);
    if (d == null) return value.isEmpty ? '—' : value;
    return formatDetailDate(value);
  }

  bool _matchesSearch(ExpiringOrder row, String query) {
    if (query.isEmpty) return true;
    final q = query.toLowerCase();
    return row.orderNumber.toLowerCase().contains(q) ||
        getBaseOrderNumber(row.orderNumber).toLowerCase().contains(q) ||
        row.listingTitle.toLowerCase().contains(q) ||
        row.customerName.toLowerCase().contains(q);
  }

  Map<String, List<ExpiringOrder>> _group(List<ExpiringOrder> rows) {
    final map = <String, List<ExpiringOrder>>{};
    for (final row in rows) {
      final base = getBaseOrderNumber(row.orderNumber);
      map.putIfAbsent(base, () => []).add(row);
    }
    for (final items in map.values) {
      items.sort((a, b) => a.orderNumber.compareTo(b.orderNumber));
    }
    return map;
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<VendorOrderProvider>(context);
    final colors = context.appColors;
    final filtered = provider.expirations
        .where((row) => _matchesSearch(row, _searchQuery))
        .toList();
    final groups = _group(filtered);
    final keys = groups.keys.toList()..sort();
    final hasSearch = _searchQuery.trim().isNotEmpty;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Expirations'),
        actions: [
          IconButton(
            onPressed: provider.expirationsLoading ? null : () => _load(),
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Text(
              'Track rental end dates for timely returns and follow-up.',
              style: TextStyle(
                color: context.appColors.textMuted,
                fontSize: 12,
                height: 1.35,
              ),
            ),
          ),
          const SizedBox(height: 10),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: TextField(
              controller: _searchController,
              style: TextStyle(color: colors.textPrimary, fontSize: 14),
              onChanged: (v) => setState(() => _searchQuery = v),
              decoration: InputDecoration(
                hintText: 'Search by order, item, or customer',
                hintStyle: TextStyle(color: colors.textMuted, fontSize: 13),
                prefixIcon: const Icon(Icons.search_rounded, color: AppTheme.accent, size: 20),
                suffixIcon: hasSearch
                    ? IconButton(
                        icon: Icon(Icons.close, color: colors.textMuted),
                        onPressed: () {
                          _searchController.clear();
                          setState(() => _searchQuery = '');
                        },
                      )
                    : null,
                isDense: true,
                filled: true,
                fillColor: AppTheme.card(context),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: BorderSide.none,
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: BorderSide(color: colors.border.withValues(alpha: 0.7)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: AppTheme.accent, width: 1.2),
                ),
              ),
            ),
          ),
          const SizedBox(height: 10),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: _WindowFilterBar(
              withinDays: _withinDays,
              onChanged: (d) async {
                setState(() => _withinDays = d);
                await _load();
              },
            ),
          ),
          if (keys.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
              child: Text(
                '${keys.length} ${keys.length == 1 ? 'order' : 'orders'} · ${filtered.length} ${filtered.length == 1 ? 'item' : 'items'}'
                '${hasSearch ? ' matching search' : ''}',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.45),
                  fontSize: 12,
                ),
              ),
            ),
          const SizedBox(height: 10),
          Expanded(
            child: RefreshIndicator(
              color: AppTheme.accent,
              onRefresh: () => _load(),
              child: provider.expirationsLoading && provider.expirations.isEmpty
                  ? ListView(
                      children: const [
                        SizedBox(height: 120),
                        BrandPageLoader(),
                      ],
                    )
                  : provider.expirations.isEmpty
                      ? ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: [
                            const SizedBox(height: 72),
                            Icon(
                              Icons.event_available_outlined,
                              size: 56,
                              color: context.appColors.textMuted,
                            ),
                            const SizedBox(height: 14),
                            Center(
                              child: Text(
                                'No expiring orders in selected window.',
                                style: TextStyle(
                                  color: context.appColors.textMuted,
                                  fontSize: 14,
                                ),
                              ),
                            ),
                          ],
                        )
                      : keys.isEmpty
                          ? ListView(
                              physics: const AlwaysScrollableScrollPhysics(),
                              children: [
                                const SizedBox(height: 72),
                                Icon(
                                  Icons.search_off_outlined,
                                  size: 56,
                                  color: Colors.white.withValues(alpha: 0.2),
                                ),
                                const SizedBox(height: 14),
                                Center(
                                  child: Text(
                                    'No expirations match “${_searchQuery.trim()}”.',
                                    style: TextStyle(
                                      color: Colors.white.withValues(alpha: 0.55),
                                      fontSize: 14,
                                    ),
                                    textAlign: TextAlign.center,
                                  ),
                                ),
                              ],
                            )
                          : ListView.separated(
                              physics: const AlwaysScrollableScrollPhysics(),
                              padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                              itemCount: keys.length,
                              separatorBuilder: (_, _) => const SizedBox(height: 10),
                              itemBuilder: (context, index) {
                                final base = keys[index];
                                final items = groups[base]!;
                                return _OrderGroupCard(
                                  baseOrderNumber: base,
                                  items: items,
                                  formatEnd: _formatEnd,
                                );
                              },
                            ),
            ),
          ),
        ],
      ),
    );
  }
}

class _WindowFilterBar extends StatelessWidget {
  final int withinDays;
  final ValueChanged<int> onChanged;

  const _WindowFilterBar({
    required this.withinDays,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: AppTheme.card(context),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: context.appColors.border),
      ),
      child: Row(
        children: [7, 15, 30].map((d) {
          final selected = withinDays == d;
          return Expanded(
            child: Padding(
              padding: EdgeInsets.only(right: d == 30 ? 0 : 6),
              child: Material(
                color: selected
                    ? AppTheme.accent
                    : context.appColors.surface,
                borderRadius: BorderRadius.circular(10),
                child: InkWell(
                  borderRadius: BorderRadius.circular(10),
                  onTap: () => onChanged(d),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    child: Center(
                      child: Text(
                        '$d days',
                        style: TextStyle(
                          color: selected ? Colors.white : context.appColors.textSecondary,
                          fontWeight: FontWeight.w700,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _OrderGroupCard extends StatelessWidget {
  final String baseOrderNumber;
  final List<ExpiringOrder> items;
  final String Function(String) formatEnd;

  const _OrderGroupCard({
    required this.baseOrderNumber,
    required this.items,
    required this.formatEnd,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.card(context),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: context.appColors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'ORDER GROUP',
                  style: TextStyle(
                    color: context.appColors.textMuted,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.6,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  baseOrderNumber,
                  style: TextStyle(
                    color: context.appColors.textPrimary,
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                  ),
                ),
              ],
            ),
          ),
          Divider(height: 1, color: context.appColors.border),
          ...List.generate(items.length, (index) {
            final row = items[index];
            return Column(
              children: [
                if (index > 0)
                  Divider(height: 1, color: context.appColors.border),
                _ExpirationTile(
                  row: row,
                  formatEnd: formatEnd,
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => OrderDetailScreen(orderId: row.orderId),
                      ),
                    );
                  },
                ),
              ],
            );
          }),
        ],
      ),
    );
  }
}

class _ExpirationTile extends StatelessWidget {
  final ExpiringOrder row;
  final String Function(String) formatEnd;
  final VoidCallback onTap;

  const _ExpirationTile({
    required this.row,
    required this.formatEnd,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final urgent = row.isUrgentBadge;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      row.listingTitle,
                      style: TextStyle(
                        color: context.appColors.textPrimary,
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                        height: 1.25,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        OrderTypeChip(orderType: row.orderType),
                        Text(
                          row.orderNumber,
                          style: TextStyle(
                            color: context.appColors.textMuted,
                            fontSize: 10,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${row.customerName} · Ends ${formatEnd(row.endDate)}',
                      style: TextStyle(
                        color: context.appColors.textSecondary,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              _DaysLeftBadge(
                label: row.daysLeftLabel,
                urgent: urgent,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DaysLeftBadge extends StatelessWidget {
  final String label;
  final bool urgent;

  const _DaysLeftBadge({
    required this.label,
    required this.urgent,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: urgent
            ? Colors.redAccent.withValues(alpha: 0.16)
            : context.appColors.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: urgent
              ? Colors.redAccent.withValues(alpha: 0.45)
              : context.appColors.border,
        ),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: urgent ? Colors.redAccent : context.appColors.textSecondary,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
