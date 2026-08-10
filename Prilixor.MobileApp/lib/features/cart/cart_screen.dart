import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/models/cart_model.dart';
import '../../core/providers/cart_provider.dart';
import '../../core/utils/rental_period.dart';
import '../../core/utils/rental_plan_display.dart';
import '../../shared/utils/require_auth.dart';
import '../../shared/widgets/catalog_image.dart';
import '../../shared/widgets/rent_exceeds_buy_dialog.dart';
import '../../shared/widgets/struck_price.dart';
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

    final itemCount = cart.itemCount;

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        centerTitle: true,
        title: Text(
          itemCount > 0 ? 'My Cart ($itemCount)' : 'My Cart',
          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 20),
        ),
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
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    decoration: BoxDecoration(
                      color: const Color(0xFF3B82F6).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFF3B82F6).withValues(alpha: 0.35)),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.medical_information_outlined, color: Color(0xFF60A5FA), size: 18),
                        SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Optional doctor Unique ID available at checkout.',
                            style: TextStyle(color: Color(0xFF93C5FD), fontSize: 12),
                          ),
                        ),
                      ],
                    ),
                  ),
                if (cart.isRefreshingStock)
                  const LinearProgressIndicator(minHeight: 2, color: Color(0xFF6C63FF), backgroundColor: Colors.transparent),
                Expanded(
                  child: Builder(
                    builder: (context) {
                      final equipment = cart.lines.where((l) => !l.isChemical).toList();
                      final chemicals = cart.lines.where((l) => l.isChemical).toList();
                      return ListView(
                        // Extra bottom pad so last card clears the sticky checkout bar.
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                        children: [
                          if (equipment.isNotEmpty) ...[
                            _sectionHeader(
                              'Equipment',
                              '${equipment.length} ${equipment.length == 1 ? 'item' : 'items'}',
                            ),
                            for (var i = 0; i < equipment.length; i++) ...[
                              if (i > 0) const SizedBox(height: 10),
                              _CartLineCard(line: equipment[i], cart: cart),
                            ],
                          ],
                          if (chemicals.isNotEmpty) ...[
                            if (equipment.isNotEmpty) const SizedBox(height: 16),
                            _sectionHeader(
                              'Chemicals',
                              '${chemicals.length} ${chemicals.length == 1 ? 'item' : 'items'} · buy only',
                            ),
                            for (var i = 0; i < chemicals.length; i++) ...[
                              if (i > 0) const SizedBox(height: 10),
                              _ChemicalCartLineCard(line: chemicals[i], cart: cart),
                            ],
                          ],
                        ],
                      );
                    },
                  ),
                ),
                // Web-style compact sticky checkout — leaves room to scroll many items.
                _StickyCheckoutBar(
                  total: cart.totalEstimatedRent,
                  deposit: cart.totalDeposit,
                  checkoutLabel: checkoutLabel,
                  hasStockIssues: cart.hasStockIssues,
                  onCheckout: () async {
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
                ),
              ],
            ),
    );
  }

  Widget _sectionHeader(String title, String meta) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Text(
            title,
            style: const TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w700),
          ),
          const Spacer(),
          Text(
            meta,
            style: TextStyle(color: Colors.white.withValues(alpha: 0.45), fontSize: 11, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}

class _StickyCheckoutBar extends StatelessWidget {
  final double total;
  final double deposit;
  final String checkoutLabel;
  final bool hasStockIssues;
  final Future<void> Function() onCheckout;

  const _StickyCheckoutBar({
    required this.total,
    required this.deposit,
    required this.checkoutLabel,
    required this.hasStockIssues,
    required this.onCheckout,
  });

  void _showSummary(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: const Color(0xFF1E293B),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.white24,
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Order summary',
                  style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 14),
                _sheetRow('Subtotal', formatPlanInr(total)),
                const SizedBox(height: 8),
                _sheetRow('Refundable deposit', formatPlanInr(deposit)),
                const SizedBox(height: 4),
                Text(
                  'Deposit collected at delivery',
                  style: TextStyle(color: Colors.white.withValues(alpha: 0.45), fontSize: 11),
                ),
                const Divider(color: Colors.white12, height: 24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Estimated total', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                    Text(
                      formatPlanInr(total),
                      style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _sheetRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(color: Colors.white70, fontSize: 14)),
        Text(value, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600)),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFF1E293B),
      elevation: 12,
      shadowColor: Colors.black54,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (hasStockIssues)
                const Padding(
                  padding: EdgeInsets.only(bottom: 8),
                  child: Text(
                    'Fix stock issues above before checkout.',
                    style: TextStyle(color: Colors.redAccent, fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                ),
              Row(
                children: [
                  Expanded(
                    child: InkWell(
                      onTap: () => _showSummary(context),
                      borderRadius: BorderRadius.circular(10),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 2, horizontal: 2),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(
                                  'ESTIMATED TOTAL',
                                  style: TextStyle(
                                    color: Colors.white.withValues(alpha: 0.5),
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 0.6,
                                  ),
                                ),
                                const SizedBox(width: 4),
                                Icon(Icons.info_outline, size: 14, color: Colors.white.withValues(alpha: 0.45)),
                              ],
                            ),
                            const SizedBox(height: 2),
                            Text(
                              formatPlanInr(total),
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 20,
                                fontWeight: FontWeight.w800,
                                height: 1.1,
                              ),
                            ),
                            if (deposit > 0)
                              Text(
                                'Deposit ${formatPlanInr(deposit)}',
                                style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.45),
                                  fontSize: 11,
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  SizedBox(
                    height: 48,
                    child: ElevatedButton(
                      onPressed: hasStockIssues ? null : onCheckout,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF6C63FF),
                        disabledBackgroundColor: Colors.white12,
                        padding: const EdgeInsets.symmetric(horizontal: 18),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        elevation: 0,
                      ),
                      child: Text(
                        checkoutLabel.length > 18 ? 'Checkout' : checkoutLabel,
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ChemicalCartLineCard extends StatelessWidget {
  final CartLineModel line;
  final CartProvider cart;

  const _ChemicalCartLineCard({required this.line, required this.cart});

  @override
  Widget build(BuildContext context) {
    final avail = cart.availableQuantityFor(line);
    final overStock = avail != null && line.quantity > avail;
    final unitPrice = line.buyPrice ?? 0;

    return Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 8, 10),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: overStock ? Colors.redAccent.withValues(alpha: 0.5) : Colors.white10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 56,
                height: 56,
                clipBehavior: Clip.antiAlias,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10),
                  color: const Color(0xFF0F172A),
                ),
                child: CatalogImage(
                  url: line.primaryImageUrl,
                  width: 56,
                  height: 56,
                  fit: BoxFit.cover,
                ),
              ),
              const SizedBox(width: 10),
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
                            style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w700, height: 1.25),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.delete_outline, color: Colors.redAccent, size: 20),
                          visualDensity: VisualDensity.compact,
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                          tooltip: 'Remove',
                          onPressed: () => cart.removeLine(line.listingId, productVariantId: line.productVariantId),
                        ),
                      ],
                    ),
                    Text(
                      '${formatPlanInr(unitPrice)} each · Purchase',
                      style: const TextStyle(color: Colors.white54, fontSize: 11.5, height: 1.3),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      formatPlanInr(unitPrice * line.quantity),
                      style: const TextStyle(color: Color(0xFF6C63FF), fontSize: 15, fontWeight: FontWeight.w800),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                decoration: BoxDecoration(
                  color: const Color(0xFF6C63FF).withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFF6C63FF).withValues(alpha: 0.45)),
                ),
                child: const Text(
                  'Buy only',
                  style: TextStyle(color: Color(0xFF6C63FF), fontWeight: FontWeight.w700, fontSize: 12),
                ),
              ),
              const Spacer(),
              _CompactQtyStepper(
                value: line.quantity,
                min: 1,
                max: avail ?? 999,
                onChanged: (val) {
                  cart.updateQuantity(
                    line.listingId,
                    val,
                    productVariantId: line.productVariantId,
                  );
                },
              ),
            ],
          ),
          if (overStock) ...[
            const SizedBox(height: 8),
            Text(
              'Only $avail available — reduce quantity.',
              style: const TextStyle(color: Colors.redAccent, fontSize: 11.5, fontWeight: FontWeight.w600),
            ),
          ],
        ],
      ),
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
    if (!line.canBuy || buyPrice <= 0 || line.orderType != 'rent') return false;
    final check = evaluateRentVsBuy(
      buyPrice: buyPrice,
      isBuyEnabled: line.canBuy,
      quantity: nextQty ?? line.quantity,
      periods: line.usesPricingPlan
          ? (line.rentalDurationDays ?? line.rentalDays)
          : (nextPeriods ?? line.rentalDays),
      unit: line.usesPricingPlan ? rentalUnitDay : (nextUnit ?? line.rentalPeriodUnit),
      dailyRent: line.dailyRent,
      weeklyRent: line.weeklyRent,
      monthlyRent: line.monthlyRent,
      planFinalPrice: line.usesPricingPlan ? line.rentalFinalPrice : null,
      planDurationLabel: line.usesPricingPlan ? line.rentalDurationLabel : null,
    );
    if (!check.shouldForceBuy) return false;

    final buyAvailable = line.canBuy && buyPrice > 0;
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
    final canRent = line.canRent;
    final canBuy = line.canBuy;
    final actualOrderType = canRent && canBuy
        ? line.orderType
        : (canBuy ? 'buy' : 'rent');
    final unitRate = rateForUnit(
      line.rentalPeriodUnit,
      dailyRent: line.dailyRent,
      weeklyRent: line.weeklyRent,
      monthlyRent: line.monthlyRent,
    );
    final periodLabel = rentalUnitLabels[normalizeRentalUnit(line.rentalPeriodUnit)]!;

    final planLabel = dayPlanTitle(
      line.rentalDurationDays ?? line.rentalDays,
      line.rentalDurationLabel,
    );

    return Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 8, 10),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: overStock ? Colors.redAccent.withValues(alpha: 0.5) : Colors.white10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 56,
                height: 56,
                clipBehavior: Clip.antiAlias,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10),
                  color: const Color(0xFF0F172A),
                ),
                child: CatalogImage(
                  url: line.primaryImageUrl,
                  width: 56,
                  height: 56,
                  fit: BoxFit.cover,
                ),
              ),
              const SizedBox(width: 10),
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
                            style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w700, height: 1.25),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.delete_outline, color: Colors.redAccent, size: 20),
                          visualDensity: VisualDensity.compact,
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                          tooltip: 'Remove',
                          onPressed: () => cart.removeLine(line.listingId, productVariantId: line.productVariantId),
                        ),
                      ],
                    ),
                    if (actualOrderType == 'buy')
                      Text(
                        'Buy · ${formatPlanInr(line.buyPrice ?? (line.dailyRent * 30))}',
                        style: const TextStyle(color: Colors.white54, fontSize: 11.5, height: 1.3),
                      )
                    else if (line.usesPricingPlan) ...[
                      Text(
                        planLabel,
                        style: const TextStyle(color: Colors.white70, fontSize: 11.5, fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 2),
                      Wrap(
                        crossAxisAlignment: WrapCrossAlignment.center,
                        spacing: 6,
                        children: [
                          if (line.rentalNormalPrice != null &&
                              line.rentalNormalPrice! > (line.rentalFinalPrice ?? 0))
                            StruckPrice(
                              formatPlanInr(line.rentalNormalPrice!),
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
                            ),
                          Text(
                            formatPlanInr(line.rentalFinalPrice ?? 0),
                            style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w800),
                          ),
                          Text(
                            'Dep ${formatPlanInr(line.securityDeposit)}',
                            style: const TextStyle(color: Colors.white54, fontSize: 11),
                          ),
                        ],
                      ),
                    ]
                    else
                      Text(
                        '₹${unitRate.toStringAsFixed(0)}${periodLabel.per} · ${formatRentalDuration(line.rentalDays, line.rentalPeriodUnit)}',
                        style: const TextStyle(color: Colors.white54, fontSize: 11.5, height: 1.3),
                      ),
                    const SizedBox(height: 4),
                    Text(
                      formatPlanInr(line.lineTotal),
                      style: const TextStyle(color: Color(0xFF6C63FF), fontSize: 15, fontWeight: FontWeight.w800),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              if (canRent && canBuy)
                Expanded(
                  child: _SegmentedToggle(
                    dense: true,
                    options: const [
                      (value: 'rent', label: 'Rent'),
                      (value: 'buy', label: 'Buy'),
                    ],
                    selected: line.orderType,
                    onChanged: (v) async {
                      if (v == 'rent') {
                        final blocked = await _promptRentToBuy(context);
                        if (blocked || !context.mounted) return;
                      }
                      cart.updateOrderType(
                        line.listingId,
                        v,
                        productVariantId: line.productVariantId,
                      );
                    },
                  ),
                )
              else
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                  decoration: BoxDecoration(
                    color: const Color(0xFF6C63FF).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFF6C63FF).withValues(alpha: 0.45)),
                  ),
                  child: Text(
                    canRent ? 'Rent only' : 'Buy only',
                    style: const TextStyle(color: Color(0xFF6C63FF), fontWeight: FontWeight.w700, fontSize: 12),
                  ),
                ),
              const SizedBox(width: 10),
              _CompactQtyStepper(
                value: line.quantity,
                min: 1,
                max: avail ?? 999,
                onChanged: (val) async {
                  if (actualOrderType == 'rent') {
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
            ],
          ),
          if (overStock) ...[
            const SizedBox(height: 8),
            Text(
              'Only $avail available — reduce quantity.',
              style: const TextStyle(color: Colors.redAccent, fontSize: 11.5, fontWeight: FontWeight.w600),
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
  final bool dense;

  const _SegmentedToggle({
    required this.options,
    required this.selected,
    required this.onChanged,
    this.dense = false,
  });

  @override
  Widget build(BuildContext context) {
    final vPad = dense ? 7.0 : 10.0;
    final fontSize = dense ? 12.0 : 13.0;
    final gap = dense ? 6.0 : 8.0;
    final radius = dense ? 8.0 : 10.0;
    return Row(
      children: [
        for (var i = 0; i < options.length; i++) ...[
          if (i > 0) SizedBox(width: gap),
          Expanded(
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: selected == options[i].value ? null : () => onChanged(options[i].value),
                borderRadius: BorderRadius.circular(radius),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  padding: EdgeInsets.symmetric(vertical: vPad),
                  decoration: BoxDecoration(
                    color: selected == options[i].value
                        ? const Color(0xFF6C63FF).withValues(alpha: 0.22)
                        : const Color(0xFF0F172A),
                    borderRadius: BorderRadius.circular(radius),
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
                      fontSize: fontSize,
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

class _CompactQtyStepper extends StatelessWidget {
  final int value;
  final int min;
  final int max;
  final ValueChanged<int> onChanged;

  const _CompactQtyStepper({
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
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            icon: Icon(
              Icons.remove,
              size: 18,
              color: value > min ? Colors.white70 : Colors.white24,
            ),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 34, minHeight: 34),
            onPressed: value > min ? () => onChanged(value - 1) : null,
          ),
          SizedBox(
            width: 24,
            child: Text(
              '$value',
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
            ),
          ),
          IconButton(
            icon: Icon(
              Icons.add,
              size: 18,
              color: value < max ? Colors.white70 : Colors.white24,
            ),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 34, minHeight: 34),
            onPressed: value < max ? () => onChanged(value + 1) : null,
          ),
        ],
      ),
    );
  }
}
