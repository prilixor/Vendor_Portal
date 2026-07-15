import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/models/cart_model.dart';
import '../../core/providers/cart_provider.dart';
import '../../shared/utils/require_auth.dart';
import '../../shared/widgets/catalog_image.dart';
import '../checkout/checkout_screen.dart';

class CartScreen extends StatefulWidget {
  final VoidCallback? onContinueShopping;

  const CartScreen({super.key, this.onContinueShopping});

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<CartProvider>(context, listen: false).refreshStock();
    });
  }

  @override
  Widget build(BuildContext context) {
    final cart = Provider.of<CartProvider>(context);
    final auth = Provider.of<AuthProvider>(context);
    final checkoutLabel = auth.isAuthenticated ? 'Proceed to Checkout' : 'Sign in to Checkout';

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        centerTitle: true,
        title: const Text('My Cart', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 20)),
        backgroundColor: const Color(0xFF0F172A),
        iconTheme: const IconThemeData(color: Colors.white),
        elevation: 0,
      ),
      body: cart.lines.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: const BoxDecoration(
                      color: Color(0xFF1E293B),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.shopping_cart_outlined, size: 80, color: Color(0xFF6C63FF)),
                  ),
                  const SizedBox(height: 24),
                  const Text('Your cart is empty', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  const Text('Looks like you haven\'t added\nanything to your cart yet.', textAlign: TextAlign.center, style: TextStyle(color: Colors.white54, fontSize: 16)),
                  const SizedBox(height: 32),
                  ElevatedButton(
                    onPressed: () {
                      if (widget.onContinueShopping != null) {
                        widget.onContinueShopping!();
                      } else if (Navigator.canPop(context)) {
                        Navigator.pop(context);
                      }
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF6C63FF),
                      padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)),
                    ),
                    child: const Text('Continue Shopping', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            )
          : Column(
              children: [
                if (cart.needsPrescription)
                  Container(
                    width: double.infinity,
                    margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFF3B82F6).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFF3B82F6).withValues(alpha: 0.35)),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.medical_information_outlined, color: Color(0xFF60A5FA), size: 20),
                        SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Some items need a doctor reference at checkout.',
                            style: TextStyle(color: Color(0xFF93C5FD), fontSize: 13),
                          ),
                        ),
                      ],
                    ),
                  ),
                if (cart.isRefreshingStock)
                  const LinearProgressIndicator(minHeight: 2, color: Color(0xFF6C63FF), backgroundColor: Colors.transparent),
                Expanded(
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: cart.lines.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 16),
                    itemBuilder: (context, index) {
                      final line = cart.lines[index];
                      return _CartLineCard(line: line, cart: cart);
                    },
                  ),
                ),
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: const BoxDecoration(
                    color: Color(0xFF1E293B),
                    borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
                  ),
                  child: SafeArea(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        _summaryRow('Subtotal', '₹${cart.totalEstimatedRent.toStringAsFixed(0)}'),
                        const SizedBox(height: 8),
                        _summaryRow('Refundable deposit', '₹${cart.totalDeposit.toStringAsFixed(0)}'),
                        const SizedBox(height: 8),
                        _summaryRow('Service fee', '₹0'),
                        const Divider(color: Colors.white12, height: 24),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Total', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                            Text(
                              '₹${cart.totalEstimatedRent.toStringAsFixed(0)}',
                              style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                        if (cart.hasStockIssues) ...[
                          const SizedBox(height: 12),
                          const Text(
                            'Fix stock issues above before checkout.',
                            style: TextStyle(color: Colors.redAccent, fontSize: 12, fontWeight: FontWeight.w600),
                          ),
                        ],
                        const SizedBox(height: 16),
                        ElevatedButton(
                          onPressed: cart.hasStockIssues
                              ? null
                              : () async {
                                  final ok = await ensureAuthenticated(
                                    context,
                                    message: 'Sign in to checkout and place your order.',
                                  );
                                  if (!ok || !context.mounted) return;
                                  await Navigator.push(
                                    context,
                                    MaterialPageRoute(builder: (_) => const CheckoutScreen()),
                                  );
                                },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF6C63FF),
                            disabledBackgroundColor: Colors.white12,
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          ),
                          child: Text(checkoutLabel, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _summaryRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(color: Colors.white70, fontSize: 14)),
        Text(value, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600)),
      ],
    );
  }
}

class _CartLineCard extends StatelessWidget {
  final CartLineModel line;
  final CartProvider cart;

