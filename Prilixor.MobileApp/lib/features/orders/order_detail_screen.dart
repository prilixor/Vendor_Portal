import 'dart:async';

import 'package:flutter/material.dart';
import '../../core/theme.dart';
import 'package:provider/provider.dart';
import '../../core/providers/order_detail_provider.dart';
import '../../core/providers/order_provider.dart';
import '../../core/models/order_model.dart';
import '../../core/models/order_image_request_model.dart';
import '../../core/utils/rental_period.dart';
import '../../shared/widgets/brand_page_loader.dart';
import '../../shared/widgets/catalog_image.dart';
import '../../shared/widgets/struck_price.dart';
import '../product/product_detail_screen.dart';
import '../../core/providers/chat_provider.dart';
import '../chat/chat_detail_screen.dart';
import '../profile/support_screen.dart';

class OrderDetailScreen extends StatefulWidget {
  final String orderNumber;
  final List<OrderModel> ordersInGroup;

  OrderDetailScreen({super.key, required this.orderNumber, required this.ordersInGroup});

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> with WidgetsBindingObserver {
  int _extensionDays = 1;
  int _selectedOrderIndex = 0;
  final Set<String> _photoRequestSelection = {};
  late List<OrderModel> _ordersInGroup;
  Timer? _pollTimer;
  bool _refreshInFlight = false;

  /// Keep status/photos in sync with vendor actions while this screen is open.
  static const _pollInterval = Duration(seconds: 15);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _ordersInGroup = List<OrderModel>.from(widget.ordersInGroup);

    _selectedOrderIndex = _ordersInGroup.indexWhere((o) => o.orderNumber == widget.orderNumber);
    if (_selectedOrderIndex == -1) _selectedOrderIndex = 0;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      _refreshLive(silent: false);
      _pollTimer = Timer.periodic(_pollInterval, (_) {
        if (mounted) _refreshLive(silent: true);
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
      _refreshLive(silent: true);
    }
  }

  Future<void> _fetchCurrentSubOrder() => _refreshLive(silent: false);

  Future<void> _refreshLive({required bool silent}) async {
    if (!mounted) return;
    if (_refreshInFlight) {
      if (silent) return;
      // Let the in-flight silent poll finish, then run a focused reload.
    }
    while (_refreshInFlight) {
      await Future<void>.delayed(const Duration(milliseconds: 50));
      if (!mounted) return;
    }
    _refreshInFlight = true;
    try {
      final detail = Provider.of<OrderDetailProvider>(context, listen: false);
      final orders = Provider.of<OrderProvider>(context, listen: false);

      // Force bypasses list silent-cooldown so detail stays fresh vs dashboard polls.
      await orders.fetchOrders(silent: silent, force: silent);
      if (!mounted) return;

      final byId = {for (final o in orders.orders) o.id: o};
      final merged = _ordersInGroup.map((o) => byId[o.id] ?? o).toList();

      final selectedId = merged[_selectedOrderIndex].id;
      await detail.fetchOrderDetail(selectedId, silent: silent);
      if (!mounted) return;

      if (detail.currentOrder != null) {
        final idx = merged.indexWhere((o) => o.id == detail.currentOrder!.id);
        if (idx >= 0) merged[idx] = detail.currentOrder!;
      }

      setState(() => _ordersInGroup = merged);

      await detail.fetchGroupImageRequests(
        _ordersInGroup.map((o) => o.id).toList(),
        silent: silent,
      );
      if (!mounted) return;
      _syncPhotoSelection(detail);
    } finally {
      _refreshInFlight = false;
    }
  }

  bool _canRequestForStatus(String status) {
    final compact = status.trim().toLowerCase().replaceAll(RegExp(r'\s+'), '_');
    return compact == 'pending' || compact == 'confirmed' || compact == 'in_transit';
  }

  List<OrderModel> _eligiblePhotoItems(OrderDetailProvider provider) {
    return _ordersInGroup
        .where(
          (o) =>
              _canRequestForStatus(o.status) &&
              provider.imageRequestFor(o.id) == null,
        )
        .toList();
  }

  void _syncPhotoSelection(OrderDetailProvider provider) {
    final eligible = _eligiblePhotoItems(provider).map((o) => o.id).toSet();
    setState(() {
      _photoRequestSelection
        ..removeWhere((id) => !eligible.contains(id))
        ..addAll(eligible);
    });
  }

  void _showExtensionBottomSheet(BuildContext context, OrderDetailProvider provider) {
    final colors = context.appColors;
    _extensionDays = 1;
    provider.clearQuotes();
    provider.quoteExtension(_ordersInGroup[_selectedOrderIndex].id, _extensionDays);

    showModalBottomSheet(
      context: context,
      backgroundColor: colors.surface,
      isScrollControlled: true,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setStateBottomSheet) {
            return Consumer<OrderDetailProvider>(
              builder: (context, provider, _) {
                return Padding(
                  padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom, left: 24, right: 24, top: 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Extend Rental', style: TextStyle(color: colors.textPrimary, fontSize: 22, fontWeight: FontWeight.bold)),
                  SizedBox(height: 8),
                  Text('Need more time? Extend your rental period below.', style: TextStyle(color: colors.textSecondary, fontSize: 14)),
                  SizedBox(height: 24),
                  
                  // Days Selector
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Additional Days:', style: TextStyle(color: colors.textPrimary, fontSize: 16)),
                      Row(
                        children: [
                          IconButton(
                            icon: Icon(Icons.remove_circle_outline, color: colors.textMuted),
                            onPressed: _extensionDays > 1
                                ? () {
                                    setStateBottomSheet(() => _extensionDays--);
                                    provider.quoteExtension(_ordersInGroup[_selectedOrderIndex].id, _extensionDays);
                                  }
                                : null,
                          ),
                          Text('$_extensionDays', style: TextStyle(color: colors.textPrimary, fontSize: 20, fontWeight: FontWeight.bold)),
                          IconButton(
                            icon: Icon(Icons.add_circle_outline, color: Color(0xFF6C63FF)),
                            onPressed: () {
                              setStateBottomSheet(() => _extensionDays++);
                              provider.quoteExtension(_ordersInGroup[_selectedOrderIndex].id, _extensionDays);
                            },
                          ),
                        ],
                      ),
                    ],
                  ),
                  SizedBox(height: 24),
                  
                  // Quote details
                  if (provider.isActionLoading)
                    Center(child: CircularProgressIndicator(color: Color(0xFF6C63FF)))
                  else if (provider.extensionQuote != null)
                    Container(
                      padding: EdgeInsets.all(16),
                      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.05), borderRadius: BorderRadius.circular(12)),
                      child: Column(
                        children: [
                          _buildQuoteRow(context, 'Extension Cost', provider.extensionQuote!.extensionAmount),
                          // Service fee UI hidden — keep for future re-enable
                          if (false) ...[
                            SizedBox(height: 8),
                            _buildQuoteRow(context, 'Service Fee', provider.extensionQuote!.serviceFeeAmount),
                          ],
                          SizedBox(height: 8),
                          _buildQuoteRow(context, 'GST', provider.extensionQuote!.gstAmount),
                          Divider(color: colors.border, height: 24),
                          _buildQuoteRow(context, 'Total Due Now', provider.extensionQuote!.totalAmount, isBold: true),
                          SizedBox(height: 8),
                          Text(
                            'New End Date: ${provider.extensionQuote!.newEndDate.split('T')[0]}',
                            style: TextStyle(color: Colors.greenAccent, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                  
                  SizedBox(height: 32),
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(backgroundColor: Color(0xFF6C63FF)),
                      onPressed: provider.isActionLoading || provider.extensionQuote == null
                          ? null
                          : () async {
                              final success = await provider.processExtension(_ordersInGroup[_selectedOrderIndex].id, _extensionDays);
                              if (success && context.mounted) {
                                Navigator.pop(context);
                                ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Rental extended successfully!'), backgroundColor: Colors.green));
                              }
                            },
                      child: Text('Confirm Extension', style: TextStyle(fontSize: 18, color: Colors.white, fontWeight: FontWeight.bold)),
                    ),
                  ),
                  SizedBox(height: 32),
                ],
              ),
            );
              },
            );
          },
        );
      },
    );
  }

  void _showBuyoutBottomSheet(BuildContext context, OrderDetailProvider provider) {
    final colors = context.appColors;
    provider.clearQuotes();
    provider.quoteBuyout(_ordersInGroup[_selectedOrderIndex].id);

    showModalBottomSheet(
      context: context,
      backgroundColor: colors.surface,
      isScrollControlled: true,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) {
        return Consumer<OrderDetailProvider>(
          builder: (context, provider, _) {
            return Padding(
              padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom, left: 24, right: 24, top: 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Buyout Equipment', style: TextStyle(color: colors.textPrimary, fontSize: 22, fontWeight: FontWeight.bold)),
                  SizedBox(height: 8),
                  Text('Love it? Keep it! We will deduct a portion of your rental fees from the purchase price.', style: TextStyle(color: colors.textSecondary, fontSize: 14)),
                  SizedBox(height: 24),
                  
                  if (provider.isActionLoading)
                    Center(child: CircularProgressIndicator(color: Color(0xFF6C63FF)))
                  else if (provider.buyoutQuote != null)
                    Container(
                      padding: EdgeInsets.all(16),
                      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.05), borderRadius: BorderRadius.circular(12)),
                      child: Column(
                        children: [
                          _buildQuoteRow(context, 'Base Price', provider.buyoutQuote!.baseBuyoutAmount),
                          SizedBox(height: 8),
                          _buildQuoteRow(context, 'Rental Deduction', -provider.buyoutQuote!.rentDeductionAmount, color: Colors.greenAccent),
                          // Service fee UI hidden — keep for future re-enable
                          if (false) ...[
                            SizedBox(height: 8),
                            _buildQuoteRow(context, 'Service Fee', provider.buyoutQuote!.serviceFeeAmount),
                          ],
                          SizedBox(height: 8),
                          _buildQuoteRow(context, 'GST', provider.buyoutQuote!.gstAmount),
                          Divider(color: colors.border, height: 24),
                          _buildQuoteRow(context, 'Total Due Now', provider.buyoutQuote!.totalAmount, isBold: true),
                        ],
                      ),
                    ),
                  
                  SizedBox(height: 32),
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(backgroundColor: Color(0xFF6C63FF)),
                      onPressed: provider.isActionLoading || provider.buyoutQuote == null
                          ? null
                          : () async {
                              final success = await provider.processBuyout(_ordersInGroup[_selectedOrderIndex].id);
                              if (success && context.mounted) {
                                Navigator.pop(context);
                                ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Item purchased successfully!'), backgroundColor: Colors.green));
                              }
                            },
                      child: Text('Confirm Purchase', style: TextStyle(fontSize: 18, color: Colors.white, fontWeight: FontWeight.bold)),
                    ),
                  ),
                  SizedBox(height: 32),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildQuoteRow(BuildContext context, String label, double amount, {bool isBold = false, Color? color}) {
    final colors = context.appColors;
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: TextStyle(color: color ?? colors.textSecondary, fontSize: isBold ? 16 : 14, fontWeight: isBold ? FontWeight.bold : FontWeight.normal)),
        Text('₹${amount.toStringAsFixed(2)}', style: TextStyle(color: color ?? Colors.white, fontSize: isBold ? 18 : 14, fontWeight: isBold ? FontWeight.bold : FontWeight.normal)),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final provider = Provider.of<OrderDetailProvider>(context);
    final groupTotal = _ordersInGroup.fold<double>(0, (sum, o) => sum + o.totalAmount);
    final groupDeposit = _ordersInGroup.fold<double>(0, (sum, o) => sum + o.depositAmount);
    final cleanOrderGroupNumber = _ordersInGroup.first.orderNumber.replaceAll(RegExp(r'-\d{2}$'), '');

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        title: Text('Back to orders', style: TextStyle(color: colors.textSecondary, fontSize: 16)),
        backgroundColor: colors.background,
        iconTheme: IconThemeData(color: colors.textSecondary),
        elevation: 0,
        titleSpacing: 0,
      ),
      body: Column(
        children: [
          // Header Card
          Container(
            margin: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            padding: EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: colors.surface, // Match dark mode card
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: colors.border),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('ORDER GROUP', style: TextStyle(color: colors.textMuted, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
                      SizedBox(height: 8),
                      Text(
                        cleanOrderGroupNumber,
                        style: TextStyle(color: colors.textPrimary, fontSize: 18, fontWeight: FontWeight.bold, height: 1.25),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      SizedBox(height: 4),
                      Text(
                        'Consolidated purchase overview',
                        style: TextStyle(color: colors.textMuted, fontSize: 13, height: 1.3),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 120),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        alignment: Alignment.centerRight,
                        child: Text(
                          '₹${groupTotal.toStringAsFixed(0)}',
                          style: TextStyle(color: colors.textPrimary, fontSize: 22, fontWeight: FontWeight.bold, height: 1.2),
                        ),
                      ),
                      SizedBox(height: 4),
                      Text(
                        '+ ₹${groupDeposit.toStringAsFixed(0)} deposit',
                        style: TextStyle(color: colors.textMuted, fontSize: 12, height: 1.3),
                        textAlign: TextAlign.right,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          Expanded(
            child: provider.isLoading && provider.currentOrder == null
                ? const BrandPageLoader()
                : provider.currentOrder == null
                    ? Center(child: Text(provider.errorMessage ?? 'Order not found', style: TextStyle(color: colors.textPrimary)))
                    : SingleChildScrollView(
                        padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + MediaQuery.paddingOf(context).bottom),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Items in this order
                            Container(
                              padding: EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: colors.surface,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: colors.border),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('Items in this Order', style: TextStyle(color: colors.textPrimary, fontSize: 18, fontWeight: FontWeight.bold)),
                                  const SizedBox(height: 4),
                                  Text('Select an item below to track its individual timeline and details.', style: TextStyle(color: colors.textMuted, fontSize: 12)),
                                  const SizedBox(height: 16),
                                  ...List.generate(_ordersInGroup.length, (index) {
                                    final order = _ordersInGroup[index];
                                    final isSelected = _selectedOrderIndex == index;
                                    final openRequest = provider.imageRequestFor(order.id);
                                    final photoCount = openRequest?.images.length ?? 0;
                                    final photoLabel = openRequest == null
                                        ? null
                                        : photoCount == 0
                                            ? 'Photos requested · waiting'
                                            : '$photoCount photo${photoCount == 1 ? '' : 's'} received';
                                    return GestureDetector(
                                      onTap: () {
                                        setState(() => _selectedOrderIndex = index);
                                        _fetchCurrentSubOrder();
                                      },
                                      child: Container(
                                        margin: EdgeInsets.only(bottom: 12),
                                        padding: EdgeInsets.all(12),
                                        decoration: BoxDecoration(
                                          color: isSelected ? Colors.white.withValues(alpha: 0.05) : Colors.transparent,
                                          border: Border.all(color: isSelected ? Color(0xFF6C63FF) : colors.border, width: isSelected ? 2 : 1),
                                          borderRadius: BorderRadius.circular(12),
                                        ),
                                        child: Row(
                                          children: [
                                            ClipRRect(
                                              borderRadius: BorderRadius.circular(8),
                                              child: SizedBox(
                                                width: 44,
                                                height: 44,
                                                child: CatalogImage(
                                                  url: order.listingPrimaryImageUrl,
                                                  width: 44,
                                                  height: 44,
                                                  fit: BoxFit.cover,
                                                ),
                                              ),
                                            ),
                                            SizedBox(width: 12),
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment: CrossAxisAlignment.start,
                                                children: [
                                                  Text(order.listingTitle, style: TextStyle(color: colors.textPrimary, fontSize: 14, fontWeight: FontWeight.bold), maxLines: 2, overflow: TextOverflow.ellipsis),
                                                  const SizedBox(height: 4),
                                                  Text('Qty: ${order.quantity}', style: TextStyle(color: colors.textMuted, fontSize: 12)),
                                                  if (photoLabel != null) ...[
                                                    const SizedBox(height: 4),
                                                    Row(
                                                      children: [
                                                        Icon(
                                                          Icons.photo_library_outlined,
                                                          size: 12,
                                                          color: photoCount == 0
                                                              ? Colors.amber
                                                              : const Color(0xFF34D399),
                                                        ),
                                                        const SizedBox(width: 4),
                                                        Expanded(
                                                          child: Text(
                                                            photoLabel,
                                                            style: TextStyle(
                                                              color: photoCount == 0
                                                                  ? Colors.amber
                                                                  : const Color(0xFF34D399),
                                                              fontSize: 11,
                                                              fontWeight: FontWeight.w600,
                                                            ),
                                                          ),
                                                        ),
                                                      ],
                                                    ),
                                                  ],
                                                  const SizedBox(height: 6),
                                                  Wrap(
                                                    children: [
                                                      Container(
                                                        padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                                        decoration: BoxDecoration(color: _getStatusColor(order.status).withValues(alpha: 0.2), borderRadius: BorderRadius.circular(16)),
                                                        child: Text(
                                                          _statusBadgeLabel(order.status),
                                                          maxLines: 1,
                                                          overflow: TextOverflow.ellipsis,
                                                          style: TextStyle(color: _getStatusColor(order.status), fontSize: 10, fontWeight: FontWeight.bold),
                                                        ),
                                                      ),
                                                    ],
                                                  ),
                                                ],
                                              ),
                                            ),
                                            SizedBox(width: 8),
                                            Column(
                                              crossAxisAlignment: CrossAxisAlignment.end,
                                              children: [
                                                Text('₹${order.totalAmount.toStringAsFixed(0)}', style: TextStyle(color: colors.textPrimary, fontSize: 16, fontWeight: FontWeight.bold)),
                                              ],
                                            ),
                                          ],
                                        ),
                                      ),
                                    );
                                  }),
                                ],
                              ),
                            ),
                            SizedBox(height: 24),

                            // Order Timeline
                            Container(
                              padding: EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: colors.surface,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: colors.border),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          'Order timeline',
                                          style: TextStyle(color: colors.textPrimary, fontSize: 18, fontWeight: FontWeight.bold),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                      TextButton(
                                        onPressed: () {
                                          if (provider.currentOrder != null) {
                                            Navigator.push(
                                              context,
                                              MaterialPageRoute(
                                                builder: (context) => ProductDetailScreen(listingId: provider.currentOrder!.listingId),
                                              ),
                                            );
                                          }
                                        }, 
                                        child: Text('View listing', style: TextStyle(color: Color(0xFF6C63FF)))
                                      ),
                                    ],
                                  ),
                                  Text('Tracking: ${provider.currentOrder!.listingTitle}', style: TextStyle(color: colors.textMuted, fontSize: 12)),
                                  SizedBox(height: 24),
                                  _buildTimeline(provider.currentOrder!.status, provider.currentOrder!.orderType),
                                ],
                              ),
                            ),
                            SizedBox(height: 24),

                            // Rental Details Grid
                            if (provider.currentOrder!.startDate != null)
                              Container(
                                padding: EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  color: colors.surface,
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(color: colors.border),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(provider.currentOrder!.orderType.toLowerCase() == 'buy' ? 'Purchase details' : 'Rental details', style: TextStyle(color: colors.textPrimary, fontSize: 18, fontWeight: FontWeight.bold)),
                                    SizedBox(height: 16),
                                    if (provider.currentOrder!.orderType.toLowerCase() == 'buy') ...[
                                      Row(
                                        children: [
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text('PURCHASE DATE', style: TextStyle(color: colors.textMuted, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
                                                SizedBox(height: 4),
                                                Text(_formatOrderDate(provider.currentOrder!.startDate), style: TextStyle(color: colors.textPrimary, fontSize: 14, fontWeight: FontWeight.bold)),
                                              ],
                                            ),
                                          ),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text('QUANTITY', style: TextStyle(color: colors.textMuted, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
                                                SizedBox(height: 4),
                                                Text('${provider.currentOrder!.quantity}', style: TextStyle(color: colors.textPrimary, fontSize: 14, fontWeight: FontWeight.bold)),
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                    ] else ...[
                                      Row(
                                        children: [
                                          Expanded(
                                            child: _labeledValue(
                                              colors,
                                              'START DATE',
                                              _formatOrderDate(provider.currentOrder!.startDate),
                                            ),
                                          ),
                                          const SizedBox(width: 12),
                                          Expanded(
                                            child: _labeledValue(
                                              colors,
                                              'END DATE',
                                              _formatOrderDate(provider.currentOrder!.endDate),
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 16),
                                      Row(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Expanded(
                                            child: _labeledValue(
                                              colors,
                                              'QUANTITY',
                                              '${provider.currentOrder!.quantity}',
                                            ),
                                          ),
                                          const SizedBox(width: 12),
                                          Expanded(
                                            child: _labeledValue(
                                              colors,
                                              'ORDER TYPE',
                                              provider.currentOrder!.orderType.toUpperCase(),
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 16),
                                      _labeledValue(
                                        colors,
                                        'RENTAL PERIOD',
                                        _rentalPeriodTitle(provider.currentOrder!),
                                        extra: _rentalPeriodExtra(colors, provider.currentOrder!),
                                      ),
                                    ],
                                  ],
                                ),
                              ),

                            if (provider.currentOrder!.hasMedicalReference) ...[
                              SizedBox(height: 24),
                              _MedicalReferenceCard(order: provider.currentOrder!),
                            ],

                            if (_shouldShowGroupPhotoSection(provider)) ...[
                              SizedBox(height: 24),
                              _GroupVendorPhotoRequestCard(
                                items: _ordersInGroup,
                                requestsByOrderId: provider.imageRequestsByOrderId,
                                selectedIds: _photoRequestSelection,
                                viewingOrderId: _ordersInGroup[_selectedOrderIndex].id,
                                loading: provider.imageRequestLoading,
                                busy: provider.isActionLoading,
                                onToggle: (orderId, selected) {
                                  setState(() {
                                    if (selected) {
                                      _photoRequestSelection.add(orderId);
                                    } else {
                                      _photoRequestSelection.remove(orderId);
                                    }
                                  });
                                },
                                onSelectAll: () {
                                  setState(() {
                                    _photoRequestSelection
                                      ..clear()
                                      ..addAll(
                                        _eligiblePhotoItems(provider).map((o) => o.id),
                                      );
                                  });
                                },
                                onClear: () => setState(_photoRequestSelection.clear),
                                onRequestAll: () => _requestPhotos(
                                  provider,
                                  _eligiblePhotoItems(provider).map((o) => o.id).toList(),
                                ),
                                onRequestSelected: () => _requestPhotos(
                                  provider,
                                  _photoRequestSelection.toList(),
                                ),
                              ),
                            ],
                            
                            SizedBox(height: 24),

                            // Bottom Action Buttons
                            Builder(
                              builder: (context) {
                                final order = provider.currentOrder!;
                                final status = order.status.trim().toLowerCase();
                                final canCancel = status == 'pending' || status == 'awaiting vendor acceptance';
                                final canExtendBuyout = status == 'active' && order.orderType.toLowerCase() == 'rent';

                                return Column(
                                  crossAxisAlignment: CrossAxisAlignment.stretch,
                                  children: [
                                    _fitOutlinedAction(
                                      colors: colors,
                                      icon: Icons.support_agent,
                                      label: 'BlinksMed support',
                                      onPressed: () {
                                        Navigator.push(
                                          context,
                                          MaterialPageRoute(
                                            builder: (_) => SupportScreen(orderRef: order.orderNumber),
                                          ),
                                        );
                                      },
                                    ),
                                    const SizedBox(height: 10),
                                    _fitOutlinedAction(
                                      colors: colors,
                                      icon: Icons.chat_bubble_outline,
                                      label: 'Chat with BlinksMed',
                                      onPressed: () async {
                                        final chatProvider = Provider.of<ChatProvider>(context, listen: false);
                                        final sessionId = await chatProvider.createSession(
                                          order.vendorId,
                                          order.id,
                                          subject: 'Chat regarding order ${order.orderNumber}: ${order.listingTitle}',
                                        );
                                        if (sessionId != null && context.mounted) {
                                          Navigator.push(
                                            context,
                                            MaterialPageRoute(
                                              builder: (context) => ChatDetailScreen(
                                                sessionId: sessionId,
                                                orderNumber: order.orderNumber,
                                                listingTitle: order.listingTitle,
                                              ),
                                            ),
                                          );
                                        } else if (context.mounted) {
                                          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Could not start chat session.')));
                                        }
                                      },
                                    ),
                                    if (canCancel) ...[
                                      SizedBox(height: 12),
                                      OutlinedButton.icon(
                                        style: OutlinedButton.styleFrom(
                                          foregroundColor: Colors.redAccent,
                                          side: BorderSide(color: Colors.redAccent),
                                          padding: EdgeInsets.symmetric(vertical: 16),
                                        ),
                                        icon: Icon(Icons.cancel_outlined, size: 18),
                                        label: Text('Cancel item request', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
                                        onPressed: provider.isActionLoading
                                            ? null
                                            : () async {
                                                final confirm = await showDialog<bool>(
                                                  context: context,
                                                  builder: (ctx) => AlertDialog(
                                                    backgroundColor: colors.surface,
                                                    title: Text('Cancel request?', style: TextStyle(color: colors.textPrimary)),
                                                    content: Text(
                                                      'This will cancel this item request. This cannot be undone.',
                                                      style: TextStyle(color: colors.textSecondary),
                                                    ),
                                                    actions: [
                                                      TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text('Keep', style: TextStyle(color: colors.textMuted))),
                                                      TextButton(onPressed: () => Navigator.pop(ctx, true), child: Text('Cancel request', style: TextStyle(color: Colors.redAccent))),
                                                    ],
                                                  ),
                                                );
                                                if (confirm != true || !context.mounted) return;
                                                final ok = await provider.cancelOrder(order.id);
                                                if (!context.mounted) return;
                                                if (ok) {
                                                  ScaffoldMessenger.of(context).showSnackBar(
                                                    SnackBar(content: Text('Order cancelled.'), backgroundColor: Colors.green),
                                                  );
                                                  Provider.of<OrderProvider>(context, listen: false).fetchOrders(silent: true);
                                                } else {
                                                  ScaffoldMessenger.of(context).showSnackBar(
                                                    SnackBar(content: Text(provider.errorMessage ?? 'Failed to cancel order'), backgroundColor: Colors.redAccent),
                                                  );
                                                }
                                              },
                                      ),
                                    ],
                                    if (canExtendBuyout) ...[
                                      SizedBox(height: 12),
                                      Row(
                                        children: [
                                          Expanded(
                                            child: ElevatedButton(
                                              style: ElevatedButton.styleFrom(backgroundColor: Color(0xFF6C63FF), padding: EdgeInsets.symmetric(vertical: 16)),
                                              onPressed: () => _showExtensionBottomSheet(context, provider),
                                              child: FittedBox(fit: BoxFit.scaleDown, child: Text('Extend Rental', style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold))),
                                            ),
                                          ),
                                          SizedBox(width: 12),
                                          Expanded(
                                            child: ElevatedButton(
                                              style: ElevatedButton.styleFrom(backgroundColor: colors.border, padding: EdgeInsets.symmetric(vertical: 16)),
                                              onPressed: () => _showBuyoutBottomSheet(context, provider),
                                              child: FittedBox(fit: BoxFit.scaleDown, child: Text('Buyout Item', style: TextStyle(color: colors.textPrimary))),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ],
                                );
                              },
                            ),
                            SizedBox(height: 32),
                          ],
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  String _formatOrderDate(String? raw) {
    if (raw == null || raw.trim().isEmpty) return '-';
    final parsed = DateTime.tryParse(raw);
    if (parsed == null) return raw.split('T').first;
    final local = parsed.isUtc ? parsed.toLocal() : parsed;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${months[local.month - 1]} ${local.day}, ${local.year}';
  }

  Widget _labeledValue(
    AppPalette colors,
    String label,
    String value, {
    Widget? extra,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(color: colors.textMuted, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1.2),
        ),
        const SizedBox(height: 6),
        Text(
          value,
          style: TextStyle(color: colors.textPrimary, fontSize: 14, fontWeight: FontWeight.bold, height: 1.35),
        ),
        if (extra != null) ...[
          const SizedBox(height: 6),
          extra,
        ],
      ],
    );
  }

  String _rentalPeriodTitle(OrderModel order) {
    if (order.orderType.toLowerCase() != 'rent') return 'Buy';
    final label = order.rentalDurationLabel?.trim();
    if (label != null && label.isNotEmpty) return label;
    return formatRentalDuration(order.rentalDays, order.rentalPeriodUnit);
  }

  Widget? _rentalPeriodExtra(AppPalette colors, OrderModel order) {
    if (order.orderType.toLowerCase() != 'rent') return null;
    final days = order.rentalDurationDays;
    final hasPlanLabel = order.rentalDurationLabel?.trim().isNotEmpty == true;
    final showDays = hasPlanLabel && days != null && days > 0;
    final showPrice = order.rentalFinalPrice != null;
    if (!showDays && !showPrice) return null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (showDays)
          Text(
            '$days day${days == 1 ? '' : 's'}',
            style: TextStyle(color: colors.textMuted, fontSize: 12, height: 1.3),
          ),
        if (showPrice) ...[
          if (showDays) const SizedBox(height: 6),
          Wrap(
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 8,
            runSpacing: 4,
            children: [
              if (order.rentalNormalPrice != null &&
                  order.rentalNormalPrice! > order.rentalFinalPrice!)
                StruckPrice(
                  '₹${order.rentalNormalPrice!.toStringAsFixed(0)}',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                ),
              Text(
                'Plan price ₹${order.rentalFinalPrice!.toStringAsFixed(0)}',
                style: TextStyle(color: colors.textMuted, fontSize: 12, height: 1.3),
              ),
            ],
          ),
        ],
      ],
    );
  }

  Widget _fitOutlinedAction({
    required AppPalette colors,
    required IconData icon,
    required String label,
    required VoidCallback onPressed,
  }) {
    return OutlinedButton(
      style: OutlinedButton.styleFrom(
        foregroundColor: colors.textPrimary,
        side: BorderSide(color: colors.border),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        minimumSize: const Size.fromHeight(48),
      ),
      onPressed: onPressed,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 18),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  bool _shouldShowGroupPhotoSection(OrderDetailProvider provider) {
    if (provider.imageRequestsByOrderId.isNotEmpty) return true;
    return _ordersInGroup.any((o) {
      final compact = o.status.trim().toLowerCase().replaceAll(RegExp(r'\s+'), '_');
      return compact == 'pending' ||
          compact == 'confirmed' ||
          compact == 'in_transit' ||
          compact == 'awaiting_vendor_acceptance' ||
          compact == 'pending_vendor_acceptance';
    });
  }

  Future<void> _requestPhotos(
    OrderDetailProvider provider,
    List<String> orderIds,
  ) async {
    if (orderIds.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Select at least one item.')),
      );
      return;
    }
    final result = await provider.createImageRequests(orderIds);
    if (!mounted) return;
    await provider.fetchGroupImageRequests(
      _ordersInGroup.map((o) => o.id).toList(),
    );
    if (!mounted) return;
    _syncPhotoSelection(provider);
    final message = result.succeeded == 0
        ? (provider.errorMessage ?? 'Failed to request photos.')
        : result.succeeded == 1
            ? 'Photo request sent to the supplier.'
            : 'Photo request sent to suppliers for ${result.succeeded} products.';
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: result.succeeded == 0 ? Colors.redAccent : null,
      ),
    );
  }

  String _statusBadgeLabel(String status) {
    final s = status.trim().toLowerCase().replaceAll('_', ' ');
    if (s == 'awaiting vendor acceptance' || s == 'pending vendor acceptance') {
      return 'Awaiting';
    }
    if (s == 'dispatch failed') return 'Failed';
    return status.replaceAll('_', ' ');
  }

  Color _getStatusColor(String status) {
    final colors = context.appColors;
    final s = status.toLowerCase().replaceAll('_', ' ');
    if (s == 'active') return Colors.greenAccent;
    if (s == 'pending' || s.contains('awaiting') || s == 'confirmed' || s.contains('transit')) return Colors.orangeAccent;
    if (s == 'cancelled' || s == 'canceled') return Colors.grey;
    if (s == 'bought_out' || s == 'bought out') return Colors.purpleAccent;
    return colors.textSecondary;
  }

  Widget _buildTimeline(String status, String orderType) {
    final colors = context.appColors;
    final s = status.toLowerCase();
    final isBuy = orderType.toLowerCase() == 'buy';
    
    int currentIndex = 1;
    if (s == 'confirmed') currentIndex = 2;
    if (s.contains('transit')) currentIndex = 3;
    if (s == 'delivered') currentIndex = 4;
    if (s == 'active') currentIndex = 5;
    if (s == 'returned' || s == 'bought_out') currentIndex = 6;

    final steps = isBuy ? ['Order Placed', 'Vendor Confirmed', 'Out for Delivery', 'Delivered & Purchased'] 
                        : ['Order Placed', 'Vendor Confirmed', 'Out for Delivery', 'Delivered', 'Rental Active', 'Returned'];

    return Column(
      children: List.generate(steps.length, (index) {
        final isDone = index < currentIndex - 1;
        final isCurrent = index == currentIndex - 1;
        
        Color dotColor;
        Widget? icon;
        
        if (isDone && !isCurrent) {
          dotColor = colors.textPrimary;
          icon = Icon(Icons.check, size: 14, color: colors.surface);
        } else if (isCurrent) {
          dotColor = Color(0xFF10B981); // Emerald Green
          icon = Container(width: 8, height: 8, decoration: BoxDecoration(color: colors.textPrimary, shape: BoxShape.circle));
        } else {
          dotColor = Colors.transparent;
        }

        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Column(
              children: [
                Container(
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(
                    color: dotColor,
                    shape: BoxShape.circle,
                    border: Border.all(color: isDone || isCurrent ? dotColor : colors.border, width: 2),
                  ),
                  child: Center(child: icon),
                ),
                if (index < steps.length - 1)
                  Container(
                    width: 2,
                    height: 40,
                    color: colors.border,
                  ),
              ],
            ),
            SizedBox(width: 16),
            Expanded(
              child: Padding(
                padding: EdgeInsets.only(top: 2),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      steps[index],
                      style: TextStyle(
                        color: isDone || isCurrent ? colors.textPrimary : colors.textMuted,
                        fontSize: 16,
                      ),
                    ),
                    if (isCurrent && steps[index] == 'Rental Active')
                      Padding(
                        padding: EdgeInsets.only(top: 4.0),
                        child: Text('Rental is currently active', style: TextStyle(color: Color(0xFF10B981), fontSize: 12)),
                      ),
                  ],
                ),
              ),
            ),
          ],
        );
      }),
    );
  }

}

