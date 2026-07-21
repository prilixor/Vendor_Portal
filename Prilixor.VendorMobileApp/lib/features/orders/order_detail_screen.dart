import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/models/vendor_order_model.dart';
import '../../core/providers/vendor_order_provider.dart';
import '../../core/theme.dart';
import 'dispatch_details_sheet.dart';
import 'order_group_utils.dart';

class OrderDetailScreen extends StatefulWidget {
  final String orderId;

  const OrderDetailScreen({super.key, required this.orderId});

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  late String _selectedOrderId;

  @override
  void initState() {
    super.initState();
    _selectedOrderId = widget.orderId;
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final vendorId = Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    final provider = Provider.of<VendorOrderProvider>(context, listen: false);
    await Future.wait([
      provider.fetchOrders(vendorId, silent: true),
      provider.fetchOrderDetail(vendorId, _selectedOrderId),
    ]);
  }

  Future<void> _selectItem(String orderId) async {
    if (orderId == _selectedOrderId) return;
    setState(() => _selectedOrderId = orderId);
    final vendorId = Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    await Provider.of<VendorOrderProvider>(context, listen: false)
        .fetchOrderDetail(vendorId, orderId);
  }

  Future<void> _updateStatus(String status, {List<String>? assetTags}) async {
    final vendorId = Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    final provider = Provider.of<VendorOrderProvider>(context, listen: false);
    final ok = await provider.updateOrderStatus(
      vendorId,
      _selectedOrderId,
      status,
      assetTags: assetTags,
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          ok
              ? 'Status updated to ${status.replaceAll('_', ' ')}.'
              : (provider.error ?? 'Update failed'),
        ),
        backgroundColor: ok ? null : Colors.redAccent,
      ),
    );
  }

  Future<void> _openDispatchSheet(VendorOrder order) async {
    final vendorId = Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;

    final tags = await DispatchDetailsSheet.show(
      context,
      vendorId: vendorId,
      listingId: order.listingId,
      listingTitle: order.listingTitle,
      quantity: order.quantity,
      existingAssetTags: order.assignedAssetTags,
      productVariantId: order.productVariantId,
    );
    if (!mounted || tags == null) return;
    final nonEmpty = tags.where((t) => t.trim().isNotEmpty).toList();
    await _updateStatus(
      'in_transit',
      assetTags: nonEmpty.isEmpty ? null : nonEmpty,
    );
  }

  Future<void> _cancel() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.card(context),
        title: const Text('Cancel order?', style: TextStyle(color: Colors.white)),
        content: Text(
          'This releases the assignment so another vendor can receive it.',
          style: TextStyle(color: Colors.white.withValues(alpha: 0.75)),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Keep')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
            child: const Text('Cancel order'),
          ),
        ],
      ),
    );
    if (confirm != true || !mounted) return;

    final vendorId = Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    final provider = Provider.of<VendorOrderProvider>(context, listen: false);
    final ok = await provider.cancelAssignedOrder(vendorId, _selectedOrderId);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(ok ? 'Order cancelled.' : (provider.error ?? 'Cancel failed')),
        backgroundColor: ok ? null : Colors.redAccent,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<VendorOrderProvider>(context);
    final order = provider.selectedOrder;
    final busy = provider.actionLoading || provider.detailLoading;
    final groupItems = order == null
        ? const <VendorOrder>[]
        : orderGroupItems(anchor: order, allOrders: provider.orders);
    final activeItem = order == null
        ? null
        : groupItems.firstWhere(
            (item) => item.orderId == _selectedOrderId,
            orElse: () => order,
          );
    final groupPayout =
        groupItems.fold(0.0, (sum, item) => sum + item.payoutAmount);
    final baseOrderNumber =
        order == null ? '' : getBaseOrderNumber(order.orderNumber);

    return Scaffold(
      appBar: AppBar(
        title: Text(baseOrderNumber.isEmpty ? 'Order' : baseOrderNumber),
        actions: [
          IconButton(
            onPressed: busy ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: provider.detailLoading && order == null
          ? const Center(child: CircularProgressIndicator(color: AppTheme.accent))
          : order == null
              ? Center(
                  child: Text(
                    provider.error ?? 'Order not found',
                    style: const TextStyle(color: Colors.white54),
                  ),
                )
              : CustomScrollView(
                  slivers: [
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                      sliver: SliverList(
                        delegate: SliverChildListDelegate([
                          _GroupHeroCard(
                            baseOrderNumber: baseOrderNumber,
                            itemCount: groupItems.length,
                            groupPayout: groupPayout,
                          ),
                          const SizedBox(height: 10),
                          _SectionCard(
                            title: 'Items in this order',
                            subtitle: 'Tap an item to view details and update status.',
                            compact: true,
                            child: Column(
                              children: groupItems.map((item) {
                                final selected = item.orderId == _selectedOrderId;
                                return Padding(
                                  padding: const EdgeInsets.only(bottom: 6),
                                  child: Material(
                                    color: selected
                                        ? AppTheme.accent.withValues(alpha: 0.12)
                                        : Colors.white.withValues(alpha: 0.04),
                                    borderRadius: BorderRadius.circular(12),
                                    child: InkWell(
                                      borderRadius: BorderRadius.circular(12),
                                      onTap: busy ? null : () => _selectItem(item.orderId),
                                      child: Container(
                                        padding: const EdgeInsets.all(8),
                                        decoration: BoxDecoration(
                                          borderRadius: BorderRadius.circular(12),
                                          border: Border.all(
                                            color: selected
                                                ? AppTheme.accent.withValues(alpha: 0.55)
                                                : Colors.white.withValues(alpha: 0.06),
                                          ),
                                        ),
                                        child: Row(
                                          children: [
                                            OrderThumb(url: item.listingPrimaryImageUrl, size: 40),
                                            const SizedBox(width: 8),
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment: CrossAxisAlignment.start,
                                                children: [
                                                  Text(
                                                    item.listingTitle,
                                                    maxLines: 2,
                                                    overflow: TextOverflow.ellipsis,
                                                    style: const TextStyle(
                                                      color: Colors.white,
                                                      fontWeight: FontWeight.w700,
                                                      fontSize: 12,
                                                    ),
                                                  ),
                                                  const SizedBox(height: 4),
                                                  Wrap(
                                                    spacing: 4,
                                                    runSpacing: 4,
                                                    children: [
                                                      OrderTypeChip(orderType: item.orderType),
                                                      OrderMetaChip(label: 'Qty ${item.quantity}'),
                                                      if (item.assignedAssetTags.isNotEmpty)
                                                        OrderMetaChip(
                                                          label: item.assignedAssetTags.length == 1
                                                              ? 'SN ${item.assignedAssetTags.first}'
                                                              : '${item.assignedAssetTags.length} SNs',
                                                        ),
                                                    ],
                                                  ),
                                                ],
                                              ),
                                            ),
                                            const SizedBox(width: 6),
                                            Column(
                                              crossAxisAlignment: CrossAxisAlignment.end,
                                              children: [
                                                OrderStatusChip(status: item.status),
                                                const SizedBox(height: 4),
                                                Text(
                                                  '₹${item.payoutAmount.toStringAsFixed(0)}',
                                                  style: const TextStyle(
                                                    color: Colors.white,
                                                    fontWeight: FontWeight.w700,
                                                    fontSize: 11,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),
                                );
                              }).toList(),
                            ),
                          ),
                          const SizedBox(height: 10),
                          _ItemDetailsPanel(order: activeItem ?? order),
                          const SizedBox(height: 10),
                          ..._secondaryActions(activeItem ?? order, busy),
                        ]),
                      ),
                    ),
                    const SliverToBoxAdapter(child: SizedBox(height: 88)),
                  ],
                ),
      bottomNavigationBar: order == null
          ? null
          : _OrderActionBar(
              order: activeItem ?? order,
              busy: busy,
              onMarkTransit: () => _openDispatchSheet(activeItem ?? order),
              onMarkActive: () => _updateStatus('active'),
              onMarkReturned: () => _updateStatus('returned'),
            ),
    );
  }

  List<Widget> _secondaryActions(VendorOrder order, bool busy) {
    final normalized = order.normalizedStatus.replaceAll(' ', '_');
    if (normalized != 'confirmed') return const [];

    return [
      OutlinedButton(
        onPressed: busy ? null : _cancel,
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(44),
          foregroundColor: Colors.redAccent,
          side: const BorderSide(color: Colors.redAccent),
        ),
        child: const Text('Cancel assigned order'),
      ),
    ];
  }
}

class _GroupHeroCard extends StatelessWidget {
  final String baseOrderNumber;
  final int itemCount;
  final double groupPayout;

  const _GroupHeroCard({
    required this.baseOrderNumber,
    required this.itemCount,
    required this.groupPayout,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppTheme.accent.withValues(alpha: 0.2), AppTheme.card(context)],
        ),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppTheme.accent.withValues(alpha: 0.24)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'ORDER GROUP · $itemCount ${itemCount == 1 ? 'item' : 'items'}',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.45),
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  baseOrderNumber,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '₹${groupPayout.toStringAsFixed(0)}',
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                  fontSize: 18,
                ),
              ),
              Text(
                itemCount > 1 ? 'Combined' : 'Payout',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.45),
                  fontSize: 10,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _OrderActionBar extends StatelessWidget {
  final VendorOrder order;
  final bool busy;
  final VoidCallback onMarkTransit;
  final VoidCallback onMarkActive;
  final VoidCallback onMarkReturned;

  const _OrderActionBar({
    required this.order,
    required this.busy,
    required this.onMarkTransit,
    required this.onMarkActive,
    required this.onMarkReturned,
  });

  @override
  Widget build(BuildContext context) {
    final normalized = order.normalizedStatus;
    final compact = normalized.replaceAll(' ', '_');

    String? label;
    VoidCallback? action;

    if (compact == 'confirmed') {
      label = 'Mark out for delivery';
      action = onMarkTransit;
    } else if (compact == 'in_transit' || normalized.contains('transit')) {
      label = order.orderType.toLowerCase() == 'buy'
          ? 'Mark delivered'
          : 'Mark delivered / active';
      action = onMarkActive;
    } else if (compact == 'active' && order.orderType.toLowerCase() != 'buy') {
      label = 'Mark returned';
      action = onMarkReturned;
    }

    if (label == null || action == null) return const SizedBox.shrink();

    return Container(
      decoration: BoxDecoration(
        color: AppTheme.card(context),
        border: Border(top: BorderSide(color: Colors.white.withValues(alpha: 0.08))),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.35),
            blurRadius: 12,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                order.listingTitle,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.55),
                  fontSize: 11,
                ),
              ),
              const SizedBox(height: 8),
              ElevatedButton(
                onPressed: busy ? null : action,
                style: ElevatedButton.styleFrom(
                  minimumSize: const Size.fromHeight(48),
                  backgroundColor: AppTheme.accent,
                ),
                child: busy
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : Text(label, style: const TextStyle(fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ItemDetailsPanel extends StatelessWidget {
  final VendorOrder order;

  const _ItemDetailsPanel({required this.order});

  @override
  Widget build(BuildContext context) {
    final isBuy = order.orderType.toLowerCase() == 'buy';
    final hasMedical = order.doctorName != null || order.hospitalName != null;

    return _SectionCard(
      title: 'Selected item details',
      compact: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              OrderThumb(url: order.listingPrimaryImageUrl, size: 48),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      order.listingTitle,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                        height: 1.25,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 4,
                      runSpacing: 4,
                      children: [
                        OrderStatusChip(status: order.status),
                        OrderTypeChip(orderType: order.orderType),
                        if (order.isExtended && !isBuy)
                          OrderMetaChip(label: 'Extended', highlight: true),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          _MetricStrip(order: order),
          const SizedBox(height: 8),
          _CompactDetailList(rows: [
            ('Customer', order.customerName),
            ('Location', order.customerLocation),
            ('Order #', order.orderNumber),
          ]),
          if (order.assignedAssetTags.isNotEmpty) ...[
            const SizedBox(height: 8),
            _AssignedSerialNumbersBlock(tags: order.assignedAssetTags),
          ],
          if (hasMedical) ...[
            const SizedBox(height: 8),
            _SubsectionLabel('Medical reference'),
            const SizedBox(height: 4),
            _CompactDetailList(rows: [
              if (order.doctorName != null) ('Doctor', order.doctorName!),
              if (order.doctorSpecialization != null)
                ('Specialization', order.doctorSpecialization!),
              if (order.hospitalName != null) ('Hospital', order.hospitalName!),
              if (order.hospitalCity != null) ('City', order.hospitalCity!),
            ]),
          ],
        ],
      ),
    );
  }
}

class _SubsectionLabel extends StatelessWidget {
  final String text;

  const _SubsectionLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: TextStyle(
        color: Colors.white.withValues(alpha: 0.42),
        fontSize: 10,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.5,
      ),
    );
  }
}

class _AssignedSerialNumbersBlock extends StatelessWidget {
  final List<String> tags;

  const _AssignedSerialNumbersBlock({required this.tags});

  @override
  Widget build(BuildContext context) {
    final assigned = tags.map((t) => t.trim()).where((t) => t.isNotEmpty).toList();
    if (assigned.isEmpty) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.bg(context),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppTheme.accent.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  Icons.qr_code_2_rounded,
                  color: AppTheme.accent.withValues(alpha: 0.95),
                  size: 20,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Assigned serial numbers',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Linked for dispatch and inventory tracking',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.45),
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.06),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  '${assigned.length} ${assigned.length == 1 ? 'unit' : 'units'}',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.7),
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ...List.generate(assigned.length, (index) {
            final tag = assigned[index];
            return Padding(
              padding: EdgeInsets.only(top: index == 0 ? 0 : 8),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                decoration: BoxDecoration(
                  color: AppTheme.card(context),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 32,
                      height: 32,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: AppTheme.bg(context),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                      ),
                      child: Text(
                        '${index + 1}',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.55),
                          fontWeight: FontWeight.w800,
                          fontSize: 12,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'SERIAL',
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.38),
                              fontSize: 9,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.6,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            tag,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                              fontSize: 13,
                              fontFamily: 'monospace',
                            ),
                          ),
                        ],
                      ),
                    ),
                    Icon(
                      Icons.check_circle_rounded,
                      color: Colors.greenAccent.withValues(alpha: 0.85),
                      size: 18,
                    ),
                  ],
                ),
              ),
            );
          }),
        ],
      ),
    );
  }
}

