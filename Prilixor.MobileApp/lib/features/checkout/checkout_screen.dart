import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import '../../core/theme.dart';
import '../../core/providers/checkout_provider.dart';
import '../../shared/utils/razorpay_web_checkout.dart';
import '../../core/providers/cart_provider.dart';
import '../../core/providers/address_provider.dart';
import '../../core/models/cart_model.dart';
import '../../core/models/medical_model.dart';
import '../../shared/utils/require_auth.dart';
import '../../shared/widgets/brand_page_loader.dart';
import '../../shared/widgets/required_field_ux.dart';
import '../../shared/widgets/catalog_image.dart';
import '../../shared/widgets/rent_exceeds_buy_dialog.dart';
import '../../shared/widgets/struck_price.dart';
import '../../core/utils/rental_period.dart';
import '../profile/addresses_screen.dart';
import 'medical_reference_screen.dart';

/// Temporary: hide Vendor pickup from checkout UI (keep code for later).
const bool kShowVendorPickupOption = false;

class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({super.key});

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  String? _selectedAddressId;
  String _deliveryOption = 'standard';
  final Map<String, MedicalRefModel> _medicalRefs = {};
  bool _authChecked = false;

  late Razorpay _razorpay;
  bool _isProcessingCheckout = false;
  String? _activeCheckoutSessionId;

  @override
  void initState() {
    super.initState();
    if (!kIsWeb) {
      _razorpay = Razorpay();
      _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _handlePaymentSuccess);
      _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _handlePaymentError);
      _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, _handleExternalWallet);
    }

    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final ok = await ensureAuthenticated(
        context,
        message: 'Sign in to checkout and place your order.',
      );
      if (!mounted) return;
      if (!ok) {
        Navigator.pop(context);
        return;
      }
      setState(() => _authChecked = true);
      final addrProv = Provider.of<AddressProvider>(context, listen: false);
      await addrProv.fetchAddresses();
      if (!mounted) return;
      if (addrProv.addresses.isNotEmpty) {
        final defaultAddr = addrProv.addresses.firstWhere(
          (a) => a.isDefault,
          orElse: () => addrProv.addresses.first,
        );
        setState(() => _selectedAddressId = defaultAddr.id);
      }
      _fetchQuote();
    });
  }

  @override
  void dispose() {
    if (!kIsWeb) {
      _razorpay.clear();
    }
    super.dispose();
  }

  void _handlePaymentSuccess(PaymentSuccessResponse response) async {
    final sessionId = _activeCheckoutSessionId;
    if (sessionId == null || !mounted) {
      if (mounted) setState(() => _isProcessingCheckout = false);
      return;
    }

    final provider = Provider.of<CheckoutProvider>(context, listen: false);
    final cart = Provider.of<CartProvider>(context, listen: false);

    final verified = await provider.verifyCheckout(
      checkoutSessionId: sessionId,
      razorpayOrderId: response.orderId ?? '',
      razorpayPaymentId: response.paymentId ?? '',
      razorpaySignature: response.signature ?? '',
    );

    if (!mounted) return;
    setState(() => _isProcessingCheckout = false);

    if (verified) {
      cart.clearCart();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Payment successful! Your order has been submitted.'),
          backgroundColor: Colors.green,
        ),
      );
      Navigator.of(context).popUntil((route) => route.isFirst);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(provider.errorMessage ?? 'Payment verification failed. Please contact support.'),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  void _handlePaymentError(PaymentFailureResponse response) {
    if (!mounted) return;
    setState(() => _isProcessingCheckout = false);
    final message = response.message ?? 'Payment cancelled or failed.';
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.orangeAccent,
      ),
    );
  }

  void _handleExternalWallet(ExternalWalletResponse response) {
    if (!mounted) return;
    setState(() => _isProcessingCheckout = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('External Wallet: ${response.walletName}')),
    );
  }

  Future<void> _fetchQuote() async {
    final cart = Provider.of<CartProvider>(context, listen: false);
    if (cart.lines.isEmpty) return;
    // Distance quote needs a delivery address — avoid 400 spam when none selected.
    if (_selectedAddressId == null || _selectedAddressId!.isEmpty) {
      return;
    }
    final provider = Provider.of<CheckoutProvider>(context, listen: false);
    await provider.getQuote(
      cart.lines,
      addressId: _selectedAddressId,
      deliveryOption: _deliveryOption,
      medicalRefs: _medicalRefs,
    );
    if (!mounted) return;
    await _handleBuySuggestions();
  }

  Future<void> _handleBuySuggestions() async {
    final provider = Provider.of<CheckoutProvider>(context, listen: false);
    final cart = Provider.of<CartProvider>(context, listen: false);
    final quote = provider.quote;
    if (quote == null || quote.buySuggestions.isEmpty) return;

    final pending = quote.buySuggestions
        .where(
          (s) => cart.lines.any(
            (l) => l.listingId == s.listingId && l.orderType == 'rent' && l.isBuyEnabled,
          ),
        )
        .toList();
    if (pending.isEmpty) return;

    final first = pending.first;
    CartLineModel? line;
    for (final l in cart.lines) {
      if (l.listingId == first.listingId && l.orderType == 'rent' && l.isBuyEnabled) {
        line = l;
        break;
      }
    }
    final confirmed = await showRentExceedsBuyDialog(
      context,
      itemTitle: first.listingTitle,
      rentalTotal: first.rentAmount,
      buyTotal: first.buyAmount,
      durationLabel: line == null
          ? 'this rental'
          : (line.rentalDurationLabel?.isNotEmpty == true
              ? line.rentalDurationLabel!
              : formatRentalDuration(line.rentalDays, line.rentalPeriodUnit)),
      buyAvailable: true,
      compulsory: true,
    );
    if (!mounted || confirmed != true) return;

    for (final s in quote.buySuggestions) {
      final match = cart.lines.where(
        (l) =>
            l.listingId == s.listingId &&
            l.orderType == 'rent' &&
            l.isBuyEnabled &&
            (l.buyPrice ?? 0) > 0,
      );
      for (final l in match) {
        cart.updateOrderType(l.listingId, 'buy', productVariantId: l.productVariantId);
      }
    }
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Order type updated to Buy'), backgroundColor: Colors.green),
    );
    await _fetchQuote();
  }

  // Doctor Unique ID is optional — never block place-order.

  Future<void> _openMedicalRef(String listingId, String title) async {
    final result = await Navigator.push<MedicalRefModel>(
      context,
      MaterialPageRoute(
        builder: (_) => MedicalReferenceScreen(
          title: 'Doctor for $title',
          initial: _medicalRefs[listingId] ?? const MedicalRefModel(),
        ),
      ),
    );
    if (result != null && mounted) {
      setState(() => _medicalRefs[listingId] = result);
      _fetchQuote();
    }
  }

  void _applyMedicalRefToAll(String sourceListingId) {
    final source = _medicalRefs[sourceListingId];
    if (source == null) return;
    final cart = Provider.of<CartProvider>(context, listen: false);
    setState(() {
      for (final line in cart.lines.where((l) => l.prescriptionRequired)) {
        _medicalRefs[line.listingId] = source;
      }
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Applied doctor reference to all prescription items')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<CheckoutProvider>(context);
    final cart = Provider.of<CartProvider>(context);
    final addressProvider = Provider.of<AddressProvider>(context);
    final addresses = addressProvider.addresses;
    final quote = provider.quote;
    final needsPrescription = cart.needsPrescription;
    final rxLines = cart.lines.where((l) => l.prescriptionRequired).toList();
    final colors = context.appColors;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        title: Text('Checkout', style: TextStyle(color: colors.textPrimary)),
        backgroundColor: colors.surface,
        elevation: 0,
        iconTheme: IconThemeData(color: colors.textPrimary),
      ),
      body: !_authChecked
          ? const BrandPageLoader()
          : cart.lines.isEmpty
          ? Center(child: Text('Cart is empty', style: TextStyle(color: colors.textPrimary)))
          : SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Order Items', style: TextStyle(color: colors.textPrimary, fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 16),
                  ...cart.lines.map((line) {
                    return Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: colors.surface,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: colors.border),
                      ),
                      child: Row(
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: SizedBox(
                              width: 50,
                              height: 50,
                              child: CatalogImage(
                                url: line.primaryImageUrl,
                                width: 50,
                                height: 50,
                                fit: BoxFit.cover,
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  line.title,
                                  style: TextStyle(color: colors.textPrimary, fontSize: 14, fontWeight: FontWeight.bold),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'Qty: ${line.quantity} • ${line.orderType == 'buy' ? 'Buy' : line.usesPricingPlan ? (line.rentalDurationLabel ?? '${line.rentalDurationDays ?? line.rentalDays}-Day Plan') : 'Rent ${formatRentalDuration(line.rentalDays, line.rentalPeriodUnit)}'}',
                                  style: TextStyle(color: colors.textSecondary, fontSize: 12),
                                ),
                                if (line.orderType == 'rent' && line.usesPricingPlan) ...[
                                  const SizedBox(height: 2),
                                  Wrap(
                                    crossAxisAlignment: WrapCrossAlignment.center,
                                    spacing: 6,
                                    children: [
                                      const Text(
                                        'Starts on delivery',
                                        style: TextStyle(color: Colors.white38, fontSize: 11),
                                      ),
                                      if (line.rentalNormalPrice != null &&
                                          line.rentalNormalPrice! > (line.rentalFinalPrice ?? 0)) ...[
                                        const Text('·', style: TextStyle(color: Colors.white24, fontSize: 11)),
                                        StruckPrice(
                                          '₹${line.rentalNormalPrice!.toStringAsFixed(0)}',
                                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
                                        ),
                                        Text(
                                          '₹${(line.rentalFinalPrice ?? 0).toStringAsFixed(0)}',
                                          style: const TextStyle(
                                            color: Colors.white70,
                                            fontSize: 11,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ],
                              ],
                            ),
                          ),
                          Text(
                            '₹${line.lineTotal.toStringAsFixed(0)}',
                            style: TextStyle(color: colors.accent, fontSize: 14, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    );
                  }),

                  const SizedBox(height: 24),
                  RequiredLabel('Delivery Address', required: true, style: TextStyle(color: colors.textPrimary, fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  const RequiredFieldsNote(padding: EdgeInsets.only(bottom: 12)),
                  if (addressProvider.isLoading)
                    Center(child: CircularProgressIndicator(color: colors.accent))
                  else if (addresses.isEmpty)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: colors.surface,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: kFieldErrorColor.withValues(alpha: 0.55),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            'No delivery address yet',
                            style: TextStyle(
                              color: colors.textPrimary,
                              fontWeight: FontWeight.w700,
                              fontSize: 15,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Add an address with a map pin to continue checkout.',
                            style: TextStyle(color: colors.textSecondary, fontSize: 13),
                          ),
                          const SizedBox(height: 14),
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton.icon(
                              onPressed: () async {
                                await Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) =>
                                        const AddressesScreen(openAddOnLoad: true),
                                  ),
                                );
                                if (!mounted) return;
                                await addressProvider.fetchAddresses();
                                if (!mounted) return;
                                final refreshed = addressProvider.addresses;
                                if (refreshed.isNotEmpty) {
                                  setState(() {
                                    _selectedAddressId = refreshed.first.id;
                                  });
                                  _fetchQuote();
                                }
                              },
                              icon: const Icon(Icons.add_location_alt_outlined,
                                  color: Colors.white, size: 18),
                              label: const Text(
                                'Add Address',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF6C63FF),
                                elevation: 0,
                                minimumSize: const Size.fromHeight(48),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    )
                  else
                    Container(
                      decoration: BoxDecoration(
                        color: colors.surface,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: _selectedAddressId == null ? kFieldErrorColor : colors.border,
                        ),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: _selectedAddressId,
                          isExpanded: true,
                          dropdownColor: colors.surface,
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          style: TextStyle(color: colors.textPrimary, fontSize: 15),
                          icon: Icon(Icons.arrow_drop_down, color: colors.textMuted),
                          hint: Text('Select address', style: TextStyle(color: colors.textMuted)),
                          onChanged: (String? newValue) {
                            setState(() => _selectedAddressId = newValue);
                            _fetchQuote();
                          },
                          items: addresses.map<DropdownMenuItem<String>>((addr) {
                            return DropdownMenuItem<String>(
                              value: addr.id,
                              child: Text('${addr.label ?? 'Address'} - ${addr.line1}, ${addr.city}'),
                            );
                          }).toList(),
                        ),
                      ),
                    ),
                  if (_selectedAddressId == null && addresses.isNotEmpty)
                    const FieldErrorText('Delivery address is required'),

                  const SizedBox(height: 24),
                  Text('Delivery option', style: TextStyle(color: colors.textPrimary, fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  _deliveryOptionTile(
                    value: 'standard',
                    title: 'Standard (2-3 days)',
                    trailing: 'Included',
                  ),
                  _deliveryOptionTile(
                    value: 'express',
                    title: 'Express (next-day)',
                    trailing: 'Dynamic',
                  ),
                  if (kShowVendorPickupOption)
                    _deliveryOptionTile(
                      value: 'vendor_pickup',
                      title: 'Vendor pickup',
                      trailing: 'Free',
                    ),

                  if (needsPrescription) ...[
                    const SizedBox(height: 24),
                    Container(
                      width: double.infinity,
                      decoration: BoxDecoration(
                        color: colors.surface,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: colors.accent.withValues(alpha: 0.35)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: colors.accent.withValues(alpha: 0.12),
                              borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Icon(Icons.description_outlined, color: colors.accent),
                                    SizedBox(width: 10),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            'Doctor reference (optional)',
                                            style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold),
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            'Enter a doctor Unique ID from their QR / share page, or skip and place the order without one.',
                                            style: TextStyle(color: colors.textSecondary, fontSize: 13),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          ...rxLines.map((line) {
                            final ref = _medicalRefs[line.listingId];
                            final filled = ref?.hasDoctor == true;
                            return Padding(
                              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(line.title, style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w600)),
                                        const SizedBox(height: 4),
                                        Text(
                                          filled
                                              ? 'Linked · ${ref!.doctorName ?? 'Doctor'} (${ref.uniqueCode})'
                                              : 'No doctor linked yet',
                                          style: TextStyle(
                                            color: filled ? const Color(0xFF34D399) : Colors.amber,
                                            fontSize: 12,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                        if (filled && ref!.hospitals.isNotEmpty) ...[
                                          const SizedBox(height: 2),
                                          Text(
                                            ref.hospitals.length == 1
                                                ? (ref.hospitals.first.placeLabel != null
                                                    ? '${ref.hospitals.first.name} · ${ref.hospitals.first.placeLabel}'
                                                    : ref.hospitals.first.name)
                                                : '${ref.hospitals.length} affiliated hospitals',
                                            style: TextStyle(color: colors.textMuted, fontSize: 11),
                                          ),
                                        ],
                                      ],
                                    ),
                                  ),
                                  TextButton(
                                    onPressed: () async {
                                      await _openMedicalRef(line.listingId, line.title);
                                      if (rxLines.length > 1 &&
                                          _medicalRefs[line.listingId]?.hasDoctor == true &&
                                          mounted) {
                                        final apply = await showDialog<bool>(
                                          context: context,
                                          builder: (ctx) => AlertDialog(
                                            backgroundColor: colors.surface,
                                            title: Text('Apply to all?', style: TextStyle(color: colors.textPrimary)),
                                            content: Text(
                                              'Use the same doctor Unique ID for all prescription items?',
                                              style: TextStyle(color: colors.textSecondary),
                                            ),
                                            actions: [
                                              TextButton(
                                                onPressed: () => Navigator.pop(ctx, false),
                                                child: Text('No', style: TextStyle(color: colors.textMuted)),
                                              ),
                                              TextButton(
                                                onPressed: () => Navigator.pop(ctx, true),
                                                child: Text('Yes', style: TextStyle(color: colors.accent)),
                                              ),
                                            ],
                                          ),
                                        );
                                        if (apply == true) {
                                          _applyMedicalRefToAll(line.listingId);
                                        }
                                      }
                                    },
                                    child: Text(
                                      filled ? 'Change' : 'Add Unique ID',
                                      style: TextStyle(color: colors.accent, fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                ],
                              ),
                            );
                          }),
                        ],
                      ),
                    ),
                  ],

                  if (provider.failedLines.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.amber.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.amber.withValues(alpha: 0.4)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Some items could not be placed', style: TextStyle(color: Colors.amber, fontWeight: FontWeight.bold)),
                          const SizedBox(height: 8),
                          ...provider.failedLines.map((l) {
                            final message = (l['message'] ?? 'Failed').toString();
                            final suggestions = (l['variantSuggestions'] as List?)
                                    ?.whereType<Map>()
                                    .map((e) => Map<String, dynamic>.from(e))
                                    .toList() ??
                                const <Map<String, dynamic>>[];
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '• $message',
                                    style: const TextStyle(color: Colors.amber, fontSize: 12),
                                  ),
                                  if (suggestions.isNotEmpty) ...[
                                    const SizedBox(height: 6),
                                    Text(
                                      'Available packaging sizes:',
                                      style: TextStyle(color: colors.textMuted, fontSize: 11),
                                    ),
                                    const SizedBox(height: 6),
                                    Wrap(
                                      spacing: 6,
                                      runSpacing: 6,
                                      children: suggestions.map((s) {
                                        final sizeValue = s['sizeValue']?.toString() ?? '';
                                        final sizeUnit = s['sizeUnit']?.toString() ?? '';
                                        final buyPrice = (s['buyPrice'] as num?)?.toDouble() ?? 0;
                                        final qty = (s['availableQuantity'] as num?)?.toInt() ?? 0;
                                        return Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                          decoration: BoxDecoration(
                                            color: colors.surfaceElevated,
                                            borderRadius: BorderRadius.circular(999),
                                            border: Border.all(color: Colors.amber.withValues(alpha: 0.35)),
                                          ),
                                          child: Text(
                                            '$sizeValue $sizeUnit · ₹${buyPrice.toStringAsFixed(0)} · $qty in stock',
                                            style: TextStyle(color: colors.textSecondary, fontSize: 11),
                                          ),
                                        );
                                      }).toList(),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      'Update packaging size or quantity in your cart, then try again.',
                                      style: TextStyle(color: colors.textMuted, fontSize: 11),
                                    ),
                                  ],
                                ],
                              ),
                            );
                          }),
                        ],
                      ),
                    ),
                  ],

                  const SizedBox(height: 24),
                  Text('Order Summary', style: TextStyle(color: colors.textPrimary, fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 16),
                  if (provider.isLoading)
                    Center(
                      child: Padding(
                        padding: EdgeInsets.all(20),
                        child: CircularProgressIndicator(color: colors.accent),
                      ),
                    )
                  else if (provider.errorMessage != null)
                    Text(provider.errorMessage!, style: const TextStyle(color: Colors.redAccent))
                  else if (quote != null)
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: colors.surface,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: colors.border),
                      ),
                      child: Column(
                        children: [
                          _buildQuoteRow('Subtotal', quote.subtotalAmount),
                          if (quote.depositAmount > 0) ...[
                            const SizedBox(height: 8),
                            _buildQuoteRow('Security Deposit', quote.depositAmount),
                          ],
                          if (quote.expressFeeAmount > 0) ...[
                            const SizedBox(height: 8),
                            _buildQuoteRow('Express delivery', quote.expressFeeAmount),
                          ],
                          if (quote.distanceFeeAmount > 0) ...[
                            const SizedBox(height: 8),
                            _buildQuoteRow('Distance delivery fee', quote.distanceFeeAmount),
                          ],
                          if (false && quote.serviceFeeAmount > 0) ...[
                            const SizedBox(height: 8),
                            _buildQuoteRow('Service Fee', quote.serviceFeeAmount),
                          ],
                          if (quote.gstAmount > 0) ...[
                            const SizedBox(height: 8),
                            _buildQuoteRow('Taxes (GST)', quote.gstAmount),
                          ],
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            child: Divider(color: colors.border),
                          ),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text('Total Amount', style: TextStyle(color: colors.textPrimary, fontSize: 18, fontWeight: FontWeight.bold)),
                              Text(
                                '₹${quote.totalAmount.toStringAsFixed(0)}',
                                style: TextStyle(color: colors.accent, fontSize: 20, fontWeight: FontWeight.bold),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  const SizedBox(height: 100),
                ],
              ),
            ),
      bottomSheet: quote != null
          ? Container(
              padding: const EdgeInsets.all(20),
              color: colors.surface,
              child: SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: colors.accent,
                    disabledBackgroundColor: colors.border,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  onPressed: provider.isPlacingOrder ||
                          _isProcessingCheckout ||
                          provider.errorMessage != null
                      ? null
                      : () async {
                          if (_deliveryOption != 'vendor_pickup' &&
                              (_selectedAddressId == null || addresses.isEmpty)) {
                            showRequiredFieldsBlocked(
                              context,
                              message: 'Please fill in the required fields. Select a delivery address.',
                            );
                            return;
                          }
                          setState(() => _isProcessingCheckout = true);

                          final session = await provider.createCheckout(
                            cart.lines,
                            addressId: _selectedAddressId,
                            deliveryOption: _deliveryOption,
                            medicalRefs: _medicalRefs,
                          );

                          if (!mounted) return;
                          if (session == null) {
                            setState(() => _isProcessingCheckout = false);
                            if (provider.errorMessage != null) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text(provider.errorMessage!), backgroundColor: Colors.redAccent),
                              );
                            }
                            return;
                          }

                          _activeCheckoutSessionId = session.checkoutSessionId;

                          final amountPaise = (session.amount * 100).round();
                          if (kIsWeb) {
                            await openRazorpayWeb(
                              key: session.razorpayKeyId,
                              amountPaise: amountPaise,
                              currency: session.currency,
                              orderId: session.razorpayOrderId ?? '',
                              name: 'BlinksMed',
                              description: 'Pay for ${session.orders.length} order(s)',
                              email: '',
                              contact: '',
                              onSuccess: (paymentId, orderId, signature) {
                                _handlePaymentSuccess(PaymentSuccessResponse(
                                  paymentId,
                                  orderId,
                                  signature,
                                  null,
                                ));
                              },
                              onError: (message) {
                                _handlePaymentError(PaymentFailureResponse(0, message, null));
                              },
                            );
                          } else {
                            final options = {
                              'key': session.razorpayKeyId,
                              'amount': amountPaise,
                              'currency': session.currency,
                              'name': 'BlinksMed',
                              'description': 'Pay for ${session.orders.length} order(s)',
                              'order_id': session.razorpayOrderId,
                            };

                            try {
                              _razorpay.open(options);
                            } catch (e) {
                              if (mounted) {
                                setState(() => _isProcessingCheckout = false);
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text('Unable to launch Razorpay: $e'), backgroundColor: Colors.redAccent),
                                );
                              }
                            }
                          }
                        },
                  child: provider.isPlacingOrder || _isProcessingCheckout
                      ? const CircularProgressIndicator(color: Colors.white)
                      : const Text(
                          'Place Order',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                        ),
                ),
              ),
            )
          : null,
    );
  }

  Widget _deliveryOptionTile({
    required String value,
    required String title,
    required String trailing,
  }) {
    final colors = context.appColors;
    final selected = _deliveryOption == value;
    return GestureDetector(
      onTap: () {
        setState(() => _deliveryOption = value);
        _fetchQuote();
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: selected ? const Color(0xFF6C63FF) : colors.border),
        ),
        child: Row(
          children: [
            Icon(
              selected ? Icons.radio_button_checked : Icons.radio_button_off,
              color: selected ? const Color(0xFF6C63FF) : colors.border,
              size: 20,
            ),
            const SizedBox(width: 12),
            Expanded(child: Text(title, style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w500))),
            Text(trailing, style: TextStyle(color: colors.textMuted, fontSize: 13)),
          ],
        ),
      ),
    );
  }

  Widget _buildQuoteRow(String label, double amount) {
    final colors = context.appColors;
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: TextStyle(color: colors.textSecondary, fontSize: 15)),
        Text('₹${amount.toStringAsFixed(0)}', style: TextStyle(color: colors.textPrimary, fontSize: 15, fontWeight: FontWeight.w500)),
      ],
    );
  }
}
