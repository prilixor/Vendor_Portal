import 'package:flutter/material.dart';
import '../../core/theme.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/providers/order_provider.dart';
import '../../core/providers/order_detail_provider.dart';
import '../../core/models/order_model.dart';
import '../../shared/widgets/brand_page_loader.dart';
import '../../shared/widgets/catalog_image.dart';
import '../../shared/widgets/guest_sign_in_prompt.dart';
import 'order_detail_screen.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  final _searchController = TextEditingController();
  String _searchQuery = '';
  String _statusFilter = 'All';

  static const _statusFilters = [
    'All',
    'Pending',
    'Confirmed',
    'In transit',
    'Active',
    'Returned',
    'Cancelled',
    'Dispatch failed',
    'Bought Out',
  ];

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<OrderModel> _filteredOrders(List<OrderModel> orders) {
    var list = orders;
    final q = _searchQuery.trim().toLowerCase();
    if (q.isNotEmpty) {
      list = list.where((o) {
        return o.orderNumber.toLowerCase().contains(q) ||
            o.listingTitle.toLowerCase().contains(q);
      }).toList();
    }
    if (_statusFilter != 'All') {
      list = list.where((o) => _matchesStatusFilter(o.status, _statusFilter)).toList();
    }
    return list;
  }

  Map<String, int> _statusCounts(List<OrderModel> orders) {
    final counts = <String, int>{for (final f in _statusFilters) f: 0};
    counts['All'] = orders.length;
    for (final o in orders) {
      for (final f in _statusFilters) {
        if (f == 'All') continue;
        if (_matchesStatusFilter(o.status, f)) {
          counts[f] = (counts[f] ?? 0) + 1;
        }
      }
    }
    return counts;
  }

  bool _matchesStatusFilter(String status, String filter) {
    final s = status.trim().toLowerCase().replaceAll('_', ' ');
    if (filter == 'All') return true;
    if (filter == 'Pending') {
      return s == 'pending' || s == 'awaiting vendor acceptance';
    }
    if (filter == 'In transit') return s.contains('transit');
    if (filter == 'Cancelled') return s == 'cancelled' || s == 'canceled';
    if (filter == 'Dispatch failed') return s == 'dispatch failed';
    if (filter == 'Bought Out') return s == 'bought out';
    return s == filter.toLowerCase();
  }

  Map<String, List<OrderModel>> _groupOrders(List<OrderModel> orders) {
    final groups = <String, List<OrderModel>>{};
    for (final order in orders) {
      var baseOrder = order.orderNumber;
      if (baseOrder.contains('-')) {
        final parts = baseOrder.split('-');
        if (parts.length >= 3) {
          baseOrder = parts.sublist(0, 3).join('-');
        }
      }
      groups.putIfAbsent(baseOrder, () => []).add(order);
    }
    return groups;
  }

  bool _isCancellable(String status) {
    final s = status.trim().toLowerCase();
    return s == 'pending' || s == 'awaiting vendor acceptance';
  }

  Future<void> _confirmCancelOrder(OrderModel order) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: context.appColors.surface,
        title: Text('Cancel request?', style: TextStyle(color: context.appColors.textPrimary)),
        content: Text(
          'This will cancel this item request. This cannot be undone.',
          style: TextStyle(color: context.appColors.textSecondary),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text('Keep', style: TextStyle(color: context.appColors.textSecondary))),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Cancel request', style: TextStyle(color: Colors.redAccent)),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    final detailProvider = Provider.of<OrderDetailProvider>(context, listen: false);
    final ok = await detailProvider.cancelOrder(order.id);
    if (!mounted) return;
    if (ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Order cancelled.'), backgroundColor: Colors.green),
      );
      Provider.of<OrderProvider>(context, listen: false).fetchOrders(silent: true);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(detailProvider.errorMessage ?? 'Failed to cancel order'),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final auth = Provider.of<AuthProvider>(context);
    final provider = Provider.of<OrderProvider>(context);
    final filtered = _filteredOrders(provider.orders);
    final counts = _statusCounts(provider.orders);
    final groups = _groupOrders(filtered);
    final groupKeys = groups.keys.toList();

    return Scaffold(
      backgroundColor: context.appColors.background,
      appBar: AppBar(
        centerTitle: false,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Orders', style: TextStyle(color: context.appColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 22)),
            SizedBox(height: 2),
            Text(
              'Track rentals and purchases',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: context.appColors.textMuted, fontSize: 12, fontWeight: FontWeight.normal),
            ),
          ],
        ),
        backgroundColor: context.appColors.background,
        elevation: 0,
        toolbarHeight: 64,
      ),
      body: !auth.isAuthenticated || provider.errorMessage == 'auth_required'
          ? GuestSignInPrompt.guest(
              title: 'Sign in to view orders',
              message: 'Track rentals and purchases after you sign in.',
              icon: Icons.receipt_long_outlined,
            )
          : provider.isLoading && provider.orders.isEmpty
          ? const BrandPageLoader()
          : provider.errorMessage != null
              ? Center(child: Text(provider.errorMessage!, style: const TextStyle(color: Colors.redAccent)))
              : RefreshIndicator(
                  color: const Color(0xFF6C63FF),
                  onRefresh: () => provider.fetchOrders(),
                  child: CustomScrollView(
                    // Prevent sideways shift when a child briefly overflows on small widths.
                    physics: const AlwaysScrollableScrollPhysics(),
                    clipBehavior: Clip.hardEdge,
                    slivers: [
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              LayoutBuilder(
                                builder: (context, constraints) {
                                  final narrow = constraints.maxWidth < 360;
                                  final rentalsTotal = provider.activeRentalsTotal;
                                  return Row(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Expanded(
                                        child: _buildStatCard(
                                          icon: Icons.inventory_2_outlined,
                                          title: narrow ? 'Active' : 'Active rentals',
                                          value: provider.activeRentalsCount.toString(),
                                          subtitle: narrow
                                              ? _formatInrCompact(rentalsTotal)
                                              : '${_formatInr(rentalsTotal)} in flight',
                                          accent: const Color(0xFF34D399),
                                        ),
                                      ),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: _buildStatCard(
                                          icon: Icons.local_shipping_outlined,
                                          title: narrow ? 'Upcoming' : 'Deliveries',
                                          value: provider.upcomingDeliveriesCount.toString(),
                                          subtitle: narrow ? 'Pending / transit' : 'Pending & in transit',
                                          accent: const Color(0xFF60A5FA),
                                        ),
                                      ),
                                    ],
                                  );
                                },
                              ),
                              const SizedBox(height: 14),
                              LayoutBuilder(
                                builder: (context, constraints) {
                                  final narrow = constraints.maxWidth < 360;
                                  return Row(
                                    children: [
                                      Expanded(
                                        child: TextField(
                                          controller: _searchController,
                                          style: TextStyle(color: context.appColors.textPrimary, fontSize: 14),
                                          onChanged: (v) => setState(() => _searchQuery = v),
                                          decoration: InputDecoration(
                                            hintText: narrow ? 'Search orders' : 'Search by order ID or item',
                                            hintStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 13),
                                            prefixIcon: const Padding(
                                              padding: EdgeInsets.only(left: 4),
                                              child: Icon(Icons.search_rounded, color: Color(0xFF94A3B8), size: 20),
                                            ),
                                            prefixIconConstraints: const BoxConstraints(minWidth: 44, minHeight: 44),
                                            isDense: true,
                                            filled: true,
                                            fillColor: context.appColors.surface,
                                            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
                                            border: OutlineInputBorder(
                                              borderRadius: BorderRadius.circular(14),
                                              borderSide: BorderSide.none,
                                            ),
                                            enabledBorder: OutlineInputBorder(
                                              borderRadius: BorderRadius.circular(14),
                                              borderSide: BorderSide(color: context.appColors.border),
                                            ),
                                            focusedBorder: OutlineInputBorder(
                                              borderRadius: BorderRadius.circular(14),
                                              borderSide: const BorderSide(color: Color(0xFF6C63FF), width: 1.2),
                                            ),
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Material(
                                        color: _statusFilter != 'All'
                                            ? const Color(0xFF6C63FF)
                                            : context.appColors.surface,
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
                                                color: _statusFilter != 'All'
                                                    ? const Color(0xFF6C63FF)
                                                    : context.appColors.border,
                                              ),
                                            ),
                                            child: Stack(
                                              alignment: Alignment.center,
                                              children: [
                                                Icon(
                                                  Icons.tune_rounded,
                                                  size: 20,
                                                  color: _statusFilter != 'All' ? Colors.white : context.appColors.textSecondary,
                                                ),
                                                if (_statusFilter != 'All')
                                                  Positioned(
                                                    top: 8,
                                                    right: 8,
                                                    child: Container(
                                                      width: 7,
                                                      height: 7,
                                                      decoration: BoxDecoration(
                                                        color: context.appColors.textPrimary,
                                                        shape: BoxShape.circle,
                                                      ),
                                                    ),
                                                  ),
                                              ],
                                            ),
                                          ),
                                        ),
                                      ),
                                    ],
                                  );
                                },
                              ),
                              if (_statusFilter != 'All') ...[
                                const SizedBox(height: 12),
                                Align(
                                  alignment: Alignment.centerLeft,
                                  child: _OrdersActiveFilterChip(
                                    label: '$_statusFilter (${counts[_statusFilter] ?? 0})',
                                    onClear: () => setState(() => _statusFilter = 'All'),
                                  ),
                                ),
                              ],
                              const SizedBox(height: 16),
                            ],
                          ),
                        ),
                      ),
                      if (filtered.isEmpty)
                        SliverFillRemaining(
                          hasScrollBody: false,
                          child: Center(
                            child: Text('No orders found.', style: TextStyle(color: context.appColors.textMuted, fontSize: 16)),
                          ),
                        )
                      else
                        SliverPadding(
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                          sliver: SliverList.separated(
                            itemCount: groupKeys.length,
                            separatorBuilder: (_, __) => const SizedBox(height: 16),
                            itemBuilder: (context, index) {
                              final key = groupKeys[index];
                              return _buildOrderGroupCard(context, key, groups[key]!);
                            },
                          ),
                        ),
                    ],
                  ),
                ),
    );
  }

  Future<void> _openStatusFilterSheet(Map<String, int> counts) async {
    var draft = _statusFilter;
    final options = _statusFilters
        .where((f) => f != 'Bought Out' || (counts[f] ?? 0) > 0)
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
            return SafeArea(
              child: Align(
                alignment: Alignment.bottomCenter,
                child: Container(
                  constraints: BoxConstraints(maxHeight: maxH),
                  decoration: BoxDecoration(
                    color: context.appColors.background,
                    borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                    border: Border(top: BorderSide(color: context.appColors.border)),
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
                            color: context.appColors.border,
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
                                  color: context.appColors.textPrimary,
                                  fontSize: 22,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: -0.3,
                                ),
                              ),
                            ),
                            TextButton(
                              onPressed: () => setSheetState(() => draft = 'All'),
                              child: Text(
                                'Clear',
                                style: TextStyle(color: context.appColors.textMuted, fontWeight: FontWeight.w600),
                              ),
                            ),
                            IconButton(
                              onPressed: () => Navigator.pop(ctx, false),
                              icon: Icon(Icons.close_rounded, color: context.appColors.textMuted),
                            ),
                          ],
                        ),
                      ),
                      Divider(height: 1, color: context.appColors.border),
                      Expanded(
                        child: SingleChildScrollView(
                          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                          child: Container(
                            decoration: BoxDecoration(
                              color: context.appColors.surface,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: context.appColors.border),
                            ),
                            clipBehavior: Clip.antiAlias,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                 Padding(
                                  padding: EdgeInsets.fromLTRB(16, 14, 16, 6),
                                  child: Text(
                                    'Status',
                                    style: TextStyle(
                                      color: context.appColors.textPrimary,
                                      fontSize: 15,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                                for (var i = 0; i < options.length; i++) ...[
                                  if (i > 0) Divider(height: 1, color: context.appColors.border),
                                  _OrdersStatusRow(
                                    label: options[i],
                                    count: counts[options[i]] ?? 0,
                                    selected: draft == options[i],
                                    onTap: () => setSheetState(() => draft = options[i]),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ),
                      ),
                      Container(
                        padding: EdgeInsets.fromLTRB(16, 12, 16, 12 + bottomInset),
                        decoration: BoxDecoration(
                          color: context.appColors.background,
                          border: Border(top: BorderSide(color: context.appColors.border)),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: OutlinedButton(
                                onPressed: () => Navigator.pop(ctx, false),
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: context.appColors.textSecondary,
                                  side: BorderSide(color: context.appColors.border),
                                  minimumSize: const Size.fromHeight(48),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                ),
                                child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.w600)),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              flex: 2,
                              child: ElevatedButton(
                                onPressed: () => Navigator.pop(ctx, true),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF6C63FF),
                                  foregroundColor: Colors.white,
                                  elevation: 0,
                                  minimumSize: const Size.fromHeight(48),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                ),
                                child: Text(
                                  draft == 'All'
                                      ? 'Show all orders'
                                      : 'Show ${draft.toLowerCase()}',
                                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
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

  String _formatInr(num amount) {
    final n = amount.round();
    final s = n.toString();
    if (s.length <= 3) return '₹$s';
    final last3 = s.substring(s.length - 3);
    var rest = s.substring(0, s.length - 3);
    final parts = <String>[];
    while (rest.length > 2) {
      parts.insert(0, rest.substring(rest.length - 2));
      rest = rest.substring(0, rest.length - 2);
    }
    if (rest.isNotEmpty) parts.insert(0, rest);
    return '₹${parts.join(',')},$last3';
  }

  String _formatInrCompact(num amount) {
    final n = amount.round();
    if (n >= 10000000) return '₹${(n / 10000000).toStringAsFixed(n % 10000000 == 0 ? 0 : 1)}Cr';
    if (n >= 100000) return '₹${(n / 100000).toStringAsFixed(n % 100000 == 0 ? 0 : 1)}L';
    if (n >= 1000) return '₹${(n / 1000).toStringAsFixed(n % 1000 == 0 ? 0 : 1)}K';
    return '₹$n';
  }

  Widget _buildStatCard({
    required IconData icon,
    required String title,
    required String value,
    required String subtitle,
    required Color accent,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
      decoration: BoxDecoration(
        color: context.appColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: context.appColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, size: 15, color: accent),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    color: context.appColors.textSecondary,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            value,
            style: TextStyle(
              color: context.appColors.textPrimary,
              fontSize: 26,
              fontWeight: FontWeight.w700,
              height: 1,
              letterSpacing: -0.6,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            subtitle,
            style: TextStyle(
              color: context.appColors.textMuted,
              fontSize: 11,
              fontWeight: FontWeight.w500,
              height: 1.25,
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _buildOrderGroupCard(BuildContext context, String baseOrderNumber, List<OrderModel> ordersInGroup) {
    final groupTotal = ordersInGroup.fold(0.0, (sum, order) => sum + order.totalAmount);
    final placedOn = _formatOrderDateShort(ordersInGroup.first.startDate);
    final compact = MediaQuery.sizeOf(context).width < 400;

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: context.appColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: context.appColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: EdgeInsets.fromLTRB(compact ? 12 : 14, 14, compact ? 12 : 14, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'ORDER GROUP',
                  style: TextStyle(
                    color: context.appColors.textMuted,
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.6,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  baseOrderNumber,
                  style: TextStyle(color: context.appColors.textPrimary, fontSize: compact ? 14 : 15, fontWeight: FontWeight.bold),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Placed $placedOn',
                        style: TextStyle(color: context.appColors.textSecondary, fontSize: 12),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Text(
                      '₹${groupTotal.toStringAsFixed(0)}',
                      style: TextStyle(color: context.appColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w700),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Divider(color: context.appColors.border, height: 1),
          Padding(
            padding: EdgeInsets.all(compact ? 8 : 10),
            child: Column(
              children: [
                for (var i = 0; i < ordersInGroup.length; i++) ...[
                  if (i > 0) const SizedBox(height: 10),
                  _buildItemCard(context, ordersInGroup[i], ordersInGroup),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildItemCard(BuildContext context, OrderModel order, List<OrderModel> ordersInGroup) {
    final isBuy = order.orderType.toLowerCase().trim() == 'buy';
    final screenW = MediaQuery.sizeOf(context).width;
    final compact = screenW < 400;

    return Material(
      color: context.appColors.background,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () async {
          await Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => OrderDetailScreen(
                orderNumber: order.orderNumber,
                ordersInGroup: ordersInGroup,
              ),
            ),
          );
          if (context.mounted) {
            Provider.of<OrderProvider>(context, listen: false).fetchOrders(silent: true);
          }
        },
        child: Container(
          width: double.infinity,
          padding: EdgeInsets.all(compact ? 10 : 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: context.appColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: compact ? 44 : 48,
                    height: compact ? 44 : 48,
                    clipBehavior: Clip.antiAlias,
                    decoration: BoxDecoration(
                      color: context.appColors.surface,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: context.appColors.border),
                    ),
                    child: CatalogImage(
                      url: order.listingPrimaryImageUrl,
                      width: compact ? 44 : 48,
                      height: compact ? 44 : 48,
                      fit: BoxFit.cover,
                    ),
                  ),
                  SizedBox(width: compact ? 8 : 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          order.listingTitle,
                          style: TextStyle(color: context.appColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w600, height: 1.25),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '₹${order.totalAmount.toStringAsFixed(0)}',
                          style: TextStyle(
                            color: context.isDarkMode ? const Color(0xFFA5B4FC) : const Color(0xFF4F46E5),
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          isBuy
                              ? 'Purchased ${_formatOrderDateShort(order.startDate)}'
                              : _formatDateRangeShort(order.startDate, order.endDate),
                          style: TextStyle(color: context.appColors.textMuted, fontSize: 12, height: 1.3),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Qty: ${order.quantity}',
                          style: TextStyle(color: context.appColors.textMuted, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Flexible(
                    child: Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        _buildOrderTypeBadge(context, order.orderType),
                        _buildStatusBadge(context, order.status, compact: compact),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (_isCancellable(order.status)) ...[
                        TextButton(
                          style: TextButton.styleFrom(
                            foregroundColor: Colors.redAccent,
                            padding: const EdgeInsets.symmetric(horizontal: 6),
                            minimumSize: Size.zero,
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            visualDensity: VisualDensity.compact,
                          ),
                          onPressed: () => _confirmCancelOrder(order),
                          child: const Text('Cancel', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                        ),
                        const SizedBox(width: 4),
                      ],
                      const Text(
                        'Details',
                        style: TextStyle(
                          color: Color(0xFF6C63FF),
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const Icon(Icons.chevron_right, color: Color(0xFF6C63FF), size: 16),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildOrderTypeBadge(BuildContext context, String orderType) {
    final isDark = context.isDarkMode;
    final isBuy = orderType.toLowerCase().trim() == 'buy';
    final bg = isBuy
        ? (isDark ? const Color(0xFF312E81).withValues(alpha: 0.45) : const Color(0xFFEEF2FF))
        : (isDark ? const Color(0xFF134E4A).withValues(alpha: 0.45) : const Color(0xFFF0FDFA));
    final fg = isBuy
        ? (isDark ? const Color(0xFFA5B4FC) : const Color(0xFF4338CA))
        : (isDark ? const Color(0xFF5EEAD4) : const Color(0xFF0F766E));
    final border = isBuy
        ? (isDark ? const Color(0xFF4338CA).withValues(alpha: 0.7) : const Color(0xFFC7D2FE))
        : (isDark ? const Color(0xFF0F766E).withValues(alpha: 0.7) : const Color(0xFF99F6E4));

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: border),
      ),
      child: Text(
        orderType.toUpperCase(),
        style: TextStyle(
          color: fg,
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.4,
          height: 1.1,
        ),
      ),
    );
  }

  Widget _buildStatusBadge(BuildContext context, String status, {bool compact = false}) {
    final isDark = context.isDarkMode;
    final label = _statusDisplayLabel(status, compact: compact);
    final colorsTuple = _statusColors(context, isDark, status);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: colorsTuple.$1,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: colorsTuple.$2),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: colorsTuple.$3,
          fontSize: 10,
          fontWeight: FontWeight.w700,
          height: 1.1,
        ),
        maxLines: 1,
        softWrap: false,
        overflow: TextOverflow.ellipsis,
      ),
    );
  }

  String _statusDisplayLabel(String status, {bool compact = false}) {
    final s = status.trim().toLowerCase().replaceAll('_', ' ');
    if (compact) {
      if (s == 'dispatch failed') return 'Failed';
      if (s == 'awaiting vendor acceptance') return 'Awaiting';
      if (s == 'out for delivery' || s.contains('transit')) return 'In transit';
      if (s == 'bought out') return 'Buyout';
    }
    final raw = status.trim().replaceAll('_', ' ');
    if (raw.isEmpty) return status;
    return raw
        .split(' ')
        .where((w) => w.isNotEmpty)
        .map((w) => '${w[0].toUpperCase()}${w.substring(1).toLowerCase()}')
        .join(' ');
  }

  (Color, Color, Color) _statusColors(BuildContext context, bool isDark, String status) {
    final s = status.toLowerCase().replaceAll('_', ' ').trim();
    if (s == 'active') {
      return isDark
          ? (const Color(0xFF14532D).withValues(alpha: 0.4), const Color(0xFF16A34A), const Color(0xFF86EFAC))
          : (const Color(0xFFF0FDF4), const Color(0xFF86EFAC), const Color(0xFF15803D));
    }
    if (s == 'pending' || s == 'awaiting vendor acceptance' || s == 'awaiting') {
      return isDark
          ? (const Color(0xFF78350F).withValues(alpha: 0.35), const Color(0xFFD97706), const Color(0xFFFCD34D))
          : (const Color(0xFFFFFBEB), const Color(0xFFFDE68A), const Color(0xFFB45309));
    }
    if (s == 'confirmed') {
      return isDark
          ? (const Color(0xFF0C4A6E).withValues(alpha: 0.4), const Color(0xFF0284C7), const Color(0xFF7DD3FC))
          : (const Color(0xFFF0F9FF), const Color(0xFFBAE6FD), const Color(0xFF0369A1));
    }
    if (s.contains('transit')) {
      return isDark
          ? (const Color(0xFF1E3A8A).withValues(alpha: 0.4), const Color(0xFF3B82F6), const Color(0xFF93C5FD))
          : (const Color(0xFFEEF2FF), const Color(0xFFC7D2FE), const Color(0xFF4338CA));
    }
    if (s == 'returned' || s == 'completed') {
      return isDark
          ? (const Color(0xFF334155).withValues(alpha: 0.5), const Color(0xFF64748B), const Color(0xFFE2E8F0))
          : (const Color(0xFFF8FAFC), const Color(0xFFCBD5E1), const Color(0xFF475569));
    }
    if (s == 'bought out' || s == 'buyout') {
      return isDark
          ? (const Color(0xFF4A044E).withValues(alpha: 0.4), const Color(0xFFC026D3), const Color(0xFFF0ABFC))
          : (const Color(0xFFFDF4FF), const Color(0xFFF5D0FE), const Color(0xFF86198F));
    }
    if (s.contains('cancel') || s.contains('fail')) {
      return isDark
          ? (const Color(0xFF7F1D1D).withValues(alpha: 0.35), const Color(0xFFEF4444), const Color(0xFFFCA5A5))
          : (const Color(0xFFFEF2F2), const Color(0xFFFECACA), const Color(0xFFB91C1C));
    }
    return isDark
        ? (context.appColors.surfaceElevated, context.appColors.border, context.appColors.textSecondary)
        : (const Color(0xFFF1F5F9), const Color(0xFFE2E8F0), const Color(0xFF475569));
  }

  String _formatOrderDate(String? value) {
    if (value == null || value.trim().isEmpty) return '—';
    final parsed = DateTime.tryParse(value);
    if (parsed == null) {
      final parts = value.split('T').first.split('-');
      if (parts.length == 3) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        final month = int.tryParse(parts[1]);
        final day = int.tryParse(parts[2]);
        if (month != null && day != null && month >= 1 && month <= 12) {
          return '${months[month - 1]} $day, ${parts[0]}';
        }
      }
      return value.split('T').first;
    }
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${months[parsed.month - 1]} ${parsed.day}, ${parsed.year}';
  }

  String _formatOrderDateShort(String? value) {
    if (value == null || value.trim().isEmpty) return '—';
    final parsed = DateTime.tryParse(value);
    DateTime? d = parsed;
    if (d == null) {
      final parts = value.split('T').first.split('-');
      if (parts.length == 3) {
        final y = int.tryParse(parts[0]);
        final m = int.tryParse(parts[1]);
        final day = int.tryParse(parts[2]);
        if (y != null && m != null && day != null) {
          d = DateTime(y, m, day);
        }
      }
    }
    if (d == null) return value.split('T').first;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${months[d.month - 1]} ${d.day}';
  }

  String _formatDateRange(String? start, String? end) {
    final a = _formatOrderDate(start);
    final b = _formatOrderDate(end);
    if (a != '—' && b != '—') return '$a → $b';
    if (a != '—') return a;
    if (b != '—') return b;
    return '—';
  }

  String _formatDateRangeShort(String? start, String? end) {
    final a = _formatOrderDateShort(start);
    final b = _formatOrderDateShort(end);
    if (a != '—' && b != '—') return '$a – $b';
    if (a != '—') return a;
    if (b != '—') return b;
    return '—';
  }
}

class _OrdersActiveFilterChip extends StatelessWidget {
  final String label;
  final VoidCallback onClear;

  const _OrdersActiveFilterChip({required this.label, required this.onClear});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.only(left: 12, right: 4),
      decoration: BoxDecoration(
        color: const Color(0xFF6C63FF).withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0xFF6C63FF).withValues(alpha: 0.45)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: TextStyle(color: context.appColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w600),
          ),
          IconButton(
            onPressed: onClear,
            icon: Icon(Icons.close, size: 16, color: context.appColors.textSecondary),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
            visualDensity: VisualDensity.compact,
          ),
        ],
      ),
    );
  }
}

class _OrdersStatusRow extends StatelessWidget {
  final String label;
  final int count;
  final bool selected;
  final VoidCallback onTap;

  const _OrdersStatusRow({
    required this.label,
    required this.count,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final isDark = context.isDarkMode;
    return Material(
      color: selected
          ? (isDark
              ? const Color(0xFF6C63FF).withValues(alpha: 0.2)
              : const Color(0xFF6C63FF).withValues(alpha: 0.12))
          : Colors.transparent,
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
                    color: selected
                        ? (isDark ? Colors.white : const Color(0xFF6C63FF))
                        : colors.textPrimary,
                    fontSize: 14,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: selected
                      ? const Color(0xFF6C63FF).withValues(alpha: 0.25)
                      : colors.background,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  '$count',
                  style: TextStyle(
                    color: selected
                        ? (isDark ? Colors.white : const Color(0xFF6C63FF))
                        : colors.textMuted,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Icon(
                selected ? Icons.check_circle_rounded : Icons.circle_outlined,
                size: 22,
                color: selected ? const Color(0xFF6C63FF) : colors.textMuted,
              ),
            ],
          ),
        ),
      ),
    );
  }
}