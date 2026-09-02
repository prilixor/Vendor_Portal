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
                hintText: 'Search expirations',
                hintStyle: TextStyle(color: colors.textMuted, fontSize: 13),
                prefixIcon: const Icon(Icons.search_rounded, color: AppTheme.accent, size: 20),
                prefixIconConstraints: const BoxConstraints(minWidth: 44, maxWidth: 44),
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
              child: Builder(
                builder: (context) {
                  final urgentCount =
                      filtered.where((row) => row.isUrgentBadge).length;
                  return Text.rich(
                    TextSpan(
                      style: TextStyle(
                        color: colors.textMuted,
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        height: 1.35,
                      ),
                      children: [
                        TextSpan(
                          text:
                              '${keys.length} ${keys.length == 1 ? 'order' : 'orders'} · ${filtered.length} ${filtered.length == 1 ? 'item' : 'items'}',
                        ),
                        if (hasSearch)
                          const TextSpan(text: ' matching search'),
                        if (urgentCount > 0) ...[
                          const TextSpan(text: ' · '),
                          TextSpan(
                            text: urgentCount == 1
                                ? '1 due soon'
                                : '$urgentCount due soon',
                            style: TextStyle(
                              color: context.isDarkMode
                                  ? const Color(0xFFFCA5A5)
                                  : const Color(0xFFB91C1C),
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ],
                    ),
                  );
                },
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
                                  color: context.appColors.textMuted.withValues(alpha: 0.55),
                                ),
                                const SizedBox(height: 14),
                                Center(
                                  child: Text(
                                    'No expirations match “${_searchQuery.trim()}”.',
                                    style: TextStyle(
                                      color: context.appColors.textSecondary,
                                      fontSize: 14,
                                      fontWeight: FontWeight.w500,
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
    final colors = context.appColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Show rentals ending within',
          style: TextStyle(
            color: colors.textMuted,
            fontSize: 11,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.15,
          ),
        ),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: AppTheme.card(context),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: colors.border.withValues(alpha: 0.75)),
          ),
          child: Row(
            children: [7, 15, 30].map((d) {
              final selected = withinDays == d;
              return Expanded(
                child: Padding(
                  padding: EdgeInsets.only(right: d == 30 ? 0 : 4),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 180),
                    curve: Curves.easeOut,
                    decoration: BoxDecoration(
                      color: selected ? AppTheme.accent : Colors.transparent,
                      borderRadius: BorderRadius.circular(10),
                      boxShadow: selected
                          ? [
                              BoxShadow(
                                color: AppTheme.accent.withValues(alpha: 0.28),
                                blurRadius: 8,
                                offset: const Offset(0, 2),
                              ),
                            ]
                          : null,
                    ),
                    child: Material(
                      color: Colors.transparent,
                      child: InkWell(
                        borderRadius: BorderRadius.circular(10),
                        onTap: () => onChanged(d),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 11),
                          child: Center(
                            child: Text(
                              '$d days',
                              style: TextStyle(
                                color: selected ? Colors.white : colors.textSecondary,
                                fontWeight: FontWeight.w800,
                                fontSize: 12,
                                letterSpacing: 0.1,
                              ),
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
        ),
      ],
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
    final colors = context.appColors;
    final itemLabel = '${items.length} ${items.length == 1 ? 'item' : 'items'}';

    return Container(
      decoration: BoxDecoration(
        color: AppTheme.card(context),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.border.withValues(alpha: 0.65)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: context.isDarkMode ? 0.18 : 0.05),
            blurRadius: 12,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: AppTheme.accent.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    Icons.event_note_rounded,
                    size: 18,
                    color: AppTheme.accent.withValues(alpha: 0.95),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'ORDER GROUP',
                        style: TextStyle(
                          color: colors.textMuted,
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.9,
                          height: 1.15,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        baseOrderNumber,
                        style: TextStyle(
                          color: colors.textPrimary,
                          fontWeight: FontWeight.w800,
                          fontSize: 15,
                          letterSpacing: -0.2,
                          height: 1.2,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        itemLabel,
                        style: TextStyle(
                          color: colors.textSecondary,
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                          height: 1.3,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Divider(height: 1, color: colors.border.withValues(alpha: 0.45)),
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 10, 10, 12),
            child: Column(
              children: [
                for (var i = 0; i < items.length; i++) ...[
                  if (i > 0) const SizedBox(height: 10),
                  _ExpirationTile(
                    row: items[i],
                    formatEnd: formatEnd,
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => OrderDetailScreen(orderId: items[i].orderId),
                        ),
                      );
                    },
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ExpirationMetaRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final bool emphasizeValue;
  final bool accentValue;

  const _ExpirationMetaRow({
    required this.icon,
    required this.label,
    required this.value,
    this.emphasizeValue = false,
    this.accentValue = false,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final isDark = context.isDarkMode;
    final labelStyle = TextStyle(
      color: colors.textMuted,
      fontSize: 11.5,
      fontWeight: FontWeight.w500,
      height: 1.4,
    );
    Color valueColor;
    if (accentValue) {
      valueColor = isDark ? const Color(0xFFFCA5A5) : const Color(0xFFB91C1C);
    } else if (emphasizeValue) {
      valueColor = colors.textPrimary;
    } else {
      valueColor = colors.textSecondary;
    }
    final valueStyle = TextStyle(
      color: valueColor,
      fontSize: 11.5,
      fontWeight: FontWeight.w700,
      height: 1.4,
      letterSpacing: emphasizeValue ? -0.1 : 0,
      fontFeatures: emphasizeValue ? const [FontFeature.tabularFigures()] : null,
    );

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 1),
          child: Icon(
            icon,
            size: 14,
            color: colors.textMuted.withValues(alpha: 0.85),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text.rich(
            TextSpan(
              children: [
                TextSpan(text: '$label ', style: labelStyle),
                TextSpan(text: value, style: valueStyle),
              ],
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
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
    final colors = context.appColors;
    final isDark = context.isDarkMode;
    final urgent = row.isUrgentBadge;
    final endLabel = formatEnd(row.endDate);
    final tileBg = isDark
        ? colors.surfaceElevated.withValues(alpha: 0.42)
        : const Color(0xFFFAFBFC);
    final borderColor = urgent
        ? (isDark ? const Color(0xFFFCA5A5).withValues(alpha: 0.55) : const Color(0xFFFECACA))
        : colors.border.withValues(alpha: 0.55);

    return Material(
      color: tileBg,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: borderColor),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 10),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        row.listingTitle,
                        style: TextStyle(
                          color: colors.textPrimary,
                          fontWeight: FontWeight.w800,
                          fontSize: 14,
                          height: 1.28,
                          letterSpacing: -0.15,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    _DaysLeftBadge(
                      label: row.daysLeftLabel,
                      urgent: urgent,
                    ),
                  ],
                ),
              ),
              Divider(height: 1, color: colors.border.withValues(alpha: 0.38)),
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: _ExpirationMetaRow(
                            icon: Icons.receipt_long_outlined,
                            label: 'Order',
                            value: row.orderNumber,
                            emphasizeValue: true,
                          ),
                        ),
                        const SizedBox(width: 6),
                        OrderTypeChip(orderType: row.orderType),
                      ],
                    ),
                    const SizedBox(height: 7),
                    _ExpirationMetaRow(
                      icon: Icons.person_outline_rounded,
                      label: 'Customer',
                      value: row.customerName,
                      emphasizeValue: true,
                    ),
                    const SizedBox(height: 5),
                    _ExpirationMetaRow(
                      icon: Icons.event_outlined,
                      label: 'Ends',
                      value: endLabel,
                      emphasizeValue: true,
                      accentValue: urgent,
                    ),
                    const SizedBox(height: 10),
                    Align(
                      alignment: Alignment.centerRight,
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'View order',
                            style: TextStyle(
                              color: AppTheme.accent,
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          Icon(
                            Icons.chevron_right_rounded,
                            color: AppTheme.accent,
                            size: 18,
                          ),
                        ],
                      ),
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

class _DaysLeftBadge extends StatelessWidget {
  final String label;
  final bool urgent;

  const _DaysLeftBadge({
    required this.label,
    required this.urgent,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final isDark = context.isDarkMode;

    Color bg;
    Color border;
    Color text;

    if (urgent) {
      bg = isDark
          ? const Color(0xFF7F1D1D).withValues(alpha: 0.35)
          : const Color(0xFFFEF2F2);
      border = isDark
          ? const Color(0xFFFCA5A5).withValues(alpha: 0.45)
          : const Color(0xFFFECACA);
      text = isDark ? const Color(0xFFFCA5A5) : const Color(0xFFB91C1C);
    } else {
      bg = isDark ? colors.surfaceElevated : colors.surfaceElevated;
      border = colors.border.withValues(alpha: isDark ? 0.75 : 1);
      text = colors.textSecondary;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: border),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: text,
          fontSize: 10.5,
          fontWeight: FontWeight.w800,
          height: 1.1,
          letterSpacing: 0.15,
        ),
      ),
    );
  }
}
