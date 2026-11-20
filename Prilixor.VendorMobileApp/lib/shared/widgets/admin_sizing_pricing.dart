import 'package:flutter/material.dart';

import '../../core/models/vendor_catalog_model.dart';
import '../../core/theme.dart';

/// Read-only Admin pack-size prices — same data as Vendor Web "Admin sizing & pricing".
class AdminSizingPricingBody extends StatelessWidget {
  final CatalogProduct? product;
  final Map<String, double> vendorPayoutByVariantId;
  final bool showPayoutSummary;

  const AdminSizingPricingBody({
    super.key,
    required this.product,
    this.vendorPayoutByVariantId = const {},
    this.showPayoutSummary = true,
  });

  static String money(num value) => '₹${value.round()}';

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final catalog = product;
    if (catalog == null) {
      return Text(
        'Catalog pricing is unavailable for this listing.',
        style: TextStyle(color: colors.textMuted, fontSize: 13, height: 1.35),
      );
    }

    final variants = catalog.variants;
    final summary = showPayoutSummary
        ? VendorPayoutSummary(
            dailyRate: catalog.vendorDailyRent,
            securityDeposit: payoutSecurityDeposit(
              vendorSecurityDeposit: catalog.vendorSecurityDeposit,
              securityDeposit: catalog.securityDeposit,
            ),
            buyPrice: catalog.vendorBuyPrice,
            gstPercent: catalog.gstPercent,
          )
        : const SizedBox.shrink();
    if (variants.isEmpty) {
      final customerBuy = catalog.buyPrice;
      final vendorBuy = catalog.vendorBuyPrice;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          summary,
          Visibility(
            visible: showCustomerPricing,
            child: Text(
              customerBuy != null && customerBuy > 0
                  ? 'Buy price ${money(customerBuy)} · no packaging sizes yet'
                  : 'No packaging sizes defined. Ask Admin to add variants first.',
              style: TextStyle(color: colors.textMuted, fontSize: 13, height: 1.35),
            ),
          ),
          Visibility(
            visible: !showCustomerPricing,
            child: Text(
              vendorBuy != null && vendorBuy > 0
                  ? 'Buy price ${money(vendorBuy)} · no packaging sizes yet'
                  : 'No packaging sizes defined. Ask Admin to add variants first.',
              style: TextStyle(color: colors.textMuted, fontSize: 13, height: 1.35),
            ),
          ),
        ],
      );
    }

    return Column(
      children: [
        summary,
        for (var i = 0; i < variants.length; i++) ...[
          if (i > 0) Divider(height: 1, color: colors.border.withValues(alpha: 0.85)),
          _VariantPriceRow(
            variant: variants[i],
            vendorPayout: vendorPayoutByVariantId[variants[i].id],
          ),
        ],
      ],
    );
  }
}

class _VariantPriceRow extends StatelessWidget {
  final ProductVariant variant;
  final double? vendorPayout;

  const _VariantPriceRow({required this.variant, this.vendorPayout});

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final payoutColor = colors.success;

    return Opacity(
      opacity: variant.isActive ? 1 : 0.5,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    variant.label,
                    style: TextStyle(
                      color: colors.textPrimary,
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                    ),
                  ),
                  if (variant.sku.trim().isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      variant.sku,
                      style: TextStyle(
                        color: colors.textMuted,
                        fontSize: 11,
                        fontFamily: 'monospace',
                      ),
                    ),
                  ],
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Visibility(
                  visible: showCustomerPricing,
                  child: Text.rich(
                    TextSpan(
                      text: 'Customer ',
                      style: TextStyle(color: colors.textMuted, fontSize: 12),
                      children: [
                        TextSpan(
                          text: AdminSizingPricingBody.money(variant.buyPrice),
                          style: TextStyle(
                            color: colors.textPrimary,
                            fontWeight: FontWeight.w700,
                            fontFamily: 'monospace',
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                if (showCustomerPricing) const SizedBox(height: 2),
                Text.rich(
                  TextSpan(
                    text: 'Payout ',
                    style: TextStyle(color: colors.textMuted, fontSize: 12),
                    children: [
                      TextSpan(
                        text: AdminSizingPricingBody.money(vendorPayout ?? variant.vendorPrice),
                        style: TextStyle(
                          color: payoutColor,
                          fontWeight: FontWeight.w800,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class VendorPayoutSummary extends StatelessWidget {
  final double dailyRate;
  final double securityDeposit;
  final double? buyPrice;
  final double? gstPercent;

  const VendorPayoutSummary({
    super.key,
    required this.dailyRate,
    required this.securityDeposit,
    this.buyPrice,
    this.gstPercent,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final rows = <MapEntry<String, String>>[
      MapEntry('Daily rate', AdminSizingPricingBody.money(dailyRate)),
      MapEntry('Security deposit', AdminSizingPricingBody.money(securityDeposit)),
      MapEntry(
        'Buy price',
        buyPrice != null && buyPrice! > 0 ? AdminSizingPricingBody.money(buyPrice!) : '—',
      ),
      if (showVendorGst)
        MapEntry('GST', gstPercent == null ? '—' : '${gstPercent!.toStringAsFixed(0)}%'),
    ];
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        children: [
          for (final row in rows)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  Expanded(
                    child: Text(row.key, style: TextStyle(color: colors.textMuted, fontSize: 12)),
                  ),
                  Text(
                    row.value,
                    style: TextStyle(
                      color: colors.textPrimary,
                      fontWeight: FontWeight.w800,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
