import 'package:flutter/material.dart';

import '../../core/models/vendor_catalog_model.dart';
import '../../core/theme.dart';

/// Read-only Admin pack-size prices — same data as Vendor Web "Admin sizing & pricing".
class AdminSizingPricingBody extends StatelessWidget {
  final CatalogProduct? product;

  const AdminSizingPricingBody({super.key, required this.product});

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
    if (variants.isEmpty) {
      final buy = catalog.buyPrice;
      return Text(
        buy != null && buy > 0
            ? 'Buy price ${money(buy)} · no packaging sizes yet'
            : 'No packaging sizes defined. Ask Admin to add variants first.',
        style: TextStyle(color: colors.textMuted, fontSize: 13, height: 1.35),
      );
    }

    return Column(
      children: [
        for (var i = 0; i < variants.length; i++) ...[
          if (i > 0) Divider(height: 1, color: colors.border.withValues(alpha: 0.85)),
          _VariantPriceRow(variant: variants[i]),
        ],
      ],
    );
  }
}

class _VariantPriceRow extends StatelessWidget {
  final ProductVariant variant;

  const _VariantPriceRow({required this.variant});

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final payoutColor =
        context.isDarkMode ? const Color(0xFF34D399) : const Color(0xFF047857);

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
                Text.rich(
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
                const SizedBox(height: 2),
                Text.rich(
                  TextSpan(
                    text: 'Payout ',
                    style: TextStyle(color: colors.textMuted, fontSize: 12),
                    children: [
                      TextSpan(
                        text: AdminSizingPricingBody.money(variant.vendorPrice),
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