  const _CartLineCard({required this.line, required this.cart});

  @override
  Widget build(BuildContext context) {
    final avail = cart.availableQuantityFor(line);
    final overStock = avail != null && line.quantity > avail;
    final canBuy = line.buyPrice != null || line.orderType == 'buy';

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: overStock ? Colors.redAccent.withValues(alpha: 0.5) : Colors.white10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 80,
                height: 80,
                clipBehavior: Clip.antiAlias,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  color: const Color(0xFF0F172A),
                ),
                child: CatalogImage(
                  url: line.primaryImageUrl,
                  width: 80,
                  height: 80,
                  fit: BoxFit.cover,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      line.title,
                      style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      line.orderType == 'buy'
                          ? 'Buy · ₹${(line.buyPrice ?? (line.dailyRent * 30)).toStringAsFixed(0)}'
                          : '₹${line.dailyRent.toStringAsFixed(0)}/day · deposit ₹${line.securityDeposit.toStringAsFixed(0)}',
                      style: const TextStyle(color: Colors.white70, fontSize: 12),
                    ),
                    if (line.prescriptionRequired) ...[
                      const SizedBox(height: 4),
                      const Text('Rx required', style: TextStyle(color: Colors.amber, fontSize: 12, fontWeight: FontWeight.w600)),
                    ],
                  ],
                ),
              ),
              Column(
                children: [
                  IconButton(
                    icon: const Icon(Icons.delete_outline, color: Colors.redAccent),
                    onPressed: () => cart.removeLine(line.listingId, productVariantId: line.productVariantId),
                  ),
                  Text(
                    '₹${line.lineTotal.toStringAsFixed(0)}',
                    style: const TextStyle(color: Color(0xFF6C63FF), fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 16,
            runSpacing: 12,
            crossAxisAlignment: WrapCrossAlignment.end,
            children: [
              _LabeledControl(
                label: 'Qty',
                child: _MiniStepper(
                  value: line.quantity,
                  min: 1,
                  max: avail ?? 999,
                  onChanged: (val) => cart.updateQuantity(
                    line.listingId,
                    val,
                    productVariantId: line.productVariantId,
                  ),
                ),
              ),
              _LabeledControl(
                label: 'Type',
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0F172A),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.white12),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: line.orderType,
                      dropdownColor: const Color(0xFF1E293B),
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                      items: [
                        const DropdownMenuItem(value: 'rent', child: Text('Rent')),
                        if (canBuy || line.orderType == 'buy')
                          const DropdownMenuItem(value: 'buy', child: Text('Buy')),
                      ],
                      onChanged: (v) {
                        if (v == null) return;
                        cart.updateOrderType(
                          line.listingId,
                          v,
                          productVariantId: line.productVariantId,
                        );
                      },
                    ),
                  ),
                ),
              ),
              if (line.orderType == 'rent')
                _LabeledControl(
                  label: 'Days',
                  child: _MiniStepper(
                    value: line.rentalDays,
                    min: 1,
                    max: 366,
                    onChanged: (val) => cart.updateRentalDays(
                      line.listingId,
                      val,
                      productVariantId: line.productVariantId,
                    ),
                  ),
                ),
            ],
          ),
          if (overStock) ...[
            const SizedBox(height: 10),
            Text(
              'Only $avail unit(s) available in stock. Please reduce quantity to proceed.',
              style: const TextStyle(color: Colors.redAccent, fontSize: 12, fontWeight: FontWeight.w600),
            ),
          ],
        ],
      ),
    );
  }
}

class _LabeledControl extends StatelessWidget {
  final String label;
  final Widget child;

  const _LabeledControl({required this.label, required this.child});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Colors.white54, fontSize: 11, fontWeight: FontWeight.w600)),
        const SizedBox(height: 4),
        child,
      ],
    );
  }
}

class _MiniStepper extends StatelessWidget {
  final int value;
  final int min;
  final int max;
  final ValueChanged<int> onChanged;

  const _MiniStepper({
    required this.value,
    required this.min,
    required this.max,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            icon: const Icon(Icons.remove, size: 16, color: Colors.white),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
            onPressed: value > min ? () => onChanged(value - 1) : null,
          ),
          Text('$value', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          IconButton(
            icon: const Icon(Icons.add, size: 16, color: Colors.white),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
            onPressed: value < max ? () => onChanged(value + 1) : null,
          ),
        ],
      ),
    );
  }
}