class _MetricStrip extends StatelessWidget {
  final VendorOrder order;

  const _MetricStrip({required this.order});

  @override
  Widget build(BuildContext context) {
    final isBuy = order.orderType.toLowerCase() == 'buy';
    final payout = '₹${order.payoutAmount.toStringAsFixed(0)}';

    if (isBuy) {
      return Row(
        children: [
          Expanded(
            child: _MetricTile(
              label: 'Purchase',
              value: formatDetailDate(order.startDate),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(child: _MetricTile(label: 'Qty', value: '${order.quantity}')),
          const SizedBox(width: 8),
          Expanded(child: _MetricTile(label: 'Payout', value: payout, highlight: true)),
        ],
      );
    }

    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _MetricTile(
                label: 'Start',
                value: formatDetailDate(order.startDate),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _MetricTile(
                label: 'End',
                value: formatDetailDate(order.endDate),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: _MetricTile(label: 'Days', value: '${order.rentalDays}'),
            ),
            const SizedBox(width: 8),
            Expanded(child: _MetricTile(label: 'Qty', value: '${order.quantity}')),
            const SizedBox(width: 8),
            Expanded(
              child: _MetricTile(label: 'Payout', value: payout, highlight: true),
            ),
          ],
        ),
      ],
    );
  }
}