class _GroupVendorPhotoRequestCard extends StatelessWidget {
  final List<OrderModel> items;
  final Map<String, OrderImageRequestModel> requestsByOrderId;
  final Set<String> selectedIds;
  final String viewingOrderId;
  final bool loading;
  final bool busy;
  final void Function(String orderId, bool selected) onToggle;
  final VoidCallback onSelectAll;
  final VoidCallback onClear;
  final Future<void> Function() onRequestAll;
  final Future<void> Function() onRequestSelected;

  const _GroupVendorPhotoRequestCard({
    required this.items,
    required this.requestsByOrderId,
    required this.selectedIds,
    required this.viewingOrderId,
    required this.loading,
    required this.busy,
    required this.onToggle,
    required this.onSelectAll,
    required this.onClear,
    required this.onRequestAll,
    required this.onRequestSelected,
  });

  bool _canRequest(String status) {
    final compact = status.trim().toLowerCase().replaceAll(RegExp(r'\s+'), '_');
    return compact == 'pending' || compact == 'confirmed' || compact == 'in_transit';
  }

  Widget _photoActionButton({
    required AppPalette colors,
    required bool filled,
    required Widget icon,
    required String label,
    required VoidCallback? onPressed,
  }) {
    final child = Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        icon,
        const SizedBox(width: 8),
        Flexible(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: colors.textPrimary,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );

    final style = filled
        ? ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF6C63FF),
            foregroundColor: colors.textPrimary,
            disabledBackgroundColor: const Color(0xFF6C63FF).withValues(alpha: 0.45),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            minimumSize: const Size.fromHeight(48),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          )
        : OutlinedButton.styleFrom(
            foregroundColor: colors.textPrimary,
            side: BorderSide(color: colors.border),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            minimumSize: const Size.fromHeight(48),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          );

    return SizedBox(
      width: double.infinity,
      child: filled
          ? ElevatedButton(style: style, onPressed: onPressed, child: child)
          : OutlinedButton(style: style, onPressed: onPressed, child: child),
    );
  }

  void _preview(BuildContext context, OrderImageModel image) {
    final colors = context.appColors;
    showDialog<void>(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.black,
        insetPadding: EdgeInsets.all(16),
        child: Stack(
          children: [
            InteractiveViewer(
              child: AspectRatio(
                aspectRatio: 1,
                child: Image.network(
                  image.fileUrl,
                  fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) => Center(
                    child: Icon(Icons.broken_image_outlined, color: colors.textMuted, size: 48),
                  ),
                ),
              ),
            ),
            // Dark chip so the close control stays visible on light images too.
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

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final eligible = items
        .where((o) => _canRequest(o.status) && !requestsByOrderId.containsKey(o.id))
        .toList();
    final withRequest = items.where((o) => requestsByOrderId.containsKey(o.id)).toList();
    final multi = items.length > 1;

    return Material(
      color: Colors.white.withValues(alpha: 0.05),
      borderRadius: BorderRadius.circular(16),
      clipBehavior: Clip.antiAlias,
      child: Container(
      width: double.infinity,
      padding: EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Request photos from your supplier',
            style: TextStyle(color: colors.textPrimary, fontSize: 16, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 6),
          Text(
            multi
                ? 'Sent to each product’s supplier (vendor) — not BlinksMed support. Choose products or request all. Up to 5 photos per item.'
                : 'Sent to the supplier for this product — not BlinksMed support chat below. Up to 5 photos.',
            style: TextStyle(color: colors.textMuted, fontSize: 12, height: 1.35),
          ),
          SizedBox(height: 14),
          if (loading)
            Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Row(
                children: [
                  SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF6C63FF)),
                  ),
                  SizedBox(width: 10),
                  Text('Loading photo requests…', style: TextStyle(color: colors.textMuted, fontSize: 13)),
                ],
              ),
            )
          else ...[
            if (eligible.isNotEmpty) ...[
              if (multi) ...[
                Row(
                  children: [
                    TextButton(
                      onPressed: busy ? null : onSelectAll,
                      child: Text('Select all', style: TextStyle(color: Color(0xFF6C63FF), fontSize: 12)),
                    ),
                    TextButton(
                      onPressed: busy ? null : onClear,
                      child: Text('Clear', style: TextStyle(color: colors.textMuted, fontSize: 12)),
                    ),
                  ],
                ),
                ...eligible.map((item) {
                  final checked = selectedIds.contains(item.id);
                  return CheckboxListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    value: checked,
                    activeColor: Color(0xFF6C63FF),
                    checkColor: Colors.white,
                    title: Text(
                      item.listingTitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: colors.textPrimary, fontSize: 13),
                    ),
                    subtitle: Text(
                      item.status.replaceAll('_', ' '),
                      style: TextStyle(color: colors.textMuted, fontSize: 11),
                    ),
                    onChanged: busy ? null : (v) => onToggle(item.id, v == true),
                  );
                }),
                SizedBox(height: 8),
                _photoActionButton(
                  colors: colors,
                  filled: true,
                  icon: busy
                      ? SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: colors.textPrimary),
                        )
                      : Icon(Icons.photo_library_outlined, size: 18, color: colors.textPrimary),
                  label: 'Request all (${eligible.length})',
                  onPressed: busy ? null : onRequestAll,
                ),
                SizedBox(height: 10),
                _photoActionButton(
                  colors: colors,
                  filled: false,
                  icon: Icon(Icons.check_box_outlined, size: 18, color: colors.textPrimary),
                  label: 'Request selected (${selectedIds.length})',
                  onPressed: busy || selectedIds.isEmpty ? null : onRequestSelected,
                ),
              ] else
                _photoActionButton(
                  colors: colors,
                  filled: false,
                  icon: busy
                      ? SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: colors.textSecondary),
                        )
                      : Icon(Icons.photo_library_outlined, size: 18, color: colors.textPrimary),
                  label: busy ? 'Sending…' : 'Request photos from supplier',
                  onPressed: busy ? null : onRequestSelected,
                ),
              SizedBox(height: 16),
            ],
            if (withRequest.isEmpty && eligible.isEmpty)
              Text(
                'You can request supplier photos after a supplier accepts each product.',
                style: TextStyle(color: colors.textMuted, fontSize: 13),
              ),
            if (withRequest.isNotEmpty) ...[
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'PHOTO REQUEST STATUS BY PRODUCT',
                    style: TextStyle(
                      color: colors.textSecondary,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.4,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    () {
                      final totalPhotos = withRequest.fold<int>(
                        0,
                        (sum, item) => sum + (requestsByOrderId[item.id]?.images.length ?? 0),
                      );
                      return '$totalPhotos photo${totalPhotos == 1 ? '' : 's'} received'
                          '${withRequest.length > 1 ? ' · ${withRequest.length} products requested' : ''}';
                    }(),
                    style: TextStyle(color: colors.textMuted, fontSize: 11, height: 1.3),
                  ),
                ],
              ),
              SizedBox(height: 10),
              ...withRequest.map((item) {
                final images = requestsByOrderId[item.id]?.images ?? const <OrderImageModel>[];
                final waiting = images.isEmpty;
                final viewing = item.id == viewingOrderId;
                return Container(
                  width: double.infinity,
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: waiting
                        ? Colors.amber.withValues(alpha: 0.08)
                        : colors.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: waiting
                          ? Colors.amber.withValues(alpha: 0.35)
                          : colors.border,
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  item.listingTitle,
                                  style: TextStyle(
                                    color: colors.textPrimary,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  '${item.status.replaceAll('_', ' ')}${viewing ? ' · currently viewing' : ''}',
                                  style: TextStyle(color: colors.textMuted, fontSize: 11),
                                ),
                              ],
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: waiting
                                  ? Colors.amber.withValues(alpha: 0.2)
                                  : const Color(0xFF34D399).withValues(alpha: 0.18),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              waiting
                                  ? 'Waiting for supplier photos'
                                  : '${images.length}/5 received',
                              style: TextStyle(
                                color: waiting ? Colors.amber : const Color(0xFF34D399),
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      if (waiting)
                        Text(
                          'Request already sent for this product \u2014 supplier has not uploaded photos yet.',
                          style: TextStyle(color: colors.textMuted, fontSize: 12, height: 1.35),
                        )
                      else
                        GridView.builder(
                          shrinkWrap: true,
                          physics: NeverScrollableScrollPhysics(),
                          itemCount: images.length,
                          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
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
                                  errorBuilder: (_, __, ___) => Center(
                                    child: Icon(Icons.broken_image_outlined, color: Colors.white38),
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                    ],
                  ),
                );
              }),
            ],
          ],
        ],
      ),
      ),
    );
  }
}

