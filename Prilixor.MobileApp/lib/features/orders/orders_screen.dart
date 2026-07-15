import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/providers/order_provider.dart';
import '../../core/providers/order_detail_provider.dart';
import '../../core/models/order_model.dart';
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
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      if (auth.isAuthenticated) {
        Provider.of<OrderProvider>(context, listen: false).fetchOrders(silent: true);
      }
    });
  }

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
        backgroundColor: const Color(0xFF1E293B),
        title: const Text('Cancel request?', style: TextStyle(color: Colors.white)),
        content: const Text(
          'This will cancel this item request. This cannot be undone.',
          style: TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Keep', style: TextStyle(color: Colors.white70))),
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
    final auth = Provider.of<AuthProvider>(context);
    final provider = Provider.of<OrderProvider>(context);
    final filtered = _filteredOrders(provider.orders);
    final counts = _statusCounts(provider.orders);
    final groups = _groupOrders(filtered);
    final groupKeys = groups.keys.toList();

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        centerTitle: false,
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Orders', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 22)),
            Text(
              'Track rentals and purchases from request through return.',
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: Colors.white54, fontSize: 12, fontWeight: FontWeight.normal),
            ),
          ],
        ),
        backgroundColor: const Color(0xFF0F172A),
        elevation: 0,
        toolbarHeight: 72,
      ),
      body: !auth.isAuthenticated || provider.errorMessage == 'auth_required'
          ? const GuestSignInPrompt(
              title: 'Sign in to view orders',
              message: 'Track rentals and purchases after you sign in.',
            )
          : provider.isLoading && provider.orders.isEmpty
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF6C63FF)))
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
                              Row(
                                children: [
                                  Expanded(
                                    child: _buildStatCard(
                                      'Active rentals',
                                      provider.activeRentalsCount.toString(),
                                      '₹${provider.activeRentalsTotal.toStringAsFixed(0)} in flight',
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: _buildStatCard(
                                      'Upcoming deliveries',
                                      provider.upcomingDeliveriesCount.toString(),
                                      'Pending & in transit',
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 16),
                              TextField(
                                controller: _searchController,
                                style: const TextStyle(color: Colors.white),
                                onChanged: (v) => setState(() => _searchQuery = v),
                                decoration: InputDecoration(
                                  hintText: 'Search by order ID or item',
                                  hintStyle: const TextStyle(color: Colors.white38, fontSize: 14),
                                  prefixIcon: const Icon(Icons.search, color: Colors.white54),
                                  filled: true,
                                  fillColor: const Color(0xFF1E293B),
                                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(12),
                                    borderSide: BorderSide.none,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 12),
                              SizedBox(
                                height: 40,
                                child: ListView(
                                  scrollDirection: Axis.horizontal,
                                  padding: EdgeInsets.zero,
                                  children: _statusFilters
                                      .where((f) => f != 'Bought Out' || (counts[f] ?? 0) > 0)
                                      .map((label) {
                                    final selected = _statusFilter == label;
                                    final count = counts[label] ?? 0;
                                    return Padding(
                                      padding: const EdgeInsets.only(right: 8),
                                      child: ChoiceChip(
                                        label: Text('$label ($count)'),
                                        selected: selected,
                                        onSelected: (_) => setState(() => _statusFilter = label),
                                        selectedColor: Colors.white,
                                        backgroundColor: const Color(0xFF1E293B),
                                        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                        labelStyle: TextStyle(
                                          color: selected ? const Color(0xFF0F172A) : Colors.white70,
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                        ),
                                        side: BorderSide(color: selected ? Colors.white : Colors.white24),
                                        padding: const EdgeInsets.symmetric(horizontal: 6),
                                        visualDensity: VisualDensity.compact,
                                      ),
                                    );
                                  }).toList(),
                                ),
                              ),
                              const SizedBox(height: 16),
                            ],
                          ),
                        ),
                      ),
                      if (filtered.isEmpty)
                        const SliverFillRemaining(
                          hasScrollBody: false,
                          child: Center(
                            child: Text('No orders found.', style: TextStyle(color: Colors.white54, fontSize: 16)),
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

  Widget _buildStatCard(String title, String value, String subtitle) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(color: Colors.white70, fontSize: 12), maxLines: 1, overflow: TextOverflow.ellipsis),
          const SizedBox(height: 8),
          Text(value, style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
          const SizedBox(height: 2),
          Text(subtitle, style: const TextStyle(color: Colors.white54, fontSize: 11), maxLines: 2, overflow: TextOverflow.ellipsis),
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
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: EdgeInsets.fromLTRB(compact ? 12 : 14, 14, compact ? 12 : 14, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'ORDER GROUP',
                  style: TextStyle(
                    color: Colors.white54,
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.6,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  baseOrderNumber,
                  style: TextStyle(color: Colors.white, fontSize: compact ? 14 : 15, fontWeight: FontWeight.bold),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Placed $placedOn',
                        style: const TextStyle(color: Colors.white70, fontSize: 12),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Text(
                      '₹${groupTotal.toStringAsFixed(0)}',
                      style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const Divider(color: Colors.white10, height: 1),
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
      color: const Color(0xFF0F172A),
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
            border: Border.all(color: Colors.white10),
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
                      color: const Color(0xFF1E293B),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: Colors.white10),
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
                          style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600, height: 1.25),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '₹${order.totalAmount.toStringAsFixed(0)}',
                          style: const TextStyle(color: Color(0xFFA5B4FC), fontSize: 14, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          isBuy
                              ? 'Purchased ${_formatOrderDateShort(order.startDate)}'
                              : _formatDateRangeShort(order.startDate, order.endDate),
                          style: const TextStyle(color: Colors.white54, fontSize: 12, height: 1.3),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Qty: ${order.quantity}',
                          style: const TextStyle(color: Colors.white54, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              // Always wrap on phones — never force RENT + long status + Details on one line.
              Wrap(
                spacing: 8,
                runSpacing: 8,
                crossAxisAlignment: WrapCrossAlignment.center,
                alignment: WrapAlignment.spaceBetween,
                children: [
                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      _buildOrderTypeBadge(order.orderType),
                      _buildStatusBadge(order.status, compact: compact),
                    ],
                  ),
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

  Widget _buildOrderTypeBadge(String orderType) {
    final isBuy = orderType.toLowerCase().trim() == 'buy';
    final bg = isBuy ? const Color(0xFF312E81) : const Color(0xFF134E4A);
    final fg = isBuy ? const Color(0xFFA5B4FC) : const Color(0xFF5EEAD4);
    final border = isBuy ? const Color(0xFF4338CA) : const Color(0xFF0F766E);

    return Container(
      height: 26,
      alignment: Alignment.center,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(
        color: bg.withValues(alpha: 0.45),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: border.withValues(alpha: 0.7)),
      ),
      child: Text(
        orderType.toUpperCase(),
        style: TextStyle(color: fg, fontSize: 10, fontWeight: FontWeight.bold, height: 1.1),
      ),
    );
  }

  Widget _buildStatusBadge(String status, {bool compact = false}) {
    final label = _statusDisplayLabel(status, compact: compact);
    final colors = _statusColors(status);

    return Container(
      height: 26,
      alignment: Alignment.center,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(
        color: colors.$1,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: colors.$2),
      ),
      child: Text(
        label,
        style: TextStyle(color: colors.$3, fontSize: 10, fontWeight: FontWeight.w700, height: 1.1),
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

  (Color, Color, Color) _statusColors(String status) {
    final s = status.toLowerCase().replaceAll('_', ' ');
    if (s == 'active') {
      return (const Color(0xFF14532D).withValues(alpha: 0.4), const Color(0xFF16A34A), const Color(0xFF86EFAC));
    }
    if (s == 'pending' || s == 'awaiting vendor acceptance') {
      return (const Color(0xFF78350F).withValues(alpha: 0.35), const Color(0xFFD97706), const Color(0xFFFCD34D));
    }
    if (s == 'confirmed') {
      return (const Color(0xFF0C4A6E).withValues(alpha: 0.4), const Color(0xFF0284C7), const Color(0xFF7DD3FC));
    }
    if (s.contains('transit')) {
      return (const Color(0xFF1E3A8A).withValues(alpha: 0.4), const Color(0xFF3B82F6), const Color(0xFF93C5FD));
    }
    if (s == 'returned' || s == 'completed') {
      return (const Color(0xFF334155).withValues(alpha: 0.5), const Color(0xFF64748B), const Color(0xFFE2E8F0));
    }
    if (s == 'bought out') {
      return (const Color(0xFF4A044E).withValues(alpha: 0.4), const Color(0xFFC026D3), const Color(0xFFF0ABFC));
    }
    if (s.contains('cancel')) {
      return (const Color(0xFF7F1D1D).withValues(alpha: 0.35), const Color(0xFFEF4444), const Color(0xFFFCA5A5));
    }
    return (Colors.white10, Colors.white24, Colors.white70);
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
