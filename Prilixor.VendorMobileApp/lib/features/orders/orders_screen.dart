import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/models/vendor_order_model.dart';
import '../../core/providers/vendor_order_provider.dart';
import '../../core/theme.dart';
import 'expirations_screen.dart';
import 'order_detail_screen.dart';
import 'order_group_utils.dart';

/// Orders list — grouped by base order ID (Vendor Web parity).
class OrdersScreen extends StatefulWidget {
  final String? initialStatusFilter;

  const OrdersScreen({super.key, this.initialStatusFilter});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  final _searchController = TextEditingController();
  String _searchQuery = '';
  late String _statusFilter;

  static const _statusFilters = <(String id, String label)>[
    ('all', 'All'),
    ('awaiting_vendor_acceptance', 'Awaiting Acceptance'),
    ('confirmed', 'Confirmed'),
    ('in_transit', 'In Transit'),
    ('active', 'Active'),
    ('returned', 'Returned'),
    ('cancelled', 'Cancelled'),
    ('dispatch_failed', 'Dispatch Failed'),
    ('bought_out', 'Bought Out'),
  ];

  @override
  void initState() {
    super.initState();
    _statusFilter = widget.initialStatusFilter ?? 'all';
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void didUpdateWidget(covariant OrdersScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    final next = widget.initialStatusFilter;
    if (next != null && next != oldWidget.initialStatusFilter) {
      setState(() => _statusFilter = next);
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    final vendorId = Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null || vendorId.isEmpty) return;
    await Provider.of<VendorOrderProvider>(context, listen: false)
        .fetchOrders(vendorId, silent: silent);
  }

  bool _matchesStatus(VendorOrder order, String tabId) {
    if (tabId == 'all') return true;
    final s = order.normalizedStatus;
    if (tabId == 'awaiting_vendor_acceptance') {
      return s == 'awaiting vendor acceptance';
    }
    if (tabId == 'in_transit') return s.contains('transit');
    if (tabId == 'dispatch_failed') return s == 'dispatch failed';
    if (tabId == 'bought_out') return s == 'bought out';
    if (tabId == 'cancelled') return s == 'cancelled' || s == 'canceled';
    return s == tabId.replaceAll('_', ' ');
  }

  bool _matchesSearch(VendorOrder order, String q) {
    if (q.isEmpty) return true;
    return order.orderNumber.toLowerCase().contains(q) ||
        order.listingTitle.toLowerCase().contains(q) ||
        order.customerName.toLowerCase().contains(q) ||
        (order.customerCity?.toLowerCase().contains(q) ?? false) ||
        order.orderId.toLowerCase().contains(q);
  }

  List<VendorOrder> _filtered(List<VendorOrder> orders) {
    final q = _searchQuery.trim().toLowerCase();
    return orders
        .where((o) => _matchesSearch(o, q) && _matchesStatus(o, _statusFilter))
        .toList();
  }

  Map<String, int> _counts(List<VendorOrder> orders) {
    final q = _searchQuery.trim().toLowerCase();
    final searchable = orders.where((o) => _matchesSearch(o, q)).toList();
    final map = <String, int>{};
    for (final (id, _) in _statusFilters) {
      map[id] = id == 'all'
          ? searchable.length
          : searchable.where((o) => _matchesStatus(o, id)).length;
    }
    return map;
  }

  String _labelFor(String id) =>
      _statusFilters.firstWhere((e) => e.$1 == id, orElse: () => (id, id)).$2;

  Future<void> _openStatusFilterSheet(Map<String, int> counts) async {
    var draft = _statusFilter;
    final options = _statusFilters
        .where((f) => f.$1 != 'bought_out' || (counts[f.$1] ?? 0) > 0)
        .toList();

    final applied = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            final maxH = MediaQuery.of(ctx).size.height * 0.78;
            final bottomInset = MediaQuery.of(ctx).viewInsets.bottom;
            final sheetColors = ctx.appColors;
            return SafeArea(
              child: Align(
                alignment: Alignment.bottomCenter,
                child: Container(
                  constraints: BoxConstraints(maxHeight: maxH),
                  decoration: BoxDecoration(
                    color: AppTheme.bg(ctx),
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
                    border: Border(top: BorderSide(color: ctx.appColors.border)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const SizedBox(height: 10),
                      Center(
                        child: Container(
                          width: 36,
                          height: 4,
                          decoration: BoxDecoration(
                            color: sheetColors.border,
                            borderRadius: BorderRadius.circular(999),
                          ),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(20, 16, 8, 12),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                'Filter orders',
                                style: TextStyle(
                                  color: sheetColors.textPrimary,
                                  fontSize: 22,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                            TextButton(
                              onPressed: () => setSheetState(() => draft = 'all'),
                              child: Text(
                                'Clear',
                                style: TextStyle(
                                  color: sheetColors.textMuted,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                            IconButton(
                              onPressed: () => Navigator.pop(ctx, false),
                              icon: Icon(Icons.close_rounded, color: sheetColors.textMuted),
                            ),
                          ],
                        ),
                      ),
                      Divider(height: 1, color: sheetColors.border),
                      Expanded(
                        child: SingleChildScrollView(
                          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                          child: Container(
                            decoration: BoxDecoration(
                              color: sheetColors.surface,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: sheetColors.border.withValues(alpha: 0.7),
                              ),
                            ),
                            clipBehavior: Clip.antiAlias,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                for (var i = 0; i < options.length; i++) ...[
                                  if (i > 0)
                                    Divider(height: 1, color: sheetColors.border),
                                  _OrdersStatusFilterRow(
                                    label: options[i].$2,
                                    count: counts[options[i].$1] ?? 0,
                                    selected: draft == options[i].$1,
                                    onTap: () =>
                                        setSheetState(() => draft = options[i].$1),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ),
                      ),
                      Padding(
                        padding: EdgeInsets.fromLTRB(16, 12, 16, 12 + bottomInset),
                        child: Row(
                          children: [
                            Expanded(
                              child: OutlinedButton(
                                onPressed: () => Navigator.pop(ctx, false),
                                child: const Text('Cancel'),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              flex: 2,
                              child: ElevatedButton(
                                onPressed: () => Navigator.pop(ctx, true),
                                child: Text(
                                  draft == 'all'
                                      ? 'Show all orders'
                                      : 'Show ${_labelFor(draft)}',
                                ),
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
          },
        );
      },
    );

    if (applied == true && mounted) {
      setState(() => _statusFilter = draft);
    }
  }

  void _openDetail(String orderId) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => OrderDetailScreen(orderId: orderId),
      ),
    );
  }

  Widget _buildScrollHeader({
    required int groupCount,
    required int itemCount,
    required Map<String, int> counts,
    required bool refreshing,
  }) {
    final colors = context.appColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _OrdersSummaryHeader(
          groupCount: groupCount,
          itemCount: itemCount,
          onRefresh: () => _load(),
          refreshing: refreshing,
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _searchController,
                  style: TextStyle(color: colors.textPrimary, fontSize: 14),
                  onChanged: (v) => setState(() => _searchQuery = v),
                  decoration: InputDecoration(
                    hintText: 'Search by order, item, or customer',
                    hintStyle: TextStyle(
                      color: colors.textMuted,
                      fontSize: 13,
                    ),
                    prefixIcon: const Icon(Icons.search_rounded, color: AppTheme.accent, size: 20),
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
              const SizedBox(width: 8),
              Material(
                color: _statusFilter != 'all' ? AppTheme.accent : AppTheme.card(context),
                borderRadius: BorderRadius.circular(14),
                child: InkWell(
                  onTap: () => _openStatusFilterSheet(counts),
                  borderRadius: BorderRadius.circular(14),
                  child: Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: _statusFilter != 'all'
                            ? AppTheme.accent
                            : colors.border.withValues(alpha: 0.7),
                      ),
                    ),
                    child: Icon(
                      Icons.tune_rounded,
                      size: 20,
                      color: _statusFilter != 'all' ? Colors.white : colors.textMuted,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Material(
                color: AppTheme.card(context),
                borderRadius: BorderRadius.circular(14),
                child: InkWell(
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const ExpirationsScreen()),
                    );
                  },
                  borderRadius: BorderRadius.circular(14),
                  child: Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: colors.border.withValues(alpha: 0.7)),
                    ),
                    child: Icon(Icons.timer_outlined, size: 20, color: colors.textMuted),
                  ),
                ),
              ),
            ],
          ),
        ),
        if (_statusFilter != 'all')
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
            child: Align(
              alignment: Alignment.centerLeft,
              child: InputChip(
                label: Text('${_labelFor(_statusFilter)} (${counts[_statusFilter] ?? 0})'),
                onDeleted: () => setState(() => _statusFilter = 'all'),
                deleteIconColor: colors.textSecondary,
                backgroundColor: AppTheme.accent.withValues(alpha: 0.25),
                labelStyle: TextStyle(color: colors.textPrimary),
                side: BorderSide.none,
              ),
            ),
          ),
        const SizedBox(height: 8),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<VendorOrderProvider>(context);
    final counts = _counts(provider.orders);
    final filtered = _filtered(provider.orders);
    final groups = buildOrderGroups(filtered);
    final totalItems = filtered.length;

    return RefreshIndicator(
      color: AppTheme.accent,
      onRefresh: () => _load(),
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverToBoxAdapter(
            child: _buildScrollHeader(
              groupCount: groups.length,
              itemCount: totalItems,
              counts: counts,
              refreshing: provider.ordersLoading,
            ),
          ),
          if (provider.ordersLoading && provider.orders.isEmpty)
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 96),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, index) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _OrderGroupSkeleton(),
                  ),
                  childCount: 3,
                ),
              ),
            )
          else if (groups.isEmpty)
            SliverFillRemaining(
              hasScrollBody: false,
              child: Builder(
                builder: (context) {
                  final colors = context.appColors;
                  return Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.shopping_bag_outlined,
                          size: 56, color: colors.textMuted.withValues(alpha: 0.45)),
                      const SizedBox(height: 12),
                      Text(
                        _searchQuery.isNotEmpty || _statusFilter != 'all'
                            ? 'No orders match your filters.'
                            : 'No orders found.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: colors.textSecondary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  );
                },
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
              sliver: SliverList.separated(
                itemCount: groups.length,
                separatorBuilder: (context, index) => const SizedBox(height: 12),
                itemBuilder: (context, index) {
                  return _OrderGroupCard(
                    group: groups[index],
                    onOpenItem: _openDetail,
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}

class _OrdersSummaryHeader extends StatelessWidget {
  final int groupCount;
  final int itemCount;
  final VoidCallback onRefresh;
  final bool refreshing;

  const _OrdersSummaryHeader({
    required this.groupCount,
    required this.itemCount,
    required this.onRefresh,
    required this.refreshing,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            colors.primarySoft,
            colors.surface,
            colors.surfaceElevated.withValues(alpha: 0.65),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.accent.withValues(alpha: 0.2)),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppTheme.accent.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.shopping_bag_outlined, color: AppTheme.accent),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  groupCount == 0
                      ? 'No orders yet'
                      : '$groupCount ${groupCount == 1 ? 'order' : 'orders'} · $itemCount ${itemCount == 1 ? 'item' : 'items'}',
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w800,
                    fontSize: 14,
                  ),
                ),
                Text(
                  'Grouped by order ID — tap an item to update status.',
                  style: TextStyle(
                    color: colors.textSecondary,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: refreshing ? null : onRefresh,
            icon: refreshing
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.refresh_rounded, color: AppTheme.accent),
          ),
        ],
      ),
    );
  }
}

class _OrderGroupCard extends StatelessWidget {
  final OrderGroup group;
  final ValueChanged<String> onOpenItem;

  const _OrderGroupCard({required this.group, required this.onOpenItem});

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.card(context),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.border.withValues(alpha: 0.7)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        group.baseOrderNumber,
                        style: TextStyle(
                          color: colors.textPrimary,
                          fontWeight: FontWeight.w800,
                          fontSize: 14,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Consolidated fulfillment · ${group.items.length} ${group.items.length == 1 ? 'item' : 'items'}',
                        style: TextStyle(
                          color: colors.textMuted,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '₹${group.totalPayout.toStringAsFixed(0)}',
                      style: const TextStyle(
                        color: AppTheme.accent,
                        fontWeight: FontWeight.w800,
                        fontSize: 14,
                      ),
                    ),
                    Text(
                      formatOrderDate(group.latestCreated),
                      style: TextStyle(
                        color: colors.textMuted,
                        fontSize: 10,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Divider(height: 1, color: colors.border.withValues(alpha: 0.5)),
          ...group.items.map(
            (order) => _OrderGroupItemRow(
              order: order,
              onTap: () => onOpenItem(order.orderId),
            ),
          ),
        ],
      ),
    );
  }
}

class _OrderGroupItemRow extends StatelessWidget {
  final VendorOrder order;
  final VoidCallback onTap;

