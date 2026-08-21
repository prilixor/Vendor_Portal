import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/models/product_model.dart';
import '../../core/providers/favorite_provider.dart';
import '../../core/theme.dart';
import '../../core/utils/rental_period.dart';
import '../../core/utils/rental_plan_display.dart';
import '../utils/require_auth.dart';
import 'catalog_image.dart';

/// Grid cell height for Discover / related product cards (2-col mobile).
const double kBrowseProductCardExtent = 304;

/// Mobile browse card — web pricing hierarchy, tuned for narrow 2-col grids.
class BrowseProductCard extends StatelessWidget {
  final ProductModel product;
  final VoidCallback? onTap;
  final bool dimWhenInactive;

  const BrowseProductCard({
    super.key,
    required this.product,
    this.onTap,
    this.dimWhenInactive = false,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final ls = product.listingStatus.trim().toLowerCase();
    final isBrowsable = ls == 'active' || ls == 'approved';
    final isOutOfStock = product.availableQuantity <= 0 || product.availabilityStatus.trim().toLowerCase() == 'out_of_stock';
    final interactive = isBrowsable && !isOutOfStock && onTap != null;
    final badge = product.getAvailabilityBadge();
    final showBadge = badge != null && badge['label'] != 'Available';
    final showRent = product.canRent;
    final showBuy = product.canBuy;

    final rate = showRent
        ? primaryDisplayRate(
            dailyRent: product.dailyRent,
            weeklyRent: product.weeklyRent,
            monthlyRent: product.monthlyRent,
          )
        : null;

    String? primaryValue;
    String? primaryUnit;
    if (showRent && rate != null) {
      primaryValue = formatPlanInr(rate.value);
      primaryUnit = rate.unit == rentalUnitMonth ? '/month' : '/day';
    } else if (showBuy && (product.buyPrice ?? 0) > 0) {
      primaryValue = formatPlanInr(product.buyPrice!);
      primaryUnit = product.baseUnit != null && product.baseUnit!.trim().isNotEmpty
          ? ' / ${product.baseUnit}'
          : '';
    }

    // Mobile-tuned: deposit only on the card; plans live on the PDP (tap).
    String? depositLine;
    if (showRent) {
      depositLine = product.depositRequired
          ? 'Deposit ${formatPlanInr(product.securityDeposit)}'
          : 'Rental plans available';
    }

    String? buyLine;
    if (showBuy && showRent && (product.buyPrice ?? 0) > 0) {
      final max = product.maxBuyPrice;
      final range = max != null && max > product.buyPrice!
          ? ' – ${formatPlanInr(max)}'
          : '';
      buyLine = 'Also buy for ${formatPlanInr(product.buyPrice!)}$range';
    } else if (showBuy &&
        !showRent &&
        (product.buyPrice ?? 0) > 0 &&
        product.maxBuyPrice != null &&
        product.maxBuyPrice! > product.buyPrice!) {
      buyLine = 'Up to ${formatPlanInr(product.maxBuyPrice!)}';
    }

    final card = Material(
      color: colors.surface,
      borderRadius: BorderRadius.circular(16),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: interactive ? onTap : null,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: Stack(
                fit: StackFit.expand,
                children: [
                  ColoredBox(color: colors.surfaceElevated),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(10, 34, 10, 6),
                    child: CatalogImage(url: product.primaryImageUrl, fit: BoxFit.contain),
                  ),
                  if (showBadge)
                    Positioned(
                      top: 8,
                      left: 8,
                      child: Container(
                        constraints: const BoxConstraints(maxWidth: 112),
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Color(badge['color'] as int),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          badge['label'] as String,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            height: 1.1,
                          ),
                        ),
                      ),
                    ),
                  Positioned(
                    top: 6,
                    right: 6,
                    child: Consumer<FavoriteProvider>(
                      builder: (context, favoriteProvider, _) {
                        final isFavorite = favoriteProvider.isFavorite(product.id);
                        return Material(
                          color: Colors.black.withValues(alpha: 0.5),
                          shape: const CircleBorder(),
                          child: InkWell(
                            customBorder: const CircleBorder(),
                            onTap: () async {
                              final ok = await ensureAuthenticated(
                                context,
                                message: 'Sign in to save favorites.',
                              );
                              if (!ok || !context.mounted) return;
                              await favoriteProvider.toggleFavorite(product.id);
                            },
                            child: SizedBox(
                              width: 32,
                              height: 32,
                              child: Icon(
                                isFavorite ? Icons.favorite : Icons.favorite_border,
                                color: isFavorite ? const Color(0xFFFF5A5F) : Colors.white,
                                size: 17,
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
            Container(
              decoration: BoxDecoration(
                border: Border(
                  top: BorderSide(color: colors.border),
                ),
              ),
              padding: const EdgeInsets.fromLTRB(10, 9, 10, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    height: 34,
                    child: Align(
                      alignment: Alignment.topLeft,
                      child: Text(
                        product.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                          height: 1.25,
                          color: colors.textPrimary,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),
                  if (primaryValue != null)
                    Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(
                            text: primaryValue,
                            style: TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 16,
                              letterSpacing: -0.2,
                              color: colors.textPrimary,
                              height: 1.05,
                            ),
                          ),
                          if (primaryUnit != null && primaryUnit.isNotEmpty)
                            TextSpan(
                              text: ' $primaryUnit',
                              style: TextStyle(
                                fontWeight: FontWeight.w500,
                                fontSize: 11,
                                color: colors.textMuted,
                                height: 1.05,
                              ),
                            ),
                        ],
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    )
                  else
                    const SizedBox(height: 17),
                  const SizedBox(height: 4),
                  if (depositLine != null)
                    Text(
                      depositLine,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 11,
                        height: 1.2,
                        color: colors.textMuted,
                      ),
                    )
                  else
                    const SizedBox(height: 13),
                  const SizedBox(height: 3),
                  if (buyLine != null)
                    Text(
                      buyLine,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 11,
                        height: 1.2,
                        fontWeight: FontWeight.w600,
                        color: context.isDarkMode ? const Color(0xFF34D399) : const Color(0xFF15803D),
                      ),
                    )
                  else
                    const SizedBox(height: 13),
                ],
              ),
            ),
          ],
        ),
      ),
    );

    if (!isBrowsable || isOutOfStock) {
      return Opacity(opacity: 0.55, child: card);
    }
    return card;
  }
}
