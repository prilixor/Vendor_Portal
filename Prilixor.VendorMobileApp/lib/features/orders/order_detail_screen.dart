import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/models/order_continuations_model.dart';
import '../../core/models/order_image_model.dart';
import '../../core/models/vendor_order_model.dart';
import '../../core/providers/vendor_order_provider.dart';
import '../../core/theme.dart';
import '../../shared/widgets/vendor_doctor_lookup_sheet.dart';
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
    final provider = Provider.of<VendorOrderProvider>(context, listen: false);
    if (provider.hasPendingContinuations) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Review the pending customer request first.')),
      );
      return;
    }
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
    final ok = await provider.cancelAssignedOrder(vendorId, _selectedOrderId);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(ok ? 'Order cancelled.' : (provider.error ?? 'Cancel failed')),
        backgroundColor: ok ? null : Colors.redAccent,
      ),
    );
  }

  Future<void> _approveExtension(PendingExtension ext) async {
    final vendorId = Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    final provider = Provider.of<VendorOrderProvider>(context, listen: false);
    final ok = await provider.approveExtension(vendorId, _selectedOrderId, ext.extensionId);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(ok ? 'Extension approved.' : (provider.error ?? 'Approve failed')),
        backgroundColor: ok ? null : Colors.redAccent,
      ),
    );
  }

  Future<void> _rejectExtension(PendingExtension ext) async {
    final vendorId = Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    final provider = Provider.of<VendorOrderProvider>(context, listen: false);
    final ok = await provider.rejectExtension(vendorId, _selectedOrderId, ext.extensionId);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(ok ? 'Extension rejected.' : (provider.error ?? 'Reject failed')),
        backgroundColor: ok ? null : Colors.redAccent,
      ),
    );
  }

  Future<void> _approveBuyout(PendingBuyout buy) async {
    final vendorId = Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    final provider = Provider.of<VendorOrderProvider>(context, listen: false);
    final ok = await provider.approveBuyout(vendorId, _selectedOrderId, buy.buyoutId);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(ok ? 'Buyout approved.' : (provider.error ?? 'Approve failed')),
        backgroundColor: ok ? null : Colors.redAccent,
      ),
    );
  }

  Future<void> _rejectBuyout(PendingBuyout buy) async {
    final vendorId = Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    final provider = Provider.of<VendorOrderProvider>(context, listen: false);
    final ok = await provider.rejectBuyout(vendorId, _selectedOrderId, buy.buyoutId);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(ok ? 'Buyout rejected.' : (provider.error ?? 'Reject failed')),
        backgroundColor: ok ? null : Colors.redAccent,
      ),
    );
  }

  String _fmtDate(String? raw) {
    if (raw == null || raw.trim().isEmpty) return '—';
    final parsed = DateTime.tryParse(raw);
    if (parsed == null) return raw;
    return '${parsed.day.toString().padLeft(2, '0')}/${parsed.month.toString().padLeft(2, '0')}/${parsed.year}';
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<VendorOrderProvider>(context);
    final order = provider.selectedOrder;
    final busy = provider.actionLoading || provider.detailLoading;
    final hasPending = provider.hasPendingContinuations;
    final continuations = provider.continuations;
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
                                            OrderThumb(url: item.imageUrl, size: 40),
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
                          if (!provider.orderImagesLoading &&
                              provider.orderImages.isNotEmpty) ...[
                            const SizedBox(height: 10),
                            _CustomerPhotosCard(images: provider.orderImages),
                          ],
                          if (hasPending) ...[
                            const SizedBox(height: 10),
                            _PendingContinuationsCard(
                              continuations: continuations,
                              busy: busy,
                              formatDate: _fmtDate,
                              onApproveExtension: _approveExtension,
                              onRejectExtension: _rejectExtension,
                              onApproveBuyout: _approveBuyout,
                              onRejectBuyout: _rejectBuyout,
                            ),
                          ],
                          const SizedBox(height: 10),
                          ..._secondaryActions(activeItem ?? order, busy, hasPending),
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
              hasPendingRequests: hasPending,
              onMarkTransit: () => _openDispatchSheet(activeItem ?? order),
              onMarkActive: () => _updateStatus('active'),
              onMarkReturned: () => _updateStatus('returned'),
            ),
    );
  }

  List<Widget> _secondaryActions(VendorOrder order, bool busy, bool hasPending) {
    final normalized = order.normalizedStatus.replaceAll(' ', '_');
    if (normalized != 'confirmed') return const [];

    return [
      OutlinedButton(
        onPressed: (busy || hasPending) ? null : _cancel,
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(44),
          foregroundColor: Colors.redAccent,
          side: const BorderSide(color: Colors.redAccent),
        ),
        child: Text(hasPending ? 'Review customer request first' : 'Cancel assigned order'),
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
  final bool hasPendingRequests;
  final VoidCallback onMarkTransit;
  final VoidCallback onMarkActive;
  final VoidCallback onMarkReturned;

  const _OrderActionBar({
    required this.order,
    required this.busy,
    this.hasPendingRequests = false,
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

    if (hasPendingRequests) {
      label = 'Review customer request';
      action = null;
    } else if (compact == 'confirmed') {
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

    if (label == null) return const SizedBox.shrink();

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
                onPressed: (busy || action == null) ? null : action,
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

class _PendingContinuationsCard extends StatelessWidget {
  final OrderContinuations continuations;
  final bool busy;
  final String Function(String?) formatDate;
  final void Function(PendingExtension) onApproveExtension;
  final void Function(PendingExtension) onRejectExtension;
  final void Function(PendingBuyout) onApproveBuyout;
  final void Function(PendingBuyout) onRejectBuyout;

  const _PendingContinuationsCard({
    required this.continuations,
    required this.busy,
    required this.formatDate,
    required this.onApproveExtension,
    required this.onRejectExtension,
    required this.onApproveBuyout,
    required this.onRejectBuyout,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF78350F).withValues(alpha: 0.35),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.amber.withValues(alpha: 0.45)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Pending customer requests',
            style: TextStyle(
              color: Color(0xFFFBBF24),
              fontWeight: FontWeight.w800,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 10),
          ...continuations.pendingExtensions.map((ext) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _RequestBox(
                title: 'Rent extension request',
                subtitle: 'Customer wants to extend by ${ext.additionalDays} days.',
                rows: [
                  ('Original end date', formatDate(ext.originalEndDate)),
                  ('New end date', formatDate(ext.newEndDate)),
                  ('Base extension rent', '₹${ext.extensionAmount.toStringAsFixed(2)}'),
                  ('GST', '₹${ext.gstAmount.toStringAsFixed(2)}'),
                  ('Total to collect', '₹${ext.totalAmount.toStringAsFixed(2)}'),
                ],
                busy: busy,
                onReject: () => onRejectExtension(ext),
                onApprove: () => onApproveExtension(ext),
              ),
            );
          }),
          ...continuations.pendingBuyouts.map((buy) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _RequestBox(
                title: 'Product buyout request',
                subtitle: 'Customer wants to buy this rented product permanently.',
                rows: [
                  ('Base buyout value', '₹${buy.baseBuyoutAmount.toStringAsFixed(2)}'),
                  ('Rent deduction', '-₹${buy.rentDeductionAmount.toStringAsFixed(2)}'),
                  ('GST', '₹${buy.gstAmount.toStringAsFixed(2)}'),
                  ('Total to collect', '₹${buy.totalAmount.toStringAsFixed(2)}'),
                ],
                busy: busy,
                onReject: () => onRejectBuyout(buy),
                onApprove: () => onApproveBuyout(buy),
              ),
            );
          }),
        ],
      ),
    );
  }
}