  const _OrderGroupItemRow({required this.order, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              OrderThumb(url: order.listingPrimaryImageUrl),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      order.listingTitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: colors.textPrimary,
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      children: [
                        OrderMetaChip(label: order.customerName),
                        OrderMetaChip(label: 'Qty ${order.quantity}'),
                        OrderMetaChip(
                          label: '₹${order.payoutAmount.toStringAsFixed(0)}',
                          highlight: true,
                        ),
                        OrderTypeChip(orderType: order.orderType),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      order.customerLocation,
                      style: TextStyle(
                        color: colors.textMuted,
                        fontSize: 10,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  OrderStatusChip(status: order.status),
                  const SizedBox(height: 8),
                  Icon(
                    Icons.chevron_right_rounded,
                    color: AppTheme.accent.withValues(alpha: 0.9),
                    size: 22,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _OrderGroupSkeleton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      height: 160,
      decoration: BoxDecoration(
        color: AppTheme.card(context),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.border.withValues(alpha: 0.5)),
      ),
    );
  }
}

class _OrdersStatusFilterRow extends StatelessWidget {
  final String label;
  final int count;
  final bool selected;
  final VoidCallback onTap;

  const _OrdersStatusFilterRow({
    required this.label,
    required this.count,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Material(
      color: selected ? AppTheme.accent.withValues(alpha: 0.12) : Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(
                    color: selected ? AppTheme.accent : colors.textPrimary,
                    fontSize: 14,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  ),
                ),
              ),
              Text(
                '$count',
                style: TextStyle(
                  color: selected ? AppTheme.accent : colors.textMuted,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(width: 8),
              Icon(
                selected ? Icons.radio_button_checked : Icons.radio_button_off,
                color: selected ? AppTheme.accent : colors.textMuted,
                size: 22,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
