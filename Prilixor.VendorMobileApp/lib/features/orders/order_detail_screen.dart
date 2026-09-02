import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/models/order_continuations_model.dart';
import '../../core/models/order_image_model.dart';
import '../../core/models/vendor_order_model.dart';
import '../../core/providers/vendor_order_provider.dart';
import '../../core/theme.dart';
import '../../core/utils/vendor_photo_picker.dart';
import '../../shared/widgets/brand_page_loader.dart';
import '../../shared/widgets/struck_price.dart';
import '../../shared/widgets/vendor_doctor_lookup_sheet.dart';
import 'dispatch_details_sheet.dart';
import 'order_group_utils.dart';

bool _canAssignOrderSerials(VendorOrder order) {
  final s = order.normalizedStatus.replaceAll(' ', '_');
  return s == 'confirmed' || s == 'in_transit' || s == 'active';
}

class OrderDetailScreen extends StatefulWidget {
  final String orderId;

  const OrderDetailScreen({super.key, required this.orderId});

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen>
    with WidgetsBindingObserver {
  late String _selectedOrderId;
  Timer? _pollTimer;
  bool _refreshInFlight = false;

  /// Match Customer Mobile: keep status/photos/continuations fresh while open.
  static const _pollInterval = Duration(seconds: 15);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _selectedOrderId = widget.orderId;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _load(silent: false);
      _pollTimer = Timer.periodic(_pollInterval, (_) {
        if (mounted) _load(silent: true);
      });
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _pollTimer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && mounted) {
      _load(silent: true);
    }
  }

  Future<void> _load({bool silent = false}) async {
    if (!mounted) return;
    if (_refreshInFlight) {
      if (silent) return;
      while (_refreshInFlight) {
        await Future<void>.delayed(const Duration(milliseconds: 50));
        if (!mounted) return;
      }
    }
    _refreshInFlight = true;
    try {
      final vendorId = Provider.of<AuthProvider>(context, listen: false).vendorId;
      if (vendorId == null) return;
      final provider = Provider.of<VendorOrderProvider>(context, listen: false);
      await Future.wait([
        provider.fetchOrders(vendorId, silent: true),
        provider.fetchOrderDetail(vendorId, _selectedOrderId, silent: silent),
      ]);
      if (!mounted) return;
      final selected = provider.selectedOrder;
      if (selected == null) return;
      final groupIds = orderGroupItems(
        anchor: selected,
        allOrders: provider.orders,
      ).map((o) => o.orderId).toList();
      await provider.fetchGroupPhotoRequestMeta(
        vendorId,
        groupIds,
        silent: silent,
      );
    } finally {
      _refreshInFlight = false;
    }
  }

  Future<void> _selectItem(String orderId) async {
    if (orderId == _selectedOrderId) return;
    setState(() => _selectedOrderId = orderId);
    final vendorId = Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    final provider = Provider.of<VendorOrderProvider>(context, listen: false);
    await provider.fetchOrderDetail(vendorId, orderId);
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

  Future<void> _openAssignSerials(VendorOrder order) async {
    final vendorId = Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;

    final tags = await DispatchDetailsSheet.show(
      context,
      vendorId: vendorId,
      listingId: order.listingId,
      listingTitle: order.listingTitle,
      quantity: order.quantity,
      existingAssetTags: const [],
      productVariantId: order.productVariantId,
    );
    if (!mounted || tags == null) return;
    final nonEmpty = tags.where((t) => t.trim().isNotEmpty).toList();
    if (nonEmpty.length != order.quantity) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            order.quantity == 1
                ? 'Enter a serial number for this item.'
                : 'Enter ${order.quantity} unique serial numbers.',
          ),
        ),
      );
      return;
    }
    final provider = Provider.of<VendorOrderProvider>(context, listen: false);
    final ok = await provider.assignOrderAssets(vendorId, _selectedOrderId, nonEmpty);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(ok ? 'Serial number saved.' : (provider.error ?? 'Save failed')),
        backgroundColor: ok ? null : Colors.redAccent,
      ),
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
        content: Text(
          ok
              ? 'Order cancelled. Any photo request was closed.'
              : (provider.error ?? 'Cancel failed'),
        ),
        backgroundColor: ok ? null : Colors.redAccent,
      ),
    );
  }

  Future<void> _pickAndUploadPhotos([VendorPhotoPickSource? source]) async {
    final vendorId = Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    final provider = Provider.of<VendorOrderProvider>(context, listen: false);
    final remaining = 5 - provider.orderImages.length;
    if (remaining <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('You can upload at most 5 photos.')),
      );
      return;
    }

    final pickedSource = source ?? await showVendorPhotoSourceSheet(context);
    if (pickedSource == null || !mounted) return;

    final files = await pickVendorPhotoFiles(
      source: pickedSource,
      maxCount: remaining,
    );
    if (files.isEmpty || !mounted) return;

    var uploaded = 0;
    for (final file in files) {
      final ok = await provider.uploadOrderImage(
        vendorId: vendorId,
        orderId: _selectedOrderId,
        file: file,
      );
      if (!ok) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(provider.error ?? 'Failed to upload photo.'),
            backgroundColor: Colors.redAccent,
          ),
        );
        return;
      }
      uploaded++;
    }
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(uploaded == 1 ? 'Photo uploaded.' : '$uploaded photos uploaded.')),
    );
  }

  Future<void> _deletePhoto(String imageId) async {
    final vendorId = Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    final provider = Provider.of<VendorOrderProvider>(context, listen: false);
    final ok = await provider.deleteOrderImage(
      vendorId: vendorId,
      orderId: _selectedOrderId,
      imageId: imageId,
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(ok ? 'Photo removed.' : (provider.error ?? 'Failed to remove photo.')),
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
            onPressed: busy ? null : () => _load(),
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: provider.detailLoading && order == null
          ? const BrandPageLoader()
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
                                final photoCount =
                                    provider.groupPhotoCountFor(item.orderId);
                                final photoWaiting = photoCount == 0;
                                final photoReceived =
                                    photoCount != null && photoCount > 0;
                                return Padding(
                                  padding: const EdgeInsets.only(bottom: 6),
                                  child: Material(
                                    color: selected
                                        ? AppTheme.accent.withValues(alpha: 0.12)
                                        : context.appColors.surface,
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
                                                : context.appColors.border,
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
                                                    style: TextStyle(
                                                      color: context.appColors.textPrimary,
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
                                                  if (photoWaiting) ...[
                                                    const SizedBox(height: 4),
                                                    Row(
                                                      children: [
                                                        Icon(
                                                          Icons.photo_library_outlined,
                                                          size: 12,
                                                          color: context.isDarkMode ? Colors.amber.shade300 : const Color(0xFFD97706),
                                                        ),
                                                        const SizedBox(width: 4),
                                                        Expanded(
                                                          child: Text(
                                                            'Customer photos requested \u00b7 upload needed',
                                                            style: TextStyle(
                                                              color: context.isDarkMode ? Colors.amber.shade300 : const Color(0xFFD97706),
                                                              fontSize: 10.5,
                                                              fontWeight: FontWeight.w700,
                                                            ),
                                                          ),
                                                        ),
                                                      ],
                                                    ),
                                                  ] else if (photoReceived) ...[
                                                    const SizedBox(height: 4),
                                                    Row(
                                                      children: [
                                                        Icon(
                                                          Icons.photo_library_outlined,
                                                          size: 12,
                                                          color: context.isDarkMode ? const Color(0xFF34D399) : const Color(0xFF059669),
                                                        ),
                                                        const SizedBox(width: 4),
                                                        Expanded(
                                                          child: Text(
                                                            '$photoCount/5 customer photos uploaded',
                                                            style: TextStyle(
                                                              color: context.isDarkMode ? const Color(0xFF34D399) : const Color(0xFF059669),
                                                              fontSize: 10.5,
                                                              fontWeight: FontWeight.w700,
                                                            ),
                                                          ),
                                                        ),
                                                      ],
                                                    ),
                                                  ],
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
                                                  style: TextStyle(
                                                    color: context.appColors.textPrimary,
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
                          _ItemDetailsPanel(
                            order: activeItem ?? order,
                            onAddSerials: () => _openAssignSerials(activeItem ?? order),
                          ),
                          if (!provider.orderImagesLoading &&
                              provider.imageRequest != null) ...[
                            const SizedBox(height: 10),
                            _PhotoRequestCard(
                              request: provider.imageRequest!,
                              listingTitle: (activeItem ?? order).listingTitle,
                              images: provider.orderImages,
                              busy: busy,
                              canUpload: () {
                                final s = (activeItem ?? order)
                                    .status
                                    .trim()
                                    .toLowerCase()
                                    .replaceAll(' ', '_');
                                return s == 'pending' ||
                                    s == 'confirmed' ||
                                    s == 'in_transit';
                              }(),
                              onAdd: _pickAndUploadPhotos,
                              onDelete: _deletePhoto,
                            ),
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
                    color: context.appColors.textMuted,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  baseOrderNumber,
                  style: TextStyle(
                    color: context.appColors.textPrimary,
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
                style: TextStyle(
                  color: context.appColors.textPrimary,
                  fontWeight: FontWeight.w800,
                  fontSize: 18,
                ),
              ),
              Text(
                itemCount > 1 ? 'Combined' : 'Payout',
                style: TextStyle(
                  color: context.appColors.textMuted,
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
        border: Border(top: BorderSide(color: context.appColors.border)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: context.isDarkMode ? 0.35 : 0.05),
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
                  color: context.appColors.textSecondary,
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
    final isDark = context.isDarkMode;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark
            ? const Color(0xFF78350F).withValues(alpha: 0.35)
            : const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isDark
              ? Colors.amber.withValues(alpha: 0.45)
              : const Color(0xFFFDE68A),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Pending customer requests',
            style: TextStyle(
              color: isDark ? const Color(0xFFFBBF24) : const Color(0xFF92400E),
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
    final isDark = context.isDarkMode;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: context.appColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark
              ? Colors.amber.withValues(alpha: 0.25)
              : const Color(0xFFFDE68A),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: TextStyle(color: context.appColors.textPrimary, fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          Text(subtitle, style: TextStyle(color: context.appColors.textSecondary, fontSize: 13)),
          const SizedBox(height: 10),
          ...rows.map(
            (r) => Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      r.$1,
                      style: TextStyle(color: context.appColors.textMuted, fontSize: 12),
                    ),
                  ),
                  Text(
                    r.$2,
                    style: TextStyle(color: context.appColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 12),
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
                    foregroundColor: context.appColors.textSecondary,
                    side: BorderSide(color: context.appColors.border),
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

class _PhotoRequestCard extends StatelessWidget {
  static const int maxImages = 5;

  final OrderImageRequest request;
  final String listingTitle;
  final List<OrderImage> images;
  final bool busy;
  final bool canUpload;
  final Future<void> Function([VendorPhotoPickSource? source]) onAdd;
  final Future<void> Function(String imageId) onDelete;

  const _PhotoRequestCard({
    required this.request,
    required this.listingTitle,
    required this.images,
    required this.busy,
    required this.canUpload,
    required this.onAdd,
    required this.onDelete,
  });

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
              top: 8,
              right: 8,
              child: Material(
                color: Colors.black.withValues(alpha: 0.62),
                shape: const CircleBorder(),
                elevation: 2,
                child: IconButton(
                  tooltip: 'Close',
                  onPressed: () => Navigator.pop(ctx),
                  icon: const Icon(Icons.close, color: Colors.white, size: 20),
                  visualDensity: VisualDensity.compact,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _emptyUploadZone(BuildContext context) {
    final colors = context.appColors;
    return CustomPaint(
      painter: _DashedBorderPainter(
        color: AppTheme.accent.withValues(alpha: 0.55),
        radius: 14,
      ),
      child: Ink(
        decoration: BoxDecoration(
          color: AppTheme.accent.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 16, 14, 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (!kIsWeb) ...[
                SizedBox(
                  height: 46,
                  child: ElevatedButton.icon(
                    onPressed: busy ? null : () => onAdd(VendorPhotoPickSource.camera),
                    icon: const Icon(Icons.photo_camera_outlined, size: 20),
                    label: const Text('Take photo'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.accent,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
              ],
              SizedBox(
                height: 46,
                child: OutlinedButton.icon(
                  onPressed: busy
                      ? null
                      : () => onAdd(
                            kIsWeb ? null : VendorPhotoPickSource.gallery,
                          ),
                  icon: const Icon(Icons.photo_library_outlined, size: 20),
                  label: Text(kIsWeb ? 'Choose photos' : 'Choose from gallery'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: colors.textPrimary,
                    side: BorderSide(color: colors.border),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 10),
              Text(
                busy ? 'Uploading\u2026' : 'Up to $maxImages photos',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: colors.textMuted,
                  fontSize: 11.5,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _addTile({required bool large, required BuildContext context}) {
    final radius = BorderRadius.circular(large ? 14 : 10);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: busy ? null : () => onAdd(),
        borderRadius: radius,
        child: CustomPaint(
          painter: _DashedBorderPainter(
            color: AppTheme.accent.withValues(alpha: 0.55),
            radius: large ? 14 : 10,
          ),
          child: Ink(
            decoration: BoxDecoration(
              color: AppTheme.accent.withValues(alpha: 0.08),
              borderRadius: radius,
            ),
            child: Center(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: large ? 22 : 8, horizontal: 12),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      busy ? Icons.hourglass_top_rounded : Icons.add_photo_alternate_outlined,
                      color: AppTheme.accent,
                      size: large ? 32 : 22,
                    ),
                    SizedBox(height: large ? 8 : 4),
                    Text(
                      busy ? 'Uploading\u2026' : (large ? 'Add photo' : 'Add'),
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: context.appColors.textPrimary,
                        fontSize: large ? 13 : 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    if (large) ...[
                      const SizedBox(height: 4),
                      Text(
                        'Camera or gallery',
                        style: TextStyle(
                          color: context.appColors.textMuted,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final message = request.message.trim().isEmpty
        ? 'Please upload up to $maxImages photos so we can proceed.'
        : request.message;
    final showAdd = canUpload && images.length < maxImages;
    final emptyUpload = images.isEmpty && showAdd;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.card(context),
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
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: AppTheme.accent.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.photo_library_outlined, color: AppTheme.accent, size: 20),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            'Customer photo request',
                            style: TextStyle(
                              color: context.appColors.textPrimary,
                              fontWeight: FontWeight.w800,
                              fontSize: 15,
                              height: 1.2,
                            ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: context.isDarkMode ? context.appColors.surface : context.appColors.surfaceElevated,
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(color: context.appColors.border),
                          ),
                          child: Text(
                            '${images.length}/$maxImages',
                            style: TextStyle(
                              color: context.appColors.textSecondary,
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        if (images.isEmpty) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: context.isDarkMode ? Colors.amber.withValues(alpha: 0.2) : const Color(0xFFFEF3C7),
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(
                                color: context.isDarkMode
                                    ? Colors.amber.withValues(alpha: 0.35)
                                    : const Color(0xFFFDE68A),
                                width: 1,
                              ),
                            ),
                            child: Text(
                              'Action needed',
                              style: TextStyle(
                                color: context.isDarkMode ? Colors.amber.shade200 : const Color(0xFF92400E),
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    if (listingTitle.trim().isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        listingTitle,
                        style: TextStyle(
                          color: context.appColors.textPrimary,
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                    const SizedBox(height: 4),
                    Text(
                      'From the customer for this product only \u2014 upload here (not Admin chat).',
                      style: TextStyle(
                        color: context.appColors.textMuted,
                        fontSize: 11.5,
                        height: 1.35,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              color: context.appColors.surface,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: context.appColors.border),
            ),
            child: Text(
              message,
              style: TextStyle(
                color: context.appColors.textSecondary,
                fontSize: 12.5,
                height: 1.4,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          const SizedBox(height: 12),
          if (emptyUpload)
            _emptyUploadZone(context)
          else if (images.isEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 12),
              decoration: BoxDecoration(
                color: context.appColors.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: context.appColors.border),
              ),
              child: Text(
                'No photos uploaded yet.',
                textAlign: TextAlign.center,
                style: TextStyle(color: context.appColors.textMuted, fontSize: 13),
              ),
            )
          else
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: images.length + (showAdd ? 1 : 0),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                mainAxisSpacing: 8,
                crossAxisSpacing: 8,
              ),
              itemBuilder: (context, index) {
                if (showAdd && index == images.length) {
                  return _addTile(large: false, context: context);
                }

                final image = images[index];
                return Stack(
                  fit: StackFit.expand,
                  children: [
                    Material(
                      color: context.appColors.surface,
                      borderRadius: BorderRadius.circular(10),
                      clipBehavior: Clip.antiAlias,
                      child: InkWell(
                        onTap: () => _preview(context, image),
                        child: Image.network(
                          image.fileUrl,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => Center(
                            child: Icon(Icons.broken_image_outlined, color: context.appColors.textMuted),
                          ),
                        ),
                      ),
                    ),
                    if (canUpload)
                      Positioned(
                        top: 4,
                        right: 4,
                        child: Material(
                          color: Colors.black.withValues(alpha: 0.65),
                          shape: const CircleBorder(),
                          child: InkWell(
                            customBorder: const CircleBorder(),
                            onTap: busy ? null : () => onDelete(image.id),
                            child: const Padding(
                              padding: EdgeInsets.all(5),
                              child: Icon(Icons.close, size: 14, color: Colors.white),
                            ),
                          ),
                        ),
                      ),
                  ],
                );
              },
            ),
          const SizedBox(height: 10),
          Text(
            'JPEG, PNG, or WebP \u00b7 max 5 MB each \u00b7 cleared after delivery, cancel, or dispatch failure',
            style: TextStyle(
              color: context.appColors.textMuted,
              fontSize: 10.5,
              height: 1.35,
            ),
          ),
        ],
      ),
    );
  }
}

class _DashedBorderPainter extends CustomPainter {
  final Color color;
  final double radius;

  _DashedBorderPainter({required this.color, required this.radius});

  @override
  void paint(Canvas canvas, Size size) {
    final rrect = RRect.fromRectAndRadius(
      Rect.fromLTWH(0.75, 0.75, size.width - 1.5, size.height - 1.5),
      Radius.circular(radius),
    );
    final path = Path()..addRRect(rrect);
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.4;
    const dash = 5.0;
    const gap = 3.5;
    for (final metric in path.computeMetrics()) {
      var distance = 0.0;
      while (distance < metric.length) {
        final next = (distance + dash).clamp(0.0, metric.length);
        canvas.drawPath(metric.extractPath(distance, next), paint);
        distance = next + gap;
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DashedBorderPainter oldDelegate) =>
      oldDelegate.color != color || oldDelegate.radius != radius;
}

class _ItemDetailsPanel extends StatelessWidget {
  final VendorOrder order;
  final VoidCallback? onAddSerials;

  const _ItemDetailsPanel({required this.order, this.onAddSerials});

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
                      style: TextStyle(
                        color: context.appColors.textPrimary,
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
          if (!isBuy) ...[
            const SizedBox(height: 8),
            _SubsectionLabel('Rental period'),
            const SizedBox(height: 4),
            Text(
              order.rentalDurationLabel?.trim().isNotEmpty == true
                  ? '${order.rentalDurationLabel}'
                      '${order.rentalDurationDays != null ? ' (${order.rentalDurationDays} day${order.rentalDurationDays == 1 ? '' : 's'})' : ''}'
                  : '${order.rentalDays} day${order.rentalDays == 1 ? '' : 's'}',
              style: TextStyle(color: context.appColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w600),
            ),
            if (order.rentalFinalPrice != null) ...[
              const SizedBox(height: 4),
              Wrap(
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: 6,
                children: [
                  if (order.rentalNormalPrice != null &&
                      order.rentalNormalPrice! > order.rentalFinalPrice!)
                    StruckPrice(
                      '₹${order.rentalNormalPrice!.toStringAsFixed(0)}',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: context.appColors.textMuted),
                    ),
                  Text(
                    'Plan price ₹${order.rentalFinalPrice!.toStringAsFixed(0)}',
                    style: TextStyle(color: context.appColors.textMuted, fontSize: 12),
                  ),
                ],
              ),
            ],
          ],
          const SizedBox(height: 8),
          _CompactDetailList(rows: [
            ('Customer', order.customerName),
            ('Location', order.customerLocation),
            ('Order #', order.orderNumber),
          ]),
          if (order.assignedAssetTags.isNotEmpty || _canAssignOrderSerials(order)) ...[
            const SizedBox(height: 8),
            _AssignedSerialNumbersBlock(
              tags: order.assignedAssetTags,
              onAdd: order.assignedAssetTags.isEmpty ? onAddSerials : null,
            ),
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
        color: context.appColors.textMuted,
        fontSize: 10,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.5,
      ),
    );
  }
}

class _AssignedSerialNumbersBlock extends StatelessWidget {
  final List<String> tags;
  final VoidCallback? onAdd;

  const _AssignedSerialNumbersBlock({required this.tags, this.onAdd});

  @override
  Widget build(BuildContext context) {
    final assigned = tags.map((t) => t.trim()).where((t) => t.isNotEmpty).toList();
    if (assigned.isEmpty && onAdd == null) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.bg(context),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: context.appColors.border),
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
                    Text(
                      'Assigned serial numbers',
                      style: TextStyle(
                        color: context.appColors.textPrimary,
                        fontWeight: FontWeight.w800,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Linked for dispatch and inventory tracking',
                      style: TextStyle(
                        color: context.appColors.textMuted,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
              if (assigned.isNotEmpty)
                Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: context.appColors.surface,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  '${assigned.length} ${assigned.length == 1 ? 'unit' : 'units'}',
                  style: TextStyle(
                    color: context.appColors.textSecondary,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (assigned.isEmpty)
            OutlinedButton.icon(
              onPressed: onAdd,
              icon: const Icon(Icons.add, size: 16),
              label: const Text('Add serial numbers'),
            ),
          ...List.generate(assigned.length, (index) {
            final tag = assigned[index];
            return Padding(
              padding: EdgeInsets.only(top: index == 0 ? 0 : 8),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                decoration: BoxDecoration(
                  color: AppTheme.card(context),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: context.appColors.border),
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
                        border: Border.all(color: context.appColors.border),
                      ),
                      child: Text(
                        '${index + 1}',
                        style: TextStyle(
                          color: context.appColors.textMuted,
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
                              color: context.appColors.textMuted,
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
                            style: TextStyle(
                              color: context.appColors.textPrimary,
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
                      color: context.isDarkMode
                          ? Colors.greenAccent.withValues(alpha: 0.85)
                          : const Color(0xFF059669),
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
            : context.appColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: highlight
              ? AppTheme.accent.withValues(alpha: 0.22)
              : context.appColors.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: TextStyle(
              color: context.appColors.textMuted,
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
              color: highlight ? AppTheme.accent : context.appColors.textPrimary,
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
        border: Border.all(color: context.appColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              color: context.appColors.textPrimary,
              fontWeight: FontWeight.w700,
              fontSize: compact ? 14 : 15,
            ),
          ),
          if (subtitle != null) ...[
            const SizedBox(height: 2),
            Text(
              subtitle!,
              style: TextStyle(
                color: context.appColors.textMuted,
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
        color: context.appColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: context.appColors.border),
      ),
      child: Column(
        children: [
          for (var i = 0; i < rows.length; i++) ...[
            if (i > 0)
              Divider(
                height: 1,
                thickness: 1,
                color: context.appColors.border,
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
                        color: context.appColors.textSecondary,
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
                      style: TextStyle(
                        color: context.appColors.textPrimary,
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