class _RequestBox extends StatelessWidget {
  final String title;
  final String subtitle;
  final List<(String, String)> rows;
  final bool busy;
  final VoidCallback onReject;
  final VoidCallback onApprove;

  const _RequestBox({
    required this.title,
    required this.subtitle,
    required this.rows,
    required this.busy,
    required this.onReject,
    required this.onApprove,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.25),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.amber.withValues(alpha: 0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          Text(subtitle, style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 13)),
          const SizedBox(height: 10),
          ...rows.map(
            (r) => Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      r.$1,
                      style: TextStyle(color: Colors.white.withValues(alpha: 0.55), fontSize: 12),
                    ),
                  ),
                  Text(
                    r.$2,
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 12),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: busy ? null : onReject,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white70,
                    side: BorderSide(color: Colors.white.withValues(alpha: 0.3)),
                  ),
                  child: const Text('Reject'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ElevatedButton(
                  onPressed: busy ? null : onApprove,
                  style: ElevatedButton.styleFrom(backgroundColor: AppTheme.accent),
                  child: const Text('Approve'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _CustomerPhotosCard extends StatelessWidget {
  final List<OrderImage> images;

  const _CustomerPhotosCard({required this.images});

  void _preview(BuildContext context, OrderImage image) {
    showDialog<void>(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.black,
        insetPadding: const EdgeInsets.all(16),
        child: Stack(
          children: [
            InteractiveViewer(
              child: AspectRatio(
                aspectRatio: 1,
                child: Image.network(
                  image.fileUrl,
                  fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) => const Center(
                    child: Icon(Icons.broken_image_outlined, color: Colors.white54, size: 48),
                  ),
                ),
              ),
            ),
            Positioned(
              top: 4,
              right: 4,
              child: IconButton(
                onPressed: () => Navigator.pop(ctx),
                icon: const Icon(Icons.close, color: Colors.white),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return _SectionCard(
      title: 'Customer photos',
      subtitle: '${images.length} photo${images.length == 1 ? '' : 's'} · cleared after delivery',
      compact: true,
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: images.length,
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 3,
          mainAxisSpacing: 8,
          crossAxisSpacing: 8,
        ),
        itemBuilder: (context, index) {
          final image = images[index];
          return Material(
            color: Colors.white.withValues(alpha: 0.06),
            borderRadius: BorderRadius.circular(10),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: () => _preview(context, image),
              child: Image.network(
                image.fileUrl,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => const Center(
                  child: Icon(Icons.broken_image_outlined, color: Colors.white38),
                ),
              ),
            ),
          );
        },
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
    final hasMedical =
        order.doctorName != null || order.hospitalName != null || order.doctorUniqueCode != null;

    return _SectionCard(
      title: 'Selected item details',
      compact: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              OrderThumb(url: order.imageUrl, size: 48),
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
              if (order.doctorUniqueCode != null) ('Unique ID', order.doctorUniqueCode!),
              if (order.doctorContactNumber != null)
                ('Contact', order.doctorContactNumber!),
              if (order.doctorSpecialization != null)
                ('Specialization', order.doctorSpecialization!),
              if (order.hospitalName != null) ('Hospital', order.hospitalName!),
              if (order.hospitalCity != null) ('City', order.hospitalCity!),
            ]),
            if (order.doctorUniqueCode != null) ...[
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: () => showVendorDoctorLookupSheet(
                    context,
                    initialCode: order.doctorUniqueCode,
                  ),
                  icon: const Icon(Icons.medical_services_outlined, size: 16, color: Color(0xFF2DD4BF)),
                  label: const Text('View doctor profile', style: TextStyle(color: Color(0xFF2DD4BF))),
                ),
              ),
            ],
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
