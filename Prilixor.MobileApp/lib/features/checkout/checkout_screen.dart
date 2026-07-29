import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/providers/checkout_provider.dart';
import '../../core/providers/cart_provider.dart';
import '../../core/providers/address_provider.dart';
import '../../core/models/cart_model.dart';
import '../../core/models/medical_model.dart';
import '../../shared/utils/require_auth.dart';
import '../../shared/widgets/required_field_ux.dart';
import '../../shared/widgets/catalog_image.dart';
import '../../shared/widgets/rent_exceeds_buy_dialog.dart';
import '../../core/utils/rental_period.dart';
import 'medical_reference_screen.dart';

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

  @override
  void initState() {
    super.initState();
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

  Future<void> _fetchQuote() async {
    final cart = Provider.of<CartProvider>(context, listen: false);
    if (cart.lines.isEmpty) return;
    // Vendor pickup does not require address; others prefer one for distance fees.
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
        .where((s) => cart.lines.any((l) => l.listingId == s.listingId && l.orderType == 'rent'))
        .toList();
    if (pending.isEmpty) return;

    final first = pending.first;
    CartLineModel? line;
    for (final l in cart.lines) {
      if (l.listingId == first.listingId && l.orderType == 'rent') {
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
          : formatRentalDuration(line.rentalDays, line.rentalPeriodUnit),
      buyAvailable: true,
      compulsory: true,
    );
    if (!mounted || confirmed != true) return;

    for (final s in quote.buySuggestions) {
      final match = cart.lines.where((l) => l.listingId == s.listingId && l.orderType == 'rent');
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

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        title: const Text('Checkout', style: TextStyle(color: Colors.white)),
        backgroundColor: const Color(0xFF1E293B),
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: !_authChecked
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF6C63FF)))
          : cart.lines.isEmpty
          ? const Center(child: Text('Cart is empty', style: TextStyle(color: Colors.white)))
          : SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Order Items', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 16),
                  ...cart.lines.map((line) {
                    return Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E293B),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.white10),
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
                                  style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'Qty: ${line.quantity} • ${line.orderType == 'buy' ? 'Buy' : 'Rent ${formatRentalDuration(line.rentalDays, line.rentalPeriodUnit)}'}',
                                  style: const TextStyle(color: Colors.white70, fontSize: 12),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            '₹${line.lineTotal.toStringAsFixed(0)}',
                            style: const TextStyle(color: Color(0xFF6C63FF), fontSize: 14, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    );
                  }),

                  const SizedBox(height: 24),
                  const RequiredLabel('Delivery Address', required: true, style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  const RequiredFieldsNote(padding: EdgeInsets.only(bottom: 12)),
                  if (addressProvider.isLoading)
                    const Center(child: CircularProgressIndicator(color: Color(0xFF6C63FF)))
                  else if (addresses.isEmpty)
                    const Text(
                      'No addresses found. Please add an address in your Profile.',
                      style: TextStyle(color: Colors.white70),
                    )
                  else
                    Container(
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E293B),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: _selectedAddressId == null ? kFieldErrorColor : Colors.white10,
                        ),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: _selectedAddressId,
                          isExpanded: true,
                          dropdownColor: const Color(0xFF1E293B),
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          style: const TextStyle(color: Colors.white, fontSize: 15),
                          icon: const Icon(Icons.arrow_drop_down, color: Colors.white54),
                          hint: const Text('Select address', style: TextStyle(color: Colors.white54)),
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
                  const Text('Delivery option', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
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
                        color: const Color(0xFF1E293B),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFF3B82F6).withValues(alpha: 0.35)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: const Color(0xFF3B82F6).withValues(alpha: 0.12),
                              borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
                            ),
                            child: const Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Icon(Icons.description_outlined, color: Color(0xFF60A5FA)),
                                    SizedBox(width: 10),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            'Doctor reference (optional)',
                                            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                                          ),
                                          SizedBox(height: 4),
                                          Text(
                                            'Enter a doctor Unique ID from their QR / share page, or skip and place the order without one.',
                                            style: TextStyle(color: Colors.white70, fontSize: 13),
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
                                        Text(line.title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
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
                                            style: const TextStyle(color: Colors.white54, fontSize: 11),
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
                                            backgroundColor: const Color(0xFF1E293B),
                                            title: const Text('Apply to all?', style: TextStyle(color: Colors.white)),
                                            content: const Text(
                                              'Use the same doctor Unique ID for all prescription items?',
                                              style: TextStyle(color: Colors.white70),
                                            ),
                                            actions: [
                                              TextButton(
                                                onPressed: () => Navigator.pop(ctx, false),
                                                child: const Text('No', style: TextStyle(color: Colors.white54)),
                                              ),
                                              TextButton(
                                                onPressed: () => Navigator.pop(ctx, true),
                                                child: const Text('Yes', style: TextStyle(color: Color(0xFF6C63FF))),
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
                                      style: const TextStyle(color: Color(0xFF6C63FF), fontWeight: FontWeight.bold),
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
                          ...provider.failedLines.map((l) => Text(
                                '• ${l['message'] ?? 'Failed'}',
                                style: const TextStyle(color: Colors.amber, fontSize: 12),
                              )),
                        ],
                      ),
                    ),
                  ],

                  const SizedBox(height: 24),
                  const Text('Order Summary', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 16),
                  if (provider.isLoading)
                    const Center(
                      child: Padding(
                        padding: EdgeInsets.all(20),
                        child: CircularProgressIndicator(color: Color(0xFF6C63FF)),
                      ),
                    )
                  else if (provider.errorMessage != null)
                    Text(provider.errorMessage!, style: const TextStyle(color: Colors.redAccent))
                  else if (quote != null)
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E293B),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.white10),
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
                          // Service fee UI hidden — keep for future re-enable
                          if (false && quote.serviceFeeAmount > 0) ...[
                            const SizedBox(height: 8),
                            _buildQuoteRow('Service Fee', quote.serviceFeeAmount),
                          ],
                          if (quote.gstAmount > 0) ...[
                            const SizedBox(height: 8),
                            _buildQuoteRow('Taxes (GST)', quote.gstAmount),
                          ],
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 12),
                            child: Divider(color: Colors.white24),
                          ),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('Total Amount', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                              Text(
                                '₹${quote.totalAmount.toStringAsFixed(0)}',
                                style: const TextStyle(color: Color(0xFF6C63FF), fontSize: 20, fontWeight: FontWeight.bold),
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
              color: const Color(0xFF1E293B),
              child: SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF6C63FF),
                    disabledBackgroundColor: Colors.white12,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  onPressed: provider.isPlacingOrder ||
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
                          final success = await provider.placeOrder(
                            cart.lines,
                            addressId: _selectedAddressId,
                            deliveryOption: _deliveryOption,
                            medicalRefs: _medicalRefs,
                          );
                          if (success && mounted) {
                            cart.clearCart();
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Order placed successfully!'),
                                backgroundColor: Colors.green,
                              ),
                            );
                            Navigator.of(context).popUntil((route) => route.isFirst);
                          } else if (provider.errorMessage != null && mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text(provider.errorMessage!), backgroundColor: Colors.redAccent),
                            );
                          }
                        },
                  child: provider.isPlacingOrder
                      ? const CircularProgressIndicator(color: Colors.white)
                      : Text(
                          'Place Order',
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
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
          color: const Color(0xFF1E293B),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: selected ? const Color(0xFF6C63FF) : Colors.white10),
        ),
        child: Row(
          children: [
            Icon(
              selected ? Icons.radio_button_checked : Icons.radio_button_off,
              color: selected ? const Color(0xFF6C63FF) : Colors.white38,
              size: 20,
            ),
            const SizedBox(width: 12),
            Expanded(child: Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w500))),
            Text(trailing, style: const TextStyle(color: Colors.white54, fontSize: 13)),
          ],
        ),
      ),
    );
  }

  Widget _buildQuoteRow(String label, double amount) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(color: Colors.white70, fontSize: 15)),
        Text('₹${amount.toStringAsFixed(0)}', style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w500)),
      ],
    );
  }
}
