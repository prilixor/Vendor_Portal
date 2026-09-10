import 'dart:async';

import 'package:flutter/material.dart';
import '../../core/theme.dart';
import 'package:provider/provider.dart';
import '../../core/providers/order_detail_provider.dart';
import '../../core/providers/order_provider.dart';
import '../../core/models/order_model.dart';
import '../../core/models/order_image_request_model.dart';
import '../../core/utils/rental_period.dart';
import '../../core/utils/order_badges.dart';
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
  static const _cardRadius = 14.0;
  static const _sectionGap = 12.0;
  static const _cardPadding = EdgeInsets.fromLTRB(12, 12, 12, 12);

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

  TextStyle _sectionTitleStyle(AppPalette colors) => TextStyle(
        color: colors.textPrimary,
        fontSize: 15,
        fontWeight: FontWeight.w700,
        height: 1.2,
      );

  TextStyle _kickerStyle(AppPalette colors) => TextStyle(
        color: colors.textMuted,
        fontSize: 10,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.8,
      );

  BoxDecoration _cardDecoration(AppPalette colors) => BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(_cardRadius),
        border: Border.all(color: colors.border),
      );

  Widget _buildGroupSummaryRow(
    AppPalette colors,
    String orderNumber,
    double total,
    double deposit,
  ) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('ORDER GROUP', style: _kickerStyle(colors)),
              const SizedBox(height: 4),
              Text(
                orderNumber,
                style: TextStyle(
                  color: colors.textPrimary,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.2,
                  height: 1.2,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
        const SizedBox(width: 10),
        Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              '₹${total.toStringAsFixed(0)}',
              style: TextStyle(
                color: colors.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w700,
                height: 1.15,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
            const SizedBox(height: 2),
            Text(
              '+ ₹${deposit.toStringAsFixed(0)} deposit',
              style: TextStyle(color: colors.textMuted, fontSize: 11, height: 1.2),
              textAlign: TextAlign.right,
            ),
          ],
        ),
      ],
    );
  }

  Widget _detailGridRow(AppPalette colors, List<Widget> cells) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < cells.length; i++) ...[
          if (i > 0) const SizedBox(width: 10),
          Expanded(child: cells[i]),
        ],
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
      body: provider.isLoading && provider.currentOrder == null
          ? const BrandPageLoader()
          : provider.currentOrder == null
              ? Center(
                  child: Text(
                    provider.errorMessage ?? 'Order not found',
                    style: TextStyle(color: colors.textPrimary),
                  ),
                )
              : SingleChildScrollView(
                  padding: EdgeInsets.fromLTRB(16, 8, 16, 16 + MediaQuery.paddingOf(context).bottom),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Order group + items (matches web single card)
                      Container(
                        padding: _cardPadding,
                        decoration: _cardDecoration(colors),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _buildGroupSummaryRow(
                              colors,
                              cleanOrderGroupNumber,
                              groupTotal,
                              groupDeposit,
                            ),
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              child: Divider(height: 1, color: colors.border.withValues(alpha: 0.65)),
                            ),
                            Text('Items in this order', style: _sectionTitleStyle(colors)),
                            const SizedBox(height: 2),
                            Text(
                              'Select an item to track its timeline and details.',
                              style: TextStyle(color: colors.textMuted, fontSize: 11, height: 1.25),
                            ),
                            const SizedBox(height: 10),
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
                                  margin: EdgeInsets.only(bottom: index == _ordersInGroup.length - 1 ? 0 : 8),
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: isSelected ? Colors.white.withValues(alpha: 0.05) : Colors.transparent,
                                    border: Border.all(
                                      color: isSelected ? const Color(0xFF6C63FF) : colors.border,
                                      width: isSelected ? 1.5 : 1,
                                    ),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Row(
                                    children: [
                                      ClipRRect(
                                        borderRadius: BorderRadius.circular(8),
                                        child: SizedBox(
                                          width: 40,
                                          height: 40,
                                          child: CatalogImage(
                                            url: order.listingPrimaryImageUrl,
                                            width: 40,
                                            height: 40,
                                            fit: BoxFit.cover,
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              order.listingTitle,
                                              style: TextStyle(
                                                color: colors.textPrimary,
                                                fontSize: 13,
                                                fontWeight: FontWeight.w700,
                                                height: 1.2,
                                              ),
                                              maxLines: 2,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                            const SizedBox(height: 3),
                                            Row(
                                              children: [
                                                Text(
                                                  'Qty ${order.quantity}',
                                                  style: TextStyle(color: colors.textMuted, fontSize: 11),
                                                ),
                                                const SizedBox(width: 6),
                                                Flexible(
                                                  child: Container(
                                                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                                    decoration: BoxDecoration(
                                                      color: _getStatusColor(order.status).withValues(alpha: 0.18),
                                                      borderRadius: BorderRadius.circular(999),
                                                    ),
                                                    child: Text(
                                                      formatOrderStatusLabel(order.status),
                                                      maxLines: 1,
                                                      overflow: TextOverflow.ellipsis,
                                                      style: TextStyle(
                                                        color: _getStatusColor(order.status),
                                                        fontSize: 10,
                                                        fontWeight: FontWeight.w700,
                                                      ),
                                                    ),
                                                  ),
                                                ),
                                              ],
                                            ),
                                            if (photoLabel != null) ...[
                                              const SizedBox(height: 3),
                                              Text(
                                                photoLabel,
                                                style: TextStyle(
                                                  color: photoCount == 0
                                                      ? (context.isDarkMode ? Colors.amber : const Color(0xFFD97706))
                                                      : (context.isDarkMode ? const Color(0xFF34D399) : const Color(0xFF059669)),
                                                  fontSize: 10,
                                                  fontWeight: FontWeight.w600,
                                                ),
                                              ),
                                            ],
                                          ],
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Text(
                                        '₹${order.totalAmount.toStringAsFixed(0)}',
                                        style: TextStyle(
                                          color: colors.textPrimary,
                                          fontSize: 14,
                                          fontWeight: FontWeight.w700,
                                          fontFeatures: const [FontFeature.tabularFigures()],
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            }),
                          ],
                        ),
                      ),
                      const SizedBox(height: _sectionGap),

                      // Order timeline
                      Container(
                        padding: _cardPadding,
                        decoration: _cardDecoration(colors),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text.rich(
                                    TextSpan(
                                      children: [
                                        TextSpan(text: 'Timeline', style: _sectionTitleStyle(colors)),
                                        TextSpan(
                                          text: ' · ${provider.currentOrder!.listingTitle}',
                                          style: TextStyle(
                                            color: colors.textMuted,
                                            fontSize: 12,
                                            fontWeight: FontWeight.w500,
                                          ),
                                        ),
                                      ],
                                    ),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                TextButton(
                                  style: TextButton.styleFrom(
                                    padding: const EdgeInsets.symmetric(horizontal: 4),
                                    minimumSize: Size.zero,
                                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                  ),
                                  onPressed: () {
                                    if (provider.currentOrder != null) {
                                      Navigator.push(
                                        context,
                                        MaterialPageRoute(
                                          builder: (context) => ProductDetailScreen(
                                            listingId: provider.currentOrder!.listingId,
                                          ),
                                        ),
                                      );
                                    }
                                  },
                                  child: const Text(
                                    'View listing',
                                    style: TextStyle(color: Color(0xFF6C63FF), fontSize: 12, fontWeight: FontWeight.w600),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            _buildTimeline(provider.currentOrder!.status, provider.currentOrder!.orderType),
                          ],
                        ),
                      ),
                      const SizedBox(height: _sectionGap),

                      // Rental / purchase details
                      if (provider.currentOrder!.startDate != null)
                        Container(
                          padding: _cardPadding,
                          decoration: _cardDecoration(colors),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                provider.currentOrder!.orderType.toLowerCase() == 'buy'
                                    ? 'Purchase details'
                                    : 'Rental details',
                                style: _sectionTitleStyle(colors),
                              ),
                              const SizedBox(height: 10),
                              if (provider.currentOrder!.orderType.toLowerCase() == 'buy') ...[
                                _detailGridRow(
                                  colors,
                                  [
                                    _labeledValue(
                                      colors,
                                      'PURCHASE DATE',
                                      _formatOrderDate(provider.currentOrder!.startDate),
                                    ),
                                    _labeledValue(
                                      colors,
                                      'QUANTITY',
                                      '${provider.currentOrder!.quantity}',
                                    ),
                                  ],
                                ),
                              ] else ...[
                                _detailGridRow(
                                  colors,
                                  [
                                    _labeledValue(
                                      colors,
                                      'START DATE',
                                      _formatOrderDate(provider.currentOrder!.startDate),
                                    ),
                                    _labeledValue(
                                      colors,
                                      'END DATE',
                                      _formatOrderDate(provider.currentOrder!.endDate),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 10),
                                _detailGridRow(
                                  colors,
                                  [
                                    _labeledValue(
                                      colors,
                                      'QUANTITY',
                                      '${provider.currentOrder!.quantity}',
                                    ),
                                    _labeledValue(
                                      colors,
                                      'ORDER TYPE',
                                      formatOrderTypeLabel(provider.currentOrder!.orderType),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 10),
                                _labeledValue(
                                  colors,
                                  'RENTAL PERIOD',
                                  _rentalPeriodTitle(provider.currentOrder!),
                                  subtitleWidget: _buildRentalPeriodMeta(
                                    colors,
                                    provider.currentOrder!,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),

                      if (provider.currentOrder!.hasMedicalReference) ...[
                        const SizedBox(height: _sectionGap),
                        _MedicalReferenceCard(order: provider.currentOrder!),
                      ],

                      if (_shouldShowGroupPhotoSection(provider)) ...[
                        const SizedBox(height: _sectionGap),
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

                      const SizedBox(height: _sectionGap),

                      // Bottom action buttons
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
                              const SizedBox(height: 8),
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
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(content: Text('Could not start chat session.')),
                                    );
                                  }
                                },
                              ),
                              if (canCancel) ...[
                                const SizedBox(height: 8),
                                OutlinedButton.icon(
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: Colors.redAccent,
                                    side: const BorderSide(color: Colors.redAccent),
                                    padding: const EdgeInsets.symmetric(vertical: 12),
                                    minimumSize: const Size.fromHeight(44),
                                  ),
                                  icon: const Icon(Icons.cancel_outlined, size: 18),
                                  label: const Text(
                                    'Cancel item request',
                                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                                  ),
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
                                                TextButton(
                                                  onPressed: () => Navigator.pop(ctx, false),
                                                  child: Text('Keep', style: TextStyle(color: colors.textMuted)),
                                                ),
                                                TextButton(
                                                  onPressed: () => Navigator.pop(ctx, true),
                                                  child: Text('Cancel request', style: TextStyle(color: Colors.redAccent)),
                                                ),
                                              ],
                                            ),
                                          );
                                          if (confirm != true || !context.mounted) return;
                                          final ok = await provider.cancelOrder(order.id);
                                          if (!context.mounted) return;
                                          if (ok) {
                                            ScaffoldMessenger.of(context).showSnackBar(
                                              const SnackBar(
                                                content: Text('Order cancelled.'),
                                                backgroundColor: Colors.green,
                                              ),
                                            );
                                            Provider.of<OrderProvider>(context, listen: false).fetchOrders(silent: true);
                                          } else {
                                            ScaffoldMessenger.of(context).showSnackBar(
                                              SnackBar(
                                                content: Text(provider.errorMessage ?? 'Failed to cancel order'),
                                                backgroundColor: Colors.redAccent,
                                              ),
                                            );
                                          }
                                        },
                                ),
                              ],
                              if (canExtendBuyout) ...[
                                const SizedBox(height: 8),
                                Row(
                                  children: [
                                    Expanded(
                                      child: ElevatedButton(
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: const Color(0xFF6C63FF),
                                          padding: const EdgeInsets.symmetric(vertical: 12),
                                          minimumSize: const Size.fromHeight(44),
                                        ),
                                        onPressed: () => _showExtensionBottomSheet(context, provider),
                                        child: FittedBox(
                                          fit: BoxFit.scaleDown,
                                          child: Text(
                                            'Extend Rental',
                                            style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w700),
                                          ),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: ElevatedButton(
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: colors.border,
                                          padding: const EdgeInsets.symmetric(vertical: 12),
                                          minimumSize: const Size.fromHeight(44),
                                        ),
                                        onPressed: () => _showBuyoutBottomSheet(context, provider),
                                        child: FittedBox(
                                          fit: BoxFit.scaleDown,
                                          child: Text('Buyout Item', style: TextStyle(color: colors.textPrimary)),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ],
                          );
                        },
                      ),
                      const SizedBox(height: 16),
                    ],
                  ),
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
    String? subtitle,
    Widget? subtitleWidget,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label,
          style: TextStyle(
            color: colors.textMuted,
            fontSize: 10,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.6,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          value,
          style: TextStyle(
            color: colors.textPrimary,
            fontSize: 13,
            fontWeight: FontWeight.w600,
            height: 1.2,
          ),
        ),
        if (subtitleWidget != null) ...[
          const SizedBox(height: 2),
          subtitleWidget,
        ] else if (subtitle != null && subtitle.isNotEmpty) ...[
          const SizedBox(height: 2),
          Text(
            subtitle,
            style: TextStyle(color: colors.textMuted, fontSize: 11, height: 1.25),
          ),
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

  Widget? _buildRentalPeriodMeta(AppPalette colors, OrderModel order) {
    if (order.orderType.toLowerCase() != 'rent') return null;

    final days = order.rentalDurationDays;
    final hasPlanLabel = order.rentalDurationLabel?.trim().isNotEmpty == true;
    final showDays = hasPlanLabel && days != null && days > 0;
    final showPrice = order.rentalFinalPrice != null;
    final hasDiscount = order.rentalNormalPrice != null &&
        showPrice &&
        order.rentalNormalPrice! > order.rentalFinalPrice!;

    if (!showDays && !showPrice) return null;

    final muted = TextStyle(color: colors.textMuted, fontSize: 11, height: 1.25);

    return Wrap(
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: 6,
      runSpacing: 2,
      children: [
        if (showDays) Text('$days day${days == 1 ? '' : 's'}', style: muted),
        if (showDays && (hasDiscount || showPrice))
          Text('·', style: muted.copyWith(color: colors.textMuted.withValues(alpha: 0.5))),
        if (hasDiscount)
          StruckPrice(
            '₹${order.rentalNormalPrice!.toStringAsFixed(0)}',
            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
          ),
        if (showPrice)
          Text(
            'Plan price ₹${order.rentalFinalPrice!.toStringAsFixed(0)}',
            style: muted,
          ),
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
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
        minimumSize: const Size.fromHeight(44),
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

  Color _getStatusColor(String status) {
    final colors = context.appColors;
    final isDark = context.isDarkMode;
    final s = status.toLowerCase().replaceAll('_', ' ');
    if (s == 'active') return isDark ? Colors.greenAccent : const Color(0xFF059669);
    if (s == 'pending' || s.contains('awaiting') || s == 'confirmed' || s.contains('transit')) {
      return isDark ? Colors.orangeAccent : const Color(0xFFD97706);
    }
    if (s == 'cancelled' || s == 'canceled') return Colors.grey;
    if (s == 'bought_out' || s == 'bought out') return isDark ? Colors.purpleAccent : const Color(0xFF7C3AED);
    return colors.textSecondary;
  }

  Widget _buildTimeline(String status, String orderType) {
    final colors = context.appColors;
    final progress = _timelineProgress(status, orderType);

    if (progress.cancelled) {
      return Text(
        'This order was cancelled — steps shown may have completed before cancellation.',
        style: TextStyle(color: colors.textMuted, fontSize: 13, height: 1.35),
      );
    }

    final steps = _timelineSteps(orderType);
    final isRentalActiveCurrent = progress.currentIndex != null &&
        steps[progress.currentIndex!].key == 'active' &&
        orderType.toLowerCase() != 'buy';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: List.generate(steps.length, (index) {
        final step = steps[index];
        final isDone = index <= progress.completedThrough;
        final isCurrent = progress.currentIndex == index;
        final isUpcoming = !isDone && !isCurrent;
        final isRentalActiveCurrentStep =
            isRentalActiveCurrent && step.key == 'active';
        final isLast = index == steps.length - 1;

        final connectorColor = isDone
            ? colors.textPrimary.withValues(alpha: 0.35)
            : colors.border.withValues(alpha: 0.9);

        // Explicit row height — IntrinsicHeight + Expanded fails to paint on Flutter web.
        final rowHeight = isCurrent ? 48.0 : 34.0;
        const dotTop = 2.0;
        const dotSize = 18.0;
        const lineWidth = 2.0;
        const lineLeft = (dotSize - lineWidth) / 2;
        // Extend slightly into the next row so the rail meets the following dot.
        const lineOverlap = 10.0;

        return SizedBox(
          height: rowHeight,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              if (!isLast)
                Positioned(
                  left: lineLeft,
                  top: dotTop + dotSize,
                  width: lineWidth,
                  height: rowHeight - dotTop - dotSize + lineOverlap,
                  child: ColoredBox(color: connectorColor),
                ),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(top: dotTop),
                    child: _CustomerOrderTimelineDot(
                      isDone: isDone,
                      isCurrent: isCurrent,
                      isUpcoming: isUpcoming,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          step.label,
                          style: TextStyle(
                            color: isRentalActiveCurrentStep
                                ? (context.isDarkMode
                                    ? const Color(0xFF6EE7B7)
                                    : const Color(0xFF047857))
                                : isUpcoming
                                    ? colors.textMuted
                                    : colors.textPrimary,
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                            height: 1.25,
                          ),
                        ),
                        if (isCurrent)
                          Padding(
                            padding: const EdgeInsets.only(top: 2),
                            child: Text(
                              'In progress',
                              style: TextStyle(
                                color: colors.textMuted,
                                fontSize: 11,
                                height: 1.2,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      }),
    );
  }

}

class _TimelineStepData {
  final String key;
  final String label;

  const _TimelineStepData({required this.key, required this.label});
}

class _TimelineProgress {
  final bool cancelled;
  final int completedThrough;
  final int? currentIndex;

  const _TimelineProgress({
    required this.cancelled,
    required this.completedThrough,
    required this.currentIndex,
  });
}

List<_TimelineStepData> _timelineSteps(String orderType) {
  final isBuy = orderType.toLowerCase() == 'buy';
  if (isBuy) {
    return const [
      _TimelineStepData(key: 'placed', label: 'Order Placed'),
      _TimelineStepData(key: 'confirmed', label: 'Supplier Confirmed'),
      _TimelineStepData(key: 'out', label: 'Out for Delivery'),
      _TimelineStepData(key: 'active', label: 'Delivered & Purchased'),
    ];
  }
  return const [
    _TimelineStepData(key: 'placed', label: 'Order Placed'),
    _TimelineStepData(key: 'confirmed', label: 'Supplier Confirmed'),
    _TimelineStepData(key: 'out', label: 'Out for Delivery'),
    _TimelineStepData(key: 'delivered', label: 'Delivered'),
    _TimelineStepData(key: 'active', label: 'Rental Active'),
    _TimelineStepData(key: 'returned', label: 'Returned'),
  ];
}

/// Matches web `getTimelineProgress` in CustomerOrderDetail.tsx.
_TimelineProgress _timelineProgress(String status, String orderType) {
  final raw = status.toLowerCase().trim();
  final compact = raw.replaceAll(RegExp(r'\s+'), '_');
  final isBuy = orderType.toLowerCase() == 'buy';

  if (compact == 'cancelled' || compact == 'canceled') {
    return const _TimelineProgress(cancelled: true, completedThrough: -1, currentIndex: null);
  }
  if (compact == 'dispatch_failed' || raw.contains('dispatch failed')) {
    return const _TimelineProgress(cancelled: false, completedThrough: 0, currentIndex: null);
  }
  if (compact == 'pending') {
    return const _TimelineProgress(cancelled: false, completedThrough: 0, currentIndex: 1);
  }
  if (compact == 'confirmed') {
    return const _TimelineProgress(cancelled: false, completedThrough: 1, currentIndex: 2);
  }
  if (compact == 'in_transit' || raw.contains('transit')) {
    return const _TimelineProgress(cancelled: false, completedThrough: 2, currentIndex: 3);
  }
  if (compact == 'active') {
    return isBuy
        ? const _TimelineProgress(cancelled: false, completedThrough: 3, currentIndex: null)
        : const _TimelineProgress(cancelled: false, completedThrough: 3, currentIndex: 4);
  }
  if (compact == 'returned') {
    return const _TimelineProgress(cancelled: false, completedThrough: 5, currentIndex: null);
  }
  return const _TimelineProgress(cancelled: false, completedThrough: 0, currentIndex: 1);
}

/// Timeline node — completed (dark + check), in-progress (emerald disc), upcoming (muted ring).
class _CustomerOrderTimelineDot extends StatelessWidget {
  final bool isDone;
  final bool isCurrent;
  final bool isUpcoming;

  const _CustomerOrderTimelineDot({
    required this.isDone,
    required this.isCurrent,
    required this.isUpcoming,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final isDark = context.isDarkMode;

    late final Color borderColor;
    late final Color fillColor;
    Widget? center;

    if (isDone) {
      borderColor = colors.textPrimary;
      fillColor = colors.textPrimary;
      center = Icon(Icons.check, size: 10, color: colors.surface);
    } else if (isCurrent) {
      // In-progress step: emerald disc (mobile UX; rental-active keeps label tint separately).
      borderColor = isDark ? const Color(0xFF10B981) : const Color(0xFF059669);
      fillColor = borderColor;
      center = Container(
        width: 6,
        height: 6,
        decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
      );
    } else if (isUpcoming) {
      borderColor = colors.border;
      fillColor = colors.background;
      center = null;
    } else {
      borderColor = colors.border;
      fillColor = colors.background;
      center = null;
    }

    return Container(
      width: 18,
      height: 18,
      decoration: BoxDecoration(
        color: fillColor,
        shape: BoxShape.circle,
        border: Border.all(color: borderColor, width: 2),
      ),
      alignment: Alignment.center,
      child: center,
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
      color: colors.surface,
      borderRadius: BorderRadius.circular(16),
      clipBehavior: Clip.antiAlias,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: colors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Request photos from your supplier',
              style: TextStyle(color: colors.textPrimary, fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 6),
            Text(
              multi
                  ? 'Sent to each product’s supplier (vendor) — not BlinksMed support. Choose products or request all. Up to 5 photos per item.'
                  : 'Sent to the supplier for this product — not BlinksMed support chat below. Up to 5 photos.',
              style: TextStyle(
                color: colors.textSecondary,
                fontSize: 13,
                height: 1.4,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 14),
            if (loading)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Row(
                  children: [
                    const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF6C63FF)),
                    ),
                    const SizedBox(width: 10),
                    Text('Loading photo requests…', style: TextStyle(color: colors.textSecondary, fontSize: 13, fontWeight: FontWeight.w500)),
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
                        child: const Text('Select all', style: TextStyle(color: Color(0xFF6C63FF), fontSize: 12)),
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
                      activeColor: const Color(0xFF6C63FF),
                      checkColor: Colors.white,
                      title: Text(
                        item.listingTitle,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: colors.textPrimary, fontSize: 13),
                      ),
                      subtitle: Text(
                        formatOrderStatusLabel(item.status),
                        style: TextStyle(color: colors.textMuted, fontSize: 11),
                      ),
                      onChanged: busy ? null : (v) => onToggle(item.id, v == true),
                    );
                  }),
                  const SizedBox(height: 8),
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
                  const SizedBox(height: 10),
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
                const SizedBox(height: 16),
              ],
              if (withRequest.isEmpty && eligible.isEmpty)
                Text(
                  'You can request supplier photos after a supplier accepts each product.',
                  style: TextStyle(
                    color: colors.textSecondary,
                    fontSize: 13,
                    height: 1.4,
                    fontWeight: FontWeight.w500,
                  ),
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
                final isDark = context.isDarkMode;
                final waitingTextColor = isDark ? Colors.amber : const Color(0xFFD97706);
                final waitingBorderColor = isDark ? Colors.amber.withValues(alpha: 0.35) : const Color(0xFFFDE68A);
                final waitingBgColor = isDark ? Colors.amber.withValues(alpha: 0.08) : const Color(0xFFFFFBEB);
                final waitingBadgeBg = isDark ? Colors.amber.withValues(alpha: 0.2) : const Color(0xFFFEF3C7);
                final successTextColor = isDark ? const Color(0xFF34D399) : const Color(0xFF059669);
                final successBadgeBg = isDark ? const Color(0xFF34D399).withValues(alpha: 0.18) : const Color(0xFFD1FAE5);
                return Container(
                  width: double.infinity,
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: waiting
                        ? waitingBgColor
                        : colors.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: waiting
                          ? waitingBorderColor
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
                                  '${formatOrderStatusLabel(item.status)}${viewing ? ' · currently viewing' : ''}',
                                  style: TextStyle(
                                    color: isDark ? const Color(0xFFCBD5E1) : colors.textMuted,
                                    fontSize: 11,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: waiting
                                  ? waitingBadgeBg
                                  : successBadgeBg,
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              waiting
                                  ? 'Waiting for supplier photos'
                                  : '${images.length}/5 received',
                              style: TextStyle(
                                color: waiting ? waitingTextColor : successTextColor,
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
                          style: TextStyle(
                            color: isDark ? const Color(0xFFE2E8F0) : colors.textMuted,
                            fontSize: 12,
                            height: 1.35,
                          ),
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