class _MetricTile extends StatelessWidget {
  final String label;
  final String value;
  final bool highlight;

  const _MetricTile({
    required this.label,
    required this.value,
    this.highlight = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      decoration: BoxDecoration(
        color: highlight
            ? AppTheme.accent.withValues(alpha: 0.1)
            : Colors.white.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: highlight
              ? AppTheme.accent.withValues(alpha: 0.22)
              : Colors.white.withValues(alpha: 0.06),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.38),
              fontSize: 9,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.3,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: highlight ? AppTheme.accent : Colors.white,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final String title;
  final String? subtitle;
  final Widget child;
  final bool compact;

  const _SectionCard({
    required this.title,
    this.subtitle,
    required this.child,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(compact ? 12 : 16),
      decoration: BoxDecoration(
        color: AppTheme.card(context),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w700,
              fontSize: compact ? 14 : 15,
            ),
          ),
          if (subtitle != null) ...[
            const SizedBox(height: 2),
            Text(
              subtitle!,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.45),
                fontSize: 11,
              ),
            ),
          ],
          SizedBox(height: compact ? 8 : 12),
          child,
        ],
      ),
    );
  }
}

class _CompactDetailList extends StatelessWidget {
  final List<(String, String)> rows;

  const _CompactDetailList({
    required this.rows,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.03),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
      ),
      child: Column(
        children: [
          for (var i = 0; i < rows.length; i++) ...[
            if (i > 0)
              Divider(
                height: 1,
                thickness: 1,
                color: Colors.white.withValues(alpha: 0.05),
              ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    flex: 2,
                    child: Text(
                      rows[i].$1,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.45),
                        fontSize: 12,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    flex: 3,
                    child: Text(
                      rows[i].$2,
                      textAlign: TextAlign.right,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
