import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../shared/utils/razorpay_web_checkout.dart';
import '../../core/theme.dart';
import 'package:provider/provider.dart';
import '../../core/providers/order_detail_provider.dart';
import '../../core/providers/order_provider.dart';
import '../../core/models/order_model.dart';
import '../../core/models/order_action_model.dart';
import '../../core/models/medical_model.dart';
import '../../core/models/order_image_request_model.dart';
import '../../core/utils/platform_file_payload.dart';
import '../../core/utils/gst_label.dart';
import '../../core/utils/rental_period.dart';
import '../../core/utils/order_badges.dart';
import '../../shared/widgets/brand_page_loader.dart';
import '../../shared/widgets/catalog_image.dart';
import '../../shared/widgets/struck_price.dart';
import '../../shared/widgets/legal_policy_links.dart';
import '../product/product_detail_screen.dart';
import '../../core/providers/chat_provider.dart';
import '../chat/chat_detail_screen.dart';
import '../profile/support_screen.dart';

/// Hide Buyout Item on the customer order page. Extend Rental stays.
const bool kShowCustomerBuyout = false;

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
  bool _acceptedRxLegal = false;
  PendingPrescriptionFile? _pendingRxFile;
  late List<OrderModel> _ordersInGroup;
  Timer? _pollTimer;
  bool _refreshInFlight = false;
  late Razorpay _razorpay;
  String? _payOrderId;
  String? _payExtensionId;
  String? _payCheckoutSessionId;
  bool _payingExtension = false;

  /// Keep status/photos in sync with vendor actions while this screen is open.
  static const _pollInterval = Duration(seconds: 5);

  @override
  void initState() {
    super.initState();
    if (!kIsWeb) {
      _razorpay = Razorpay();
      _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _handleExtensionPaid);
      _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _handleExtensionFailed);
      _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, _handleExtensionWallet);
    }
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
    if (!kIsWeb) _razorpay.clear();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && mounted) {
      _refreshLive(silent: true);
    }
  }

  Future<void> _fetchCurrentSubOrder() => _refreshLive(silent: false);

  Future<void> _startExtensionPayment(OrderDetailProvider provider, CustomerExtensionModel? ext) async {
    if (ext == null || _payingExtension) return;
    final orderId = _ordersInGroup[_selectedOrderIndex.clamp(0, _ordersInGroup.length - 1)].id;
    setState(() => _payingExtension = true);
    final session = await provider.startExtensionPayment(orderId, ext.extensionId);
    if (!mounted) return;
    if (session == null || (session.razorpayOrderId ?? '').isEmpty) {
      setState(() => _payingExtension = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(provider.errorMessage ?? 'Unable to start the extension payment.'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    _payOrderId = orderId;
    _payExtensionId = ext.extensionId;
    _payCheckoutSessionId = session.checkoutSessionId;
    final amountPaise = (session.amount * 100).round();
    if (kIsWeb) {
      await openRazorpayWeb(
        key: session.razorpayKeyId,
        amountPaise: amountPaise,
        currency: session.currency,
        orderId: session.razorpayOrderId ?? '',
        name: 'BlinksMed',
        description: 'Rental extension',
        email: '',
        contact: '',
        onSuccess: (paymentId, rzpOrderId, signature) {
          _completeExtensionPayment(paymentId, rzpOrderId, signature);
        },
        onError: _handleExtensionPayError,
      );
      return;
    }

    try {
      _razorpay.open({
        'key': session.razorpayKeyId,
        'amount': amountPaise,
        'currency': session.currency,
        'order_id': session.razorpayOrderId,
        'name': 'BlinksMed',
        'description': 'Rental extension',
        'theme': {'color': AppTheme.razorpayThemeColor},
      });
    } catch (_) {
      _handleExtensionPayError('Unable to launch Razorpay.');
    }
  }

  void _handleExtensionPaid(PaymentSuccessResponse response) {
    _completeExtensionPayment(
      response.paymentId ?? '',
      response.orderId ?? '',
      response.signature ?? '',
    );
  }

  void _handleExtensionFailed(PaymentFailureResponse response) {
    _handleExtensionPayError(
      (response.message ?? '').trim().isEmpty ? 'Payment was not completed.' : response.message!,
    );
  }

  void _handleExtensionWallet(ExternalWalletResponse _) {
    _handleExtensionPayError('Payment was not completed.');
  }

  Future<void> _completeExtensionPayment(String paymentId, String razorpayOrderId, String signature) async {
    final orderId = _payOrderId;
    final extensionId = _payExtensionId;
    final sessionId = _payCheckoutSessionId;
    if (!mounted || orderId == null || extensionId == null || sessionId == null) {
      if (mounted) setState(() => _payingExtension = false);
      return;
    }
    final provider = Provider.of<OrderDetailProvider>(context, listen: false);
    final ok = await provider.verifyExtensionPayment(
      orderId: orderId,
      extensionId: extensionId,
      checkoutSessionId: sessionId,
      razorpayOrderId: razorpayOrderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: signature,
    );
    if (!mounted) return;
    setState(() => _payingExtension = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(ok
            ? 'Extension paid. The new end date is now on this product.'
            : (provider.errorMessage ?? 'Payment verification failed.')),
        backgroundColor: ok ? Colors.green : Colors.redAccent,
      ),
    );
    if (ok) {
      Provider.of<OrderProvider>(context, listen: false).fetchOrders(silent: true);
      _refreshLive(silent: true);
    }
  }

  void _handleExtensionPayError(String message) {
    if (!mounted) return;
    setState(() => _payingExtension = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.redAccent),
    );
  }

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
    if (_ordersInGroup.isEmpty) return;
    _refreshInFlight = true;
    final selectedIndex = _selectedOrderIndex.clamp(0, _ordersInGroup.length - 1);
    final selectedId = _ordersInGroup[selectedIndex].id;
    try {
      final detail = Provider.of<OrderDetailProvider>(context, listen: false);
      final orders = Provider.of<OrderProvider>(context, listen: false);

      // Detail is the line the user opened. The list refresh must not block it,
      // otherwise the previous order stays on screen until the heavy list returns.
      final detailFuture = detail.fetchOrderDetail(selectedId, silent: silent);
      final ordersFuture = orders.fetchOrders(silent: silent, force: silent);
      await Future.wait([detailFuture, ordersFuture]);
      if (!mounted) return;
      if (_selectedOrderIndex >= _ordersInGroup.length ||
          _ordersInGroup[_selectedOrderIndex].id != selectedId) {
        return;
      }

      final byId = {for (final o in orders.orders) o.id: o};
      final live = detail.currentOrder;
      final merged = _ordersInGroup.map((o) {
        if (live != null && live.id == o.id && live.id == selectedId) return live;
        return byId[o.id] ?? o;
      }).toList();

      setState(() => _ordersInGroup = merged);

      await detail.fetchGroupImageRequests(
        merged.map((o) => o.id).toList(),
        silent: silent,
      );
      await detail.fetchExtensionHistory(merged.map((o) => o.id).toList());
      if (!mounted) return;
      _syncPhotoSelection(detail);
    } finally {
      _refreshInFlight = false;
    }
  }

  /// The line the user selected. The detail payload is used only after it
  /// matches that line, so a previous order cannot flash underneath.
  OrderModel? _orderForDetails(OrderDetailProvider provider) {
    if (_ordersInGroup.isEmpty) return null;
    final index = _selectedOrderIndex.clamp(0, _ordersInGroup.length - 1);
    final selected = _ordersInGroup[index];
    final live = provider.currentOrder;
    if (live != null && live.id == selected.id) return live;
    return selected;
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
                return _scrollableSheet(
                  context,
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
                  if ((provider.extensionQuote?.pendingDays ?? 0) > 0) ...[
                    SizedBox(height: 12),
                    Text(
                      'A ${provider.extensionQuote!.pendingDays}-day extension is already waiting for approval. Confirming adds the days above, for ${provider.extensionQuote!.additionalDays} days in total.',
                      style: TextStyle(color: colors.textSecondary, fontSize: 13),
                    ),
                  ],
                  SizedBox(height: 24),
                  
                  // Quote details. Keep the last quote visible while the next day count loads.
                  if (provider.extensionQuote != null)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: context.isDarkMode
                            ? Colors.white.withValues(alpha: 0.05)
                            : colors.background,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: colors.border),
                      ),
                      child: Column(
                        children: [
                          _buildQuoteRow(context, 'Extension Cost', provider.extensionQuote!.extensionAmount),
                          // Service fee UI hidden — keep for future re-enable
                          if (false) ...[
                            SizedBox(height: 8),
                            _buildQuoteRow(context, 'Service Fee', provider.extensionQuote!.serviceFeeAmount),
                          ],
                          SizedBox(height: 8),
                          _buildQuoteRow(context, formatGstLabel(provider.extensionQuote!.gstPercent), provider.extensionQuote!.gstAmount),
                          Divider(color: colors.border, height: 24),
                          _buildQuoteRow(context, 'Total', provider.extensionQuote!.totalAmount, isBold: true),
                          SizedBox(height: 8),
                          Text(
                            'Payment is taken on this order page after the vendor approves. The end date changes only after that payment.',
                            style: TextStyle(color: colors.textMuted, fontSize: 12, height: 1.3),
                          ),
                          SizedBox(height: 8),
                          Text(
                            'New End Date: ${provider.extensionQuote!.newEndDate.split('T')[0]}',
                            style: TextStyle(
                              color: context.appColors.success,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    )
                  else if (provider.isActionLoading)
                    const Center(child: CircularProgressIndicator(color: Color(0xFF6C63FF))),
                  
                  SizedBox(height: 32),
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(backgroundColor: Color(0xFF6C63FF)),
                      onPressed: provider.extensionQuote == null || provider.isActionLoading
                          ? null
                          : () async {
                              final updating = (provider.extensionQuote?.pendingDays ?? 0) > 0;
                              final success = await provider.processExtension(_ordersInGroup[_selectedOrderIndex].id, _extensionDays);
                              if (success && context.mounted) {
                                Navigator.pop(context);
                                ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                                  content: Text(updating
                                      ? 'Extension request updated. Still waiting for vendor approval.'
                                      : 'Rental extended successfully!'),
                                  backgroundColor: Colors.green,
                                ));
                              }
                            },
                      child: Text(
                        (provider.extensionQuote?.pendingDays ?? 0) > 0 ? 'Update request' : 'Request extension',
                        style: TextStyle(fontSize: 18, color: Colors.white, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                ],
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
            return _scrollableSheet(
              context,
              children: [
                  Text('Buyout Equipment', style: TextStyle(color: colors.textPrimary, fontSize: 22, fontWeight: FontWeight.bold)),
                  SizedBox(height: 8),
                  Text('Love it? Keep it! We will deduct a portion of your rental fees from the purchase price.', style: TextStyle(color: colors.textSecondary, fontSize: 14)),
                  SizedBox(height: 24),
                  
                  if (provider.isActionLoading)
                    Center(child: CircularProgressIndicator(color: Color(0xFF6C63FF)))
                  else if (provider.buyoutQuote != null)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: context.isDarkMode
                            ? Colors.white.withValues(alpha: 0.05)
                            : colors.background,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: colors.border),
                      ),
                      child: Column(
                        children: [
                          _buildQuoteRow(context, 'Base Price', provider.buyoutQuote!.baseBuyoutAmount),
                          SizedBox(height: 8),
                          _buildQuoteRow(context, 'Rental Deduction', -provider.buyoutQuote!.rentDeductionAmount, color: context.appColors.success),
                          // Service fee UI hidden — keep for future re-enable
                          if (false) ...[
                            SizedBox(height: 8),
                            _buildQuoteRow(context, 'Service Fee', provider.buyoutQuote!.serviceFeeAmount),
                          ],
                          SizedBox(height: 8),
                          _buildQuoteRow(context, formatGstLabel(provider.buyoutQuote!.gstPercent), provider.buyoutQuote!.gstAmount),
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
                  const SizedBox(height: 8),
                ],
            );
          },
        );
      },
    );
  }

  /// Keeps a tall bottom sheet inside the screen and lets the customer scroll to the rest.
  Widget _scrollableSheet(BuildContext context, {required List<Widget> children}) {
    final maxHeight = MediaQuery.sizeOf(context).height * 0.92;
    final keyboard = MediaQuery.viewInsetsOf(context).bottom;
    final safeBottom = MediaQuery.paddingOf(context).bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: keyboard),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: maxHeight),
        child: SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(24, 24, 24, 24 + safeBottom),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: children,
          ),
        ),
      ),
    );
  }

  Widget _buildQuoteRow(BuildContext context, String label, double amount, {bool isBold = false, Color? color}) {
    final colors = context.appColors;
    final valueColor = color ?? colors.textPrimary;
    final labelColor = color ?? colors.textSecondary;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Text(
            label,
            style: TextStyle(
              color: labelColor,
              fontSize: isBold ? 16 : 14,
              fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
            ),
          ),
        ),
        const SizedBox(width: 12),
        Text(
          '₹${amount.toStringAsFixed(2)}',
          style: TextStyle(
            color: valueColor,
            fontSize: isBold ? 18 : 14,
            fontWeight: isBold ? FontWeight.bold : FontWeight.w600,
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
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
    double deposit, {
    String? refundSummary,
  }) {
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
            if (refundSummary != null) ...[
              const SizedBox(height: 2),
              Text(
                refundSummary,
                style: const TextStyle(color: Color(0xFF15803D), fontSize: 11, fontWeight: FontWeight.w700, height: 1.2),
                textAlign: TextAlign.right,
              ),
            ],
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
    final resolved = _orderForDetails(provider);
    if (resolved == null) {
      return Scaffold(
        backgroundColor: colors.background,
        appBar: AppBar(
          title: Text('Back to orders', style: TextStyle(color: colors.textSecondary, fontSize: 16)),
          backgroundColor: colors.background,
          iconTheme: IconThemeData(color: colors.textSecondary),
          elevation: 0,
          titleSpacing: 0,
        ),
        body: provider.isLoading
            ? const BrandPageLoader()
            : Center(
                child: Text(
                  provider.errorMessage ?? 'Order not found',
                  style: TextStyle(color: colors.textPrimary),
                ),
              ),
      );
    }
    final order = resolved;
    final rxReady = provider.prescriptionsReadyFor(order.id);
    final rxFiles = rxReady ? provider.prescriptionFiles : const <PrescriptionFileModel>[];
    final groupTotal = _ordersInGroup.fold<double>(0, (sum, o) => sum + o.totalAmount);
    final groupDeposit = _ordersInGroup.fold<double>(0, (sum, o) => sum + o.depositAmount);
    var refundReceived = 0.0;
    var refundProcessing = 0.0;
    for (final item in _ordersInGroup) {
      final row = item.returnSettlement;
      if (row != null && row.refundAmount > 0) {
        if (row.status == 'refunded') {
          refundReceived += row.refundAmount;
        } else if (row.status == 'pending_refund' || row.status == 'refunding') {
          refundProcessing += row.refundAmount;
        }
      }
      final cancel = item.cancellationRefund;
      if (cancel != null && cancel.refundAmount > 0) {
        if (cancel.status == 'refunded') {
          refundReceived += cancel.refundAmount;
        } else if (cancel.status == 'pending_review' || cancel.status == 'refunding') {
          refundProcessing += cancel.refundAmount;
        }
      }
    }
    String? refundSummary;
    if (refundReceived > 0 && refundProcessing > 0) {
      refundSummary = 'Refunds ${OrderReturnInfo.format(refundReceived)} received · ${OrderReturnInfo.format(refundProcessing)} processing';
    } else if (refundReceived > 0) {
      refundSummary = 'Refunds ${OrderReturnInfo.format(refundReceived)} received';
    } else if (refundProcessing > 0) {
      refundSummary = 'Refunds ${OrderReturnInfo.format(refundProcessing)} processing';
    }
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
      body: SingleChildScrollView(
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
                              refundSummary: refundSummary,
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
                                  setState(() {
                                    _selectedOrderIndex = index;
                                    _pendingRxFile = null;
                                    _acceptedRxLegal = false;
                                  });
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
                                            if (provider.extensionsFor(order.id).any((ext) => ext.isPaid)) ...[
                                              const SizedBox(height: 4),
                                              Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                decoration: BoxDecoration(
                                                  color: context.isDarkMode
                                                      ? const Color(0xFF78350F).withValues(alpha: 0.45)
                                                      : const Color(0xFFFEF3C7),
                                                  borderRadius: BorderRadius.circular(4),
                                                ),
                                                child: Text(
                                                  'EXTENDED',
                                                  style: TextStyle(
                                                    color: context.isDarkMode ? const Color(0xFFFCD34D) : const Color(0xFF92400E),
                                                    fontSize: 10,
                                                    fontWeight: FontWeight.w800,
                                                    letterSpacing: 0.3,
                                                  ),
                                                ),
                                              ),
                                            ],
                                            if (order.returnSettlement?.chipLabel != null) ...[
                                              const SizedBox(height: 4),
                                              Text(
                                                order.returnSettlement!.chipLabel!,
                                                style: TextStyle(
                                                  color: context.isDarkMode ? const Color(0xFFBAE6FD) : const Color(0xFF0C4A6E),
                                                  fontSize: 10,
                                                  fontWeight: FontWeight.w800,
                                                ),
                                              ),
                                            ],
                                            if (order.cancellationRefund?.chipLabel != null) ...[
                                              const SizedBox(height: 4),
                                              Text(
                                                order.cancellationRefund!.chipLabel!,
                                                style: TextStyle(
                                                  color: context.isDarkMode ? const Color(0xFFBAE6FD) : const Color(0xFF0C4A6E),
                                                  fontSize: 10,
                                                  fontWeight: FontWeight.w800,
                                                ),
                                              ),
                                            ],
                                            if (provider.extensionsFor(order.id).any((ext) => ext.isAwaitingPayment)) ...[
                                              const SizedBox(height: 3),
                                              Text(
                                                'Payment due',
                                                style: const TextStyle(
                                                  color: Color(0xFFEA580C),
                                                  fontSize: 10,
                                                  fontWeight: FontWeight.w700,
                                                ),
                                              ),
                                            ],
                                            if (photoLabel != null) ...[
                                              const SizedBox(height: 3),
                                              Text(
                                                photoLabel,
                                                style: TextStyle(
                                                  color: photoCount == 0
                                                      ? (context.isDarkMode ? Colors.amber : const Color(0xFFD97706))
                                                      : context.appColors.success,
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
                                          text: ' · ${order.listingTitle}',
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
                                    Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                        builder: (context) => ProductDetailScreen(
                                          listingId: order.listingId,
                                          previewImageUrl: order.listingPrimaryImageUrl,
                                        ),
                                      ),
                                    );
                                  },
                                  child: const Text(
                                    'View listing',
                                    style: TextStyle(color: Color(0xFF6C63FF), fontSize: 12, fontWeight: FontWeight.w600),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            _buildTimeline(order.status, order.orderType),
                          ],
                        ),
                      ),
                      const SizedBox(height: _sectionGap),

                      // Rental / purchase details
                      if (order.startDate != null)
                        Container(
                          padding: _cardPadding,
                          decoration: _cardDecoration(colors),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                order.orderType.toLowerCase() == 'buy'
                                    ? 'Purchase details'
                                    : 'Rental details',
                                style: _sectionTitleStyle(colors),
                              ),
                              const SizedBox(height: 10),
                              if (order.orderType.toLowerCase() == 'buy') ...[
                                _detailGridRow(
                                  colors,
                                  [
                                    _labeledValue(
                                      colors,
                                      'PURCHASE DATE',
                                      _formatOrderDate(order.startDate),
                                    ),
                                    _labeledValue(
                                      colors,
                                      'QUANTITY',
                                      '${order.quantity}',
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
                                      _formatOrderDate(order.startDate),
                                    ),
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        _labeledValue(
                                          colors,
                                          'END DATE',
                                          _formatOrderDate(order.endDate),
                                        ),
                                        if (provider.extensionsFor(order.id).any((ext) => ext.isPaid)) ...[
                                          const SizedBox(height: 4),
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                            decoration: BoxDecoration(
                                              color: context.isDarkMode
                                                  ? const Color(0xFF78350F).withValues(alpha: 0.45)
                                                  : const Color(0xFFFEF3C7),
                                              borderRadius: BorderRadius.circular(4),
                                            ),
                                            child: Text(
                                              'EXTENDED',
                                              style: TextStyle(
                                                color: context.isDarkMode ? const Color(0xFFFCD34D) : const Color(0xFF92400E),
                                                fontSize: 10,
                                                fontWeight: FontWeight.w800,
                                                letterSpacing: 0.3,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ],
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
                                      '${order.quantity}',
                                    ),
                                    _labeledValue(
                                      colors,
                                      'ORDER TYPE',
                                      formatOrderTypeLabel(order.orderType),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 10),
                                _labeledValue(
                                  colors,
                                  'RENTAL PERIOD',
                                  _rentalPeriodTitle(order),
                                ),
                                if (_rentalDurationText(order) != null) ...[
                                  const SizedBox(height: 10),
                                  _labeledValue(
                                    colors,
                                    'DURATION',
                                    _rentalDurationText(order)!,
                                  ),
                                ],
                                if (order.rentalFinalPrice != null) ...[
                                  const SizedBox(height: 10),
                                  _planPriceValue(colors, order),
                                ],
                                if (provider.extensionsFor(order.id).any((ext) => ext.isPaid)) ...[
                                  const SizedBox(height: 12),
                                  _extensionBreakdown(colors, order, provider.extensionsFor(order.id)),
                                ],
                                if (order.returnSettlement != null) ...[
                                  const SizedBox(height: 12),
                                  _depositRefundCard(colors, order.returnSettlement!),
                                ],
                                if (order.cancellationRefund != null) ...[
                                  const SizedBox(height: 12),
                                  _cancellationRefundCard(colors, order.cancellationRefund!),
                                ],
                              ],
                            ],
                          ),
                        ),

                      if (rxFiles.isNotEmpty ||
                          _canUploadPrescription(order.status)) ...[
                        const SizedBox(height: _sectionGap),
                        _OrderPrescriptionCard(
                          files: rxFiles,
                          canEdit: _canUploadPrescription(order.status),
                          loading: !rxReady || provider.prescriptionLoading,
                          pendingFileName: _pendingRxFile?.name,
                          needsConsent: _canUploadPrescription(order.status) && rxFiles.length < 3,
                          acceptedLegal: _acceptedRxLegal,
                          onAcceptedLegal: (value) => setState(() => _acceptedRxLegal = value),
                          onRemovePending: () => setState(() {
                            _pendingRxFile = null;
                            _acceptedRxLegal = false;
                          }),
                          onUpload: () => _uploadPrescription(provider),
                          onDelete: (fileId) => provider.deletePrescription(
                            order.id,
                            fileId,
                          ),
                        ),
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
                          onSelectOption: (orderId, optionId) async {
                            final ok = await provider.selectImageOption(orderId, optionId);
                            if (!mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(
                                  ok
                                      ? 'Option selected.'
                                      : (provider.errorMessage ?? 'Failed to select option.'),
                                ),
                                backgroundColor: ok ? null : Colors.redAccent,
                              ),
                            );
                          },
                        ),
                      ],

                      const SizedBox(height: _sectionGap),

                      // Bottom action buttons
                      Builder(
                        builder: (context) {
                          final status = order.status.trim().toLowerCase();
                          final canCancel = status == 'pending' || status == 'awaiting vendor acceptance';
                          final canExtendBuyout = status == 'active' && order.orderType.toLowerCase() == 'rent';
                          final lineExtensions = provider.extensionsFor(order.id);
                          CustomerExtensionModel? awaitingExtension;
                          CustomerExtensionModel? pendingExtension;
                          for (final ext in lineExtensions) {
                            if (ext.isAwaitingPayment) awaitingExtension = ext;
                            if (ext.isPending) pendingExtension = ext;
                          }

                          return Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              const OrderConfirmPolicyLinks(),
                              const SizedBox(height: 10),
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
                                              content: Column(
                                                mainAxisSize: MainAxisSize.min,
                                                crossAxisAlignment: CrossAxisAlignment.start,
                                                children: [
                                                  Text(
                                                    'This will cancel this item request. This cannot be undone.',
                                                    style: TextStyle(color: colors.textSecondary),
                                                  ),
                                                  const SizedBox(height: 10),
                                                  const CancellationPolicyLink(),
                                                ],
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
                              if (awaitingExtension != null) ...[
                                const SizedBox(height: 8),
                                Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFFF7ED),
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(color: const Color(0xFFFDBA74)),
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.stretch,
                                    children: [
                                      Text(
                                        'Extension approved',
                                        style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w800),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        '${awaitingExtension.additionalDays} day${awaitingExtension.additionalDays == 1 ? '' : 's'}. The end date stays ${_formatOrderDate(order.endDate)} until this payment succeeds, then it moves to ${_formatOrderDate(awaitingExtension.newEndDate)}.',
                                        style: TextStyle(color: colors.textSecondary, fontSize: 12, height: 1.3),
                                      ),
                                      const SizedBox(height: 10),
                                      ElevatedButton(
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: colors.accent,
                                          foregroundColor: Colors.white,
                                          disabledBackgroundColor: colors.accent.withValues(alpha: 0.45),
                                          minimumSize: const Size.fromHeight(44),
                                        ),
                                        onPressed: _payingExtension
                                            ? null
                                            : () => _startExtensionPayment(provider, awaitingExtension),
                                        child: Text(
                                          _payingExtension
                                              ? 'Opening payment…'
                                              : 'Pay ₹${awaitingExtension.totalAmount.toStringAsFixed(2)}',
                                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                              if (pendingExtension != null && awaitingExtension == null) ...[
                                const SizedBox(height: 8),
                                Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFFFBEB),
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(color: const Color(0xFFFCD34D)),
                                  ),
                                  child: Text(
                                    'Extension waiting for vendor approval · ${pendingExtension.additionalDays} day${pendingExtension.additionalDays == 1 ? '' : 's'} · ₹${pendingExtension.totalAmount.toStringAsFixed(2)}. This amount is not in the order total yet.',
                                    style: TextStyle(color: colors.textSecondary, fontSize: 12, height: 1.3),
                                  ),
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
                                        onPressed: awaitingExtension != null
                                            ? null
                                            : () => _showExtensionBottomSheet(context, provider),
                                        child: FittedBox(
                                          fit: BoxFit.scaleDown,
                                          child: Text(
                                            'Extend Rental',
                                            style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w700),
                                          ),
                                        ),
                                      ),
                                    ),
                                    if (kShowCustomerBuyout) ...[
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

  Widget _cancellationRefundCard(AppPalette colors, OrderCancellationInfo row) {
    final received = row.status == 'refunded';
    final receivedAt = _formatReceivedAt(row.refundedAt);
    final refundText = row.refundAmount <= 0
        ? row.money(0)
        : '${row.money(row.refundAmount)}${received ? ' received' : ' processing'}';
    final note = received && receivedAt != null
        ? 'Received $receivedAt'
        : row.status == 'pending_review'
            ? 'BlinksMed is reviewing this payment before anything is sent back.'
            : row.refundAmount <= 0
                ? 'The charge uses the full payment for this product, so nothing is refunded.'
                : received
                    ? 'This refund was sent to your original payment.'
                    : 'BlinksMed is sending this refund to your original payment.';
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Cancellation refund',
            style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w700, fontSize: 14),
          ),
          if (row.actorLabel.trim().isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(row.actorLabel, style: TextStyle(color: colors.textMuted, fontSize: 12)),
          ],
          const SizedBox(height: 8),
          Text('Paid  ${row.money(row.paidAmount)}', style: TextStyle(color: colors.textPrimary, fontSize: 13)),
          const SizedBox(height: 2),
          Text('Charge  ${row.money(row.chargeAmount)}', style: TextStyle(color: colors.textPrimary, fontSize: 13)),
          const SizedBox(height: 2),
          Text('Refund  $refundText', style: TextStyle(color: colors.textPrimary, fontSize: 13, fontWeight: FontWeight.w700)),
          if ((row.chargeReason ?? '').trim().isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(row.chargeReason!, style: TextStyle(color: colors.textMuted, fontSize: 12)),
          ],
          const SizedBox(height: 6),
          Text(note, style: TextStyle(color: colors.textMuted, fontSize: 12)),
        ],
      ),
    );
  }

  Widget _depositRefundCard(AppPalette colors, OrderReturnInfo row) {
    final received = row.status == 'refunded';
    final receivedAt = _formatReceivedAt(row.refundedAt);
    final refundText = row.refundAmount <= 0
        ? row.money(0)
        : '${row.money(row.refundAmount)}${received ? ' received' : ' processing'}';
    final note = received && receivedAt != null
        ? 'Received $receivedAt'
        : row.refundAmount <= 0
            ? (row.damageAmount > 0
                ? 'The damage charge uses this product\'s full deposit, so nothing is refunded.'
                : 'No security deposit is due back on this product.')
            : received
                ? 'This refund was sent to your original payment.'
                : 'BlinksMed is sending this refund to your original payment.';
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Deposit refund',
            style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w700, fontSize: 14),
          ),
          const SizedBox(height: 8),
          Text('Deposit  ${row.money(row.depositAmount)}', style: TextStyle(color: colors.textPrimary, fontSize: 13)),
          const SizedBox(height: 2),
          Text('Damage charge  ${row.money(row.damageAmount)}', style: TextStyle(color: colors.textPrimary, fontSize: 13)),
          const SizedBox(height: 2),
          Text('Refund  $refundText', style: TextStyle(color: colors.textPrimary, fontSize: 13, fontWeight: FontWeight.w700)),
          if ((row.damageReason ?? '').trim().isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(row.damageReason!, style: TextStyle(color: colors.textMuted, fontSize: 12)),
          ],
          const SizedBox(height: 6),
          Text(note, style: TextStyle(color: colors.textMuted, fontSize: 12)),
        ],
      ),
    );
  }

  Widget _extensionBreakdown(AppPalette colors, OrderModel order, List<CustomerExtensionModel> extensions) {
    final paid = extensions.where((ext) => ext.isPaid).toList();
    final paidTotal = paid.fold<double>(0, (sum, ext) => sum + ext.totalAmount);
    final original = (order.totalAmount - paidTotal).clamp(0, double.infinity);
    final muted = TextStyle(color: colors.textMuted, fontSize: 12);
    final strong = TextStyle(color: colors.textPrimary, fontSize: 13, fontWeight: FontWeight.w700);
    Widget row(String label, String value, {bool bold = false}) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 4),
        child: Row(
          children: [
            Expanded(child: Text(label, style: bold ? strong : muted)),
            Text(value, style: bold ? strong : muted),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        row('Original rental', '₹${original.toStringAsFixed(2)}'),
        ...paid.map((ext) => row(
              'Extension · ${ext.additionalDays} day${ext.additionalDays == 1 ? '' : 's'}',
              '₹${ext.totalAmount.toStringAsFixed(2)}',
            )),
        const SizedBox(height: 2),
        row('Product total', '₹${order.totalAmount.toStringAsFixed(2)}', bold: true),
      ],
    );
  }

  String? _formatReceivedAt(String? raw) {
    if (raw == null || raw.trim().isEmpty) return null;
    final parsed = DateTime.tryParse(raw);
    if (parsed == null) return null;
    final local = parsed.toLocal();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    final hour12 = local.hour % 12 == 0 ? 12 : local.hour % 12;
    final minute = local.minute.toString().padLeft(2, '0');
    final suffix = local.hour >= 12 ? 'PM' : 'AM';
    return '${months[local.month - 1]} ${local.day}, ${local.year}, $hour12:$minute $suffix';
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

  String? _rentalDurationText(OrderModel order) {
    if (order.orderType.toLowerCase() != 'rent') return null;
    final hasPlanLabel = order.rentalDurationLabel?.trim().isNotEmpty == true;
    final days = order.rentalDurationDays;
    if (!hasPlanLabel || days == null || days <= 0) return null;
    return '$days day${days == 1 ? '' : 's'}';
  }

  Widget _planPriceValue(AppPalette colors, OrderModel order) {
    final finalPrice = order.rentalFinalPrice ?? 0;
    final normal = order.rentalNormalPrice;
    final hasDiscount = normal != null && normal > finalPrice;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'PLAN PRICE',
          style: TextStyle(
            color: colors.textMuted,
            fontSize: 10,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.6,
          ),
        ),
        const SizedBox(height: 4),
        Wrap(
          spacing: 8,
          runSpacing: 4,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            if (hasDiscount)
              StruckPrice(
                '₹${normal.toStringAsFixed(0)}',
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
              ),
            Text(
              '₹${finalPrice.toStringAsFixed(0)}',
              style: TextStyle(
                color: colors.textPrimary,
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
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

  bool _canUploadPrescription(String status) {
    final compact = status.trim().toLowerCase().replaceAll(RegExp(r'\s+'), '_');
    return !{
      'cancelled',
      'canceled',
      'dispatch_failed',
      'active',
      'completed',
      'returned',
    }.contains(compact);
  }

  Future<void> _uploadPrescription(OrderDetailProvider provider) async {
    final order = _orderForDetails(provider);
    if (order == null) return;
    if (!_acceptedRxLegal) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please agree to the Privacy Policy before uploading a prescription.')),
      );
      return;
    }
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
      withData: true,
    );
    if (result == null || result.files.isEmpty) return;
    final file = result.files.first;
    if (file.size > 5 * 1024 * 1024) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('File must be at most 5 MB.')),
      );
      return;
    }
    final path = safePlatformFilePath(file);
    final bytes = file.bytes;
    if ((bytes == null || bytes.isEmpty) && (path == null || path.isEmpty)) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not read that file. Try another image or PDF.')),
      );
      return;
    }
    await _sendPrescription(
      provider,
      orderId: order.id,
      fileName: file.name,
      path: path,
      bytes: bytes,
      acceptedPrescriptionLegal: true,
    );
  }

  Future<void> _sendPrescription(
    OrderDetailProvider provider, {
    required String orderId,
    required String fileName,
    String? path,
    List<int>? bytes,
    required bool acceptedPrescriptionLegal,
  }) async {
    final ok = await provider.uploadPrescription(
      orderId: orderId,
      fileName: fileName,
      path: path,
      bytes: bytes,
      acceptedPrescriptionLegal: acceptedPrescriptionLegal,
    );
    if (!mounted) return;
    if (ok) {
      setState(() {
        _pendingRxFile = null;
        _acceptedRxLegal = false;
      });
    } else {
      setState(() => _acceptedRxLegal = false);
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(ok ? 'Prescription uploaded.' : 'Unable to upload prescription.')),
    );
  }

  bool _shouldShowGroupPhotoSection(OrderDetailProvider provider) {
    final ids = _ordersInGroup.map((o) => o.id).toSet();
    if (provider.imageRequestsByOrderId.keys.any(ids.contains)) return true;
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
    if (s == 'active') return colors.success;
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

    if (progress.dispatchFailed) {
      return Text(
        'No vendor accepted this product.',
        style: TextStyle(color: colors.textMuted, fontSize: 13, height: 1.35),
      );
    }

    if (progress.cancelled) {
      return Text(
        'This order was cancelled — steps shown may have completed before cancellation.',
        style: TextStyle(color: colors.textMuted, fontSize: 13, height: 1.35),
      );
    }

    final steps = _timelineSteps(orderType, status);
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
                                ? context.appColors.success
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
  final bool dispatchFailed;
  final int completedThrough;
  final int? currentIndex;

  const _TimelineProgress({
    required this.cancelled,
    this.dispatchFailed = false,
    required this.completedThrough,
    required this.currentIndex,
  });
}

