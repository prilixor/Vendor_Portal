import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/models/cart_model.dart';
import '../../core/providers/cart_provider.dart';
import '../../core/utils/rental_period.dart';
import '../../shared/utils/require_auth.dart';
import '../../shared/widgets/catalog_image.dart';
import '../../shared/widgets/rent_exceeds_buy_dialog.dart';
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
                            'Some items support an optional doctor Unique ID at checkout.',
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
                        // Service fee UI hidden — keep for future re-enable
                        // const SizedBox(height: 8),
                        // _summaryRow('Service fee', '₹0'),
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

  Future<bool> _promptRentToBuy(
    BuildContext context, {
    int? nextPeriods,
    String? nextUnit,
    int? nextQty,
  }) async {
    final buyPrice = line.buyPrice ?? 0;
    if (buyPrice <= 0 || line.orderType != 'rent') return false;
    final check = evaluateRentVsBuy(
      buyPrice: buyPrice,
      quantity: nextQty ?? line.quantity,
      periods: nextPeriods ?? line.rentalDays,
      unit: nextUnit ?? line.rentalPeriodUnit,
      dailyRent: line.dailyRent,
      weeklyRent: line.weeklyRent,
      monthlyRent: line.monthlyRent,
    );
    if (!check.shouldForceBuy) return false;

    final buyAvailable = line.isBuyEnabled && buyPrice > 0;
    final confirmed = await showRentExceedsBuyDialog(
      context,
      itemTitle: line.title,
      rentalTotal: check.rentalTotal,
      buyTotal: check.buyTotal,
      durationLabel: check.durationLabel,
      buyAvailable: buyAvailable,
    );
    if (!context.mounted) return true;
    if (confirmed == true && buyAvailable) {
      cart.updateOrderType(line.listingId, 'buy', productVariantId: line.productVariantId);
    }
    return true;
  }

  @override
  Widget build(BuildContext context) {
    final avail = cart.availableQuantityFor(line);
    final overStock = avail != null && line.quantity > avail;
    final canBuy = line.isBuyEnabled || line.buyPrice != null || line.orderType == 'buy';
    final unitRate = rateForUnit(
      line.rentalPeriodUnit,
      dailyRent: line.dailyRent,
      weeklyRent: line.weeklyRent,
      monthlyRent: line.monthlyRent,
    );
    final periodLabel = rentalUnitLabels[normalizeRentalUnit(line.rentalPeriodUnit)]!;

    return Container(
      padding: const EdgeInsets.all(14),
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
                width: 72,
                height: 72,
                clipBehavior: Clip.antiAlias,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  color: const Color(0xFF0F172A),
                ),
                child: CatalogImage(
                  url: line.primaryImageUrl,
                  width: 72,
                  height: 72,
                  fit: BoxFit.cover,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            line.title,
                            style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.delete_outline, color: Colors.redAccent, size: 22),
                          visualDensity: VisualDensity.compact,
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                          tooltip: 'Remove',
                          onPressed: () => cart.removeLine(line.listingId, productVariantId: line.productVariantId),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      line.orderType == 'buy'
                          ? 'Buy · ₹${(line.buyPrice ?? (line.dailyRent * 30)).toStringAsFixed(0)}'
                          : '₹${unitRate.toStringAsFixed(0)}${periodLabel.per} · ${formatRentalDuration(line.rentalDays, line.rentalPeriodUnit)} · deposit ₹${line.securityDeposit.toStringAsFixed(0)}',
                      style: const TextStyle(color: Colors.white54, fontSize: 12, height: 1.35),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '₹${line.lineTotal.toStringAsFixed(0)}',
                      style: const TextStyle(color: Color(0xFF6C63FF), fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                    if (line.prescriptionRequired) ...[
                      const SizedBox(height: 4),
                      const Text('Rx optional', style: TextStyle(color: Colors.amber, fontSize: 12, fontWeight: FontWeight.w600)),
                    ],
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Divider(color: Colors.white10, height: 1),
          const SizedBox(height: 12),
          if (canBuy)
            _SegmentedToggle(
              options: const [
                (value: 'rent', label: 'Rent'),
                (value: 'buy', label: 'Buy'),
              ],
              selected: line.orderType,
              onChanged: (v) {
                cart.updateOrderType(
                  line.listingId,
                  v,
                  productVariantId: line.productVariantId,
                );
              },
            )
          else
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFF6C63FF).withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFF6C63FF).withValues(alpha: 0.5)),
              ),
              alignment: Alignment.center,
              child: Text(
                line.orderType == 'buy' ? 'Buy only' : 'Rent only',
                style: const TextStyle(color: Color(0xFF6C63FF), fontWeight: FontWeight.w700, fontSize: 13),
              ),
            ),
          if (line.orderType == 'rent') ...[
            const SizedBox(height: 12),
            Text('Rental period', style: TextStyle(color: Colors.white.withValues(alpha: 0.55), fontSize: 12, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            _SegmentedToggle(
              options: rentalUnitsVisibleInUi
                  .map((u) => (value: u, label: rentalUnitLabels[u]!.plural))
                  .toList(),
              selected: rentalUnitsVisibleInUi.contains(line.rentalPeriodUnit)
                  ? line.rentalPeriodUnit
                  : defaultUiRentalUnit,
              onChanged: (v) async {
                final blocked = await _promptRentToBuy(context, nextUnit: v);
                if (blocked || !context.mounted) return;
                cart.updateRentalPeriodUnit(
                  line.listingId,
                  v,
                  productVariantId: line.productVariantId,
                );
              },
            ),
            const SizedBox(height: 4),
            _StepperRow(
              label: periodLabel.plural,
              value: line.rentalDays,
              min: 1,
              max: 366,
              onChanged: (val) async {
                final blocked = await _promptRentToBuy(context, nextPeriods: val);
                if (blocked || !context.mounted) return;
                cart.updateRentalDays(
                  line.listingId,
                  val,
                  productVariantId: line.productVariantId,
                );
              },
            ),
          ],
          _StepperRow(
            label: 'Quantity',
            value: line.quantity,
            min: 1,
            max: avail ?? 999,
            onChanged: (val) async {
              if (line.orderType == 'rent') {
                final blocked = await _promptRentToBuy(context, nextQty: val);
                if (blocked || !context.mounted) return;
              }
              cart.updateQuantity(
                line.listingId,
                val,
                productVariantId: line.productVariantId,
              );
            },
          ),
          if (overStock) ...[
            const SizedBox(height: 8),
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

class _SegmentedToggle extends StatelessWidget {
  final List<({String value, String label})> options;
  final String selected;
  final ValueChanged<String> onChanged;

  const _SegmentedToggle({
    required this.options,
    required this.selected,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (var i = 0; i < options.length; i++) ...[
          if (i > 0) const SizedBox(width: 8),
          Expanded(
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: selected == options[i].value ? null : () => onChanged(options[i].value),
                borderRadius: BorderRadius.circular(10),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(
                    color: selected == options[i].value
                        ? const Color(0xFF6C63FF).withValues(alpha: 0.22)
                        : const Color(0xFF0F172A),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: selected == options[i].value ? const Color(0xFF6C63FF) : Colors.white12,
                    ),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    options[i].label,
                    style: TextStyle(
                      color: selected == options[i].value ? const Color(0xFFA5B4FC) : Colors.white70,
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _StepperRow extends StatelessWidget {
  final String label;
  final int value;
  final int min;
  final int max;
  final ValueChanged<int> onChanged;

  const _StepperRow({
    required this.label,
    required this.value,
    required this.min,
    required this.max,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(color: Colors.white70, fontSize: 14, fontWeight: FontWeight.w600),
            ),
          ),
          Container(
            decoration: BoxDecoration(
              color: const Color(0xFF0F172A),
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: Colors.white10),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  icon: Icon(
                    Icons.remove_circle_outline,
                    size: 22,
                    color: value > min ? Colors.white70 : Colors.white24,
                  ),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
                  onPressed: value > min ? () => onChanged(value - 1) : null,
                ),
                SizedBox(
                  width: 28,
                  child: Text(
                    '$value',
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
                  ),
                ),
                IconButton(
                  icon: Icon(
                    Icons.add_circle_outline,
                    size: 22,
                    color: value < max ? Colors.white70 : Colors.white24,
                  ),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
                  onPressed: value < max ? () => onChanged(value + 1) : null,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