class _MedicalReferenceCard extends StatelessWidget {
  final OrderModel order;

  const _MedicalReferenceCard({required this.order});

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final doctorName = order.doctorName?.trim();
    final specialization = order.doctorSpecialization?.trim();
    final uniqueCode = order.doctorUniqueCode?.trim();
    final contact = order.doctorContactNumber?.trim();
    final hospitalName = order.hospitalName?.trim();
    final hospitalCity = order.hospitalCity?.trim();

    String? doctorValue;
    if (doctorName != null && doctorName.isNotEmpty) {
      doctorValue = specialization != null && specialization.isNotEmpty
          ? '$doctorName — $specialization'
          : doctorName;
    }

    String? hospitalValue;
    if (hospitalName != null && hospitalName.isNotEmpty) {
      hospitalValue = hospitalCity != null && hospitalCity.isNotEmpty
          ? '$hospitalName ($hospitalCity)'
          : hospitalName;
    }

    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Medical reference',
            style: TextStyle(color: colors.textPrimary, fontSize: 18, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 16),
          if (doctorValue != null) _labeledRow(context, 'Doctor', doctorValue),
          if (uniqueCode != null && uniqueCode.isNotEmpty) ...[
            if (doctorValue != null) SizedBox(height: 12),
            _labeledRow(
              context,
              'Unique ID',
              uniqueCode,
              valueStyle: TextStyle(
                color: Color(0xFF2DD4BF),
                fontSize: 14,
                fontWeight: FontWeight.w700,
                fontFamily: 'monospace',
                letterSpacing: 1.2,
              ),
            ),
          ],
          if (contact != null && contact.isNotEmpty) ...[
            SizedBox(height: 12),
            _labeledRow(context, 'Contact', contact),
          ],
          if (hospitalValue != null) ...[
            SizedBox(height: 12),
            _labeledRow(context, 'Hospital', hospitalValue),
          ],
        ],
      ),
    );
  }

  Widget _labeledRow(BuildContext context, String label, String value, {TextStyle? valueStyle}) {
    final colors = context.appColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: TextStyle(
            color: colors.textMuted,
            fontSize: 10,
            fontWeight: FontWeight.bold,
            letterSpacing: 1.2,
          ),
        ),
        SizedBox(height: 4),
        Text(
          value,
          style: valueStyle ??
              TextStyle(color: colors.textPrimary, fontSize: 14, fontWeight: FontWeight.w600),
        ),
      ],
    );
  }
}