List<_TimelineStepData> _timelineSteps(String orderType, String status) {
  final isBuy = orderType.toLowerCase() == 'buy';
  if (isBuy) {
    return const [
      _TimelineStepData(key: 'placed', label: 'Order Placed'),
      _TimelineStepData(key: 'confirmed', label: 'Supplier Confirmed'),
      _TimelineStepData(key: 'out', label: 'Out for Delivery'),
      _TimelineStepData(key: 'active', label: 'Delivered & Purchased'),
    ];
  }
  final steps = <_TimelineStepData>[
    const _TimelineStepData(key: 'placed', label: 'Order Placed'),
    const _TimelineStepData(key: 'confirmed', label: 'Supplier Confirmed'),
    const _TimelineStepData(key: 'out', label: 'Out for Delivery'),
    const _TimelineStepData(key: 'delivered', label: 'Delivered'),
    const _TimelineStepData(key: 'active', label: 'Rental Active'),
    const _TimelineStepData(key: 'returned', label: 'Returned'),
  ];
  // Customers can no longer request a buyout. Keep the stage only for an order that was already bought out.
  final compact = status.toLowerCase().trim().replaceAll(RegExp(r'\s+'), '_');
  if (compact == 'bought_out') {
    steps.add(const _TimelineStepData(key: 'bought_out', label: 'Bought Out'));
  }
  return steps;
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
    return const _TimelineProgress(
      cancelled: false,
      dispatchFailed: true,
      completedThrough: -1,
      currentIndex: null,
    );
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
  if (isBuy && (compact == 'returned' || compact == 'bought_out')) {
    return const _TimelineProgress(cancelled: false, completedThrough: 3, currentIndex: null);
  }
  if (compact == 'returned') {
    return const _TimelineProgress(cancelled: false, completedThrough: 5, currentIndex: null);
  }
  if (compact == 'bought_out') {
    return const _TimelineProgress(cancelled: false, completedThrough: 6, currentIndex: null);
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

    late final Color borderColor;
    late final Color fillColor;
    Widget? center;

    if (isDone) {
      borderColor = colors.textPrimary;
      fillColor = colors.textPrimary;
      center = Icon(Icons.check, size: 10, color: colors.surface);
    } else if (isCurrent) {
      // In-progress step: emerald disc (mobile UX; rental-active keeps label tint separately).
      borderColor = colors.success;
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
  final Future<void> Function(String orderId, String optionId) onSelectOption;

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
    required this.onSelectOption,
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

  void _showOptionDescriptionFullScreen(BuildContext context, String label, String description) {
    final colors = context.appColors;
    showDialog<void>(
      context: context,
      builder: (ctx) => Dialog.fullscreen(
        child: Scaffold(
          backgroundColor: colors.background,
          appBar: AppBar(
            backgroundColor: colors.surface,
            foregroundColor: colors.textPrimary,
            title: Text(label),
            leading: IconButton(
              icon: const Icon(Icons.close),
              onPressed: () => Navigator.pop(ctx),
            ),
          ),
          body: SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
              child: SelectableText(
                description,
                style: TextStyle(
                  color: colors.textPrimary,
                  fontSize: 16,
                  height: 1.5,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _showOptionDescription(BuildContext context, String label, String description) {
    final colors = context.appColors;
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(label),
        content: SingleChildScrollView(
          child: Text(
            description,
            style: TextStyle(color: colors.textSecondary, fontSize: 14, height: 1.4),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              _showOptionDescriptionFullScreen(context, label, description);
            },
            child: const Text('Read full screen'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  void _preview(BuildContext context, List<OrderImageModel> photos, int index) {
    if (photos.isEmpty) return;
    final safeIndex = index.clamp(0, photos.length - 1);
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
                child: CatalogImage(
                  url: photos[safeIndex].fileUrl,
                  fit: BoxFit.contain,
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

  Widget _noImageSlot(BuildContext context) {
    final colors = context.appColors;
    final mutedIcon = context.isDarkMode
        ? Colors.white.withValues(alpha: 0.35)
        : colors.textMuted.withValues(alpha: 0.65);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surfaceElevated,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: context.isDarkMode
              ? Colors.white.withValues(alpha: 0.06)
              : colors.border.withValues(alpha: 0.85),
        ),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.image_not_supported_outlined, size: 20, color: mutedIcon),
          const SizedBox(height: 4),
          Text(
            'EMPTY',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: colors.textMuted,
              fontSize: 8.5,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.7,
            ),
          ),
        ],
      ),
    );
  }

  Widget _photoTile({
    required BuildContext context,
    required OrderImageModel photo,
    required List<OrderImageModel> photos,
    required int index,
  }) {
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(12),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => _preview(context, photos, index),
        child: CatalogImage(
          url: photo.tileUrl,
          fit: BoxFit.cover,
          width: double.infinity,
          height: double.infinity,
          borderRadius: BorderRadius.circular(12),
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
                  ? 'Sent to each product’s supplier (vendor) — not BlinksMed support. Choose products or request all. The supplier uploads up to 3 photos under Option 1, Option 2, and so on. Then choose one option.'
                  : 'Sent to the supplier for this product — not BlinksMed support chat below. They upload up to 3 photos under Option 1, Option 2, and so on. Then choose one option.',
              style: TextStyle(
                color: colors.textSecondary,
                fontSize: 13,
                height: 1.4,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 14),
            if (loading && eligible.isEmpty && withRequest.isEmpty)
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
                final request = requestsByOrderId[item.id];
                final images = request?.images ?? const <OrderImageModel>[];
                final options = request?.options ?? const <OrderImageOptionModel>[];
                final waiting = images.isEmpty;
                final viewing = item.id == viewingOrderId;
                final isDark = context.isDarkMode;
                final waitingTextColor = isDark ? Colors.amber : const Color(0xFFD97706);
                final waitingBorderColor = isDark ? Colors.amber.withValues(alpha: 0.35) : const Color(0xFFFDE68A);
                final waitingBgColor = isDark ? Colors.amber.withValues(alpha: 0.08) : const Color(0xFFFFFBEB);
                final waitingBadgeBg = isDark ? Colors.amber.withValues(alpha: 0.2) : const Color(0xFFFEF3C7);
                final successTextColor = colors.success;
                final successBadgeBg = colors.successSoft;
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
                                  item.listingTitle.trim().isEmpty
                                      ? 'Product'
                                      : item.listingTitle,
                                  style: TextStyle(
                                    color: colors.textPrimary,
                                    fontSize: 15,
                                    fontWeight: FontWeight.w800,
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
                                  : '${images.length} received',
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
                      else if (options.isNotEmpty)
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              request?.selectedOptionId != null
                                  ? 'Your selection: ${options.where((o) => o.id == request!.selectedOptionId).isEmpty ? 'an option' : options.firstWhere((o) => o.id == request!.selectedOptionId).label}'
                                  : 'Tap an option to choose it for your supplier.',
                              style: TextStyle(
                                color: isDark ? const Color(0xFFE2E8F0) : colors.textMuted,
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            const SizedBox(height: 10),
                            ...options.map((option) {
                              final note = (option.description ?? '').trim();
                              final photos = option.images;
                              final chosen = request?.selectedOptionId == option.id;
                              final canChoose = photos.isNotEmpty && !busy;
                              return Padding(
                                padding: const EdgeInsets.only(bottom: 8),
                                child: Material(
                                  color: colors.surface,
                                  borderRadius: BorderRadius.circular(14),
                                  clipBehavior: Clip.antiAlias,
                                  child: InkWell(
                                    onTap: canChoose && !chosen
                                        ? () => onSelectOption(item.id, option.id)
                                        : null,
                                    child: Container(
                                      width: double.infinity,
                                      padding: const EdgeInsets.fromLTRB(12, 10, 10, 12),
                                      decoration: BoxDecoration(
                                        borderRadius: BorderRadius.circular(14),
                                        border: Border.all(
                                          color: chosen
                                              ? const Color(0xFF6C63FF).withValues(alpha: 0.45)
                                              : colors.border,
                                          width: chosen ? 1.4 : 1,
                                        ),
                                      ),
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            children: [
                                              Icon(
                                                chosen
                                                    ? Icons.check_circle_rounded
                                                    : Icons.circle_outlined,
                                                size: 20,
                                                color: chosen
                                                    ? const Color(0xFF6C63FF)
                                                    : colors.textMuted,
                                              ),
                                              const SizedBox(width: 8),
                                              Expanded(
                                                child: Text(
                                                  option.label,
                                                  maxLines: 1,
                                                  overflow: TextOverflow.ellipsis,
                                                  style: TextStyle(
                                                    color: colors.textPrimary,
                                                    fontSize: 13,
                                                    fontWeight: FontWeight.w800,
                                                  ),
                                                ),
                                              ),
                                              if (chosen)
                                                Container(
                                                  margin: const EdgeInsets.only(right: 6),
                                                  padding: const EdgeInsets.symmetric(
                                                    horizontal: 8,
                                                    vertical: 3,
                                                  ),
                                                  decoration: BoxDecoration(
                                                    color: const Color(0xFF6C63FF).withValues(alpha: isDark ? 0.18 : 0.12),
                                                    borderRadius: BorderRadius.circular(999),
                                                  ),
                                                  child: Text(
                                                    'Selected',
                                                    style: TextStyle(
                                                      color: isDark
                                                          ? const Color(0xFFC4B5FD)
                                                          : const Color(0xFF4F46E5),
                                                      fontSize: 10,
                                                      fontWeight: FontWeight.w800,
                                                    ),
                                                  ),
                                                ),
                                              if (note.isNotEmpty)
                                                InkWell(
                                                  onTap: () => _showOptionDescription(
                                                    context,
                                                    option.label,
                                                    note,
                                                  ),
                                                  customBorder: const CircleBorder(),
                                                  child: Padding(
                                                    padding: const EdgeInsets.all(4),
                                                    child: Icon(
                                                      Icons.info_outline,
                                                      size: 18,
                                                      color: isDark
                                                          ? const Color(0xFFCBD5E1)
                                                          : colors.textMuted,
                                                    ),
                                                  ),
                                                ),
                                            ],
                                          ),
                                          Padding(
                                            padding: const EdgeInsets.only(top: 10),
                                            child: GridView.builder(
                                              shrinkWrap: true,
                                              physics: const NeverScrollableScrollPhysics(),
                                              itemCount: request?.maxImagesPerOption ?? 3,
                                              gridDelegate:
                                                  const SliverGridDelegateWithFixedCrossAxisCount(
                                                crossAxisCount: 3,
                                                mainAxisSpacing: 8,
                                                crossAxisSpacing: 8,
                                              ),
                                              itemBuilder: (context, index) {
                                                final photo = imageAtSlot(photos, index);
                                                if (photo != null) {
                                                  return _photoTile(
                                                    context: context,
                                                    photo: photo,
                                                    photos: photos,
                                                    index: photos.indexOf(photo).clamp(0, photos.length - 1),
                                                  );
                                                }
                                                return _noImageSlot(context);
                                              },
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                              );
                            }),
                          ],
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
                                onTap: () => _preview(context, images, index),
                                child: CatalogImage(
                                  url: image.tileUrl,
                                  fit: BoxFit.cover,
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

Color _orderActionColor(BuildContext context) {
  return context.isDarkMode ? const Color(0xFF5EEAD4) : AppTheme.accent;
}

class _OrderPrescriptionCard extends StatelessWidget {
  final List<PrescriptionFileModel> files;
  final bool canEdit;
  final bool loading;
  final String? pendingFileName;
  final bool needsConsent;
  final bool acceptedLegal;
  final ValueChanged<bool> onAcceptedLegal;
  final VoidCallback? onRemovePending;
  final VoidCallback onUpload;
  final Future<bool> Function(String fileId) onDelete;

  const _OrderPrescriptionCard({
    required this.files,
    required this.canEdit,
    required this.loading,
    this.pendingFileName,
    required this.needsConsent,
    required this.acceptedLegal,
    required this.onAcceptedLegal,
    this.onRemovePending,
    required this.onUpload,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Prescription',
            style: TextStyle(color: colors.textPrimary, fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          Text(
            'Image or PDF.',
            style: TextStyle(color: colors.textSecondary, fontSize: 12),
          ),
          const SizedBox(height: 12),
          if (loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
            )
          else if (files.isEmpty && pendingFileName == null)
            Text('No prescription uploaded yet.', style: TextStyle(color: colors.textMuted, fontSize: 13))
          else
            ...files.map((file) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Material(
                color: colors.background,
                borderRadius: BorderRadius.circular(12),
                child: InkWell(
                  onTap: () {
                    final uri = Uri.tryParse(file.fileUrl);
                    if (uri != null) launchUrl(uri, mode: LaunchMode.externalApplication);
                  },
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: colors.border),
                    ),
                    child: Row(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: file.isImage
                              ? CatalogImage(
                                  url: file.fileUrl,
                                  width: 48,
                                  height: 48,
                                  fit: BoxFit.cover,
                                  borderRadius: BorderRadius.circular(8),
                                )
                              : Container(
                                  width: 48,
                                  height: 48,
                                  color: _orderActionColor(context).withValues(alpha: 0.12),
                                  child: Icon(Icons.picture_as_pdf, color: _orderActionColor(context)),
                                ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            file.originalFileName ?? 'Prescription file',
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: _orderActionColor(context),
                              fontWeight: FontWeight.w700,
                              height: 1.3,
                              decoration: TextDecoration.underline,
                              decorationColor: _orderActionColor(context),
                            ),
                          ),
                        ),
                        if (canEdit)
                          IconButton(
                            onPressed: () => onDelete(file.id),
                            icon: Icon(Icons.delete_outline, color: colors.textMuted),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            )),
          if (pendingFileName != null) ...[
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: _orderActionColor(context).withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: _orderActionColor(context).withValues(alpha: 0.35)),
              ),
              child: Row(
                children: [
                  Icon(Icons.description_outlined, color: _orderActionColor(context)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      pendingFileName!,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w600),
                    ),
                  ),
                  if (canEdit && onRemovePending != null && !loading)
                    IconButton(
                      onPressed: onRemovePending,
                      icon: Icon(Icons.delete_outline, color: colors.textMuted),
                    ),
                ],
              ),
            ),
          ],
          if (needsConsent && canEdit) ...[
            const SizedBox(height: 8),
            LegalAgreeCheckbox(
              screen: 'prescription',
              value: acceptedLegal,
              onChanged: onAcceptedLegal,
              prefix: 'I consent to the',
              activeColor: _orderActionColor(context),
            ),
            if (!acceptedLegal) ...[
              const SizedBox(height: 6),
              Text(
                'Agree to the Privacy Policy before this prescription can be uploaded.',
                style: TextStyle(color: colors.textSecondary, fontSize: 12, height: 1.35),
              ),
            ],
          ],
          if (canEdit && files.length < 3 && pendingFileName == null)
            TextButton(
              onPressed: onUpload,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.add, size: 18, color: _orderActionColor(context)),
                  const SizedBox(width: 6),
                  Text(
                    'Upload image or PDF',
                    style: TextStyle(color: _orderActionColor(context), fontWeight: FontWeight.w800),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
