import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/models/product_model.dart';
import '../../core/providers/favorite_provider.dart';
import '../../core/theme.dart';
import '../../core/utils/rental_period.dart';
import '../../core/utils/rental_plan_display.dart';
import '../utils/require_auth.dart';
import 'catalog_image.dart';
import 'favorite_overlay_button.dart';

/// Neutral plate behind every shop photo, light and dark. Same idea as the
/// Amazon / Flipkart thumbnail canvas: a colored photo stays inside this plate.
const Color kBrowseProductImageWell = Color(0xFFF5F5F5);

const double _kBrowseFooterPadTop = 9;
const double _kBrowseFooterPadBottom = 10;
const double _kBrowseTitlePriceGap = 6;
const double _kBrowsePriceDepositGap = 4;
const double _kBrowsePriceLineExtent = 17;
const double _kBrowseDepositLineExtent = 14;
const double _kBrowseFooterSlack = 4;

TextStyle browseProductTitleStyle(Color color) => TextStyle(
  fontWeight: FontWeight.w700,
  fontSize: 13,
  height: 1.25,
  color: color,
);

double browseTitleBlockHeight(
  String title,
  double cardWidth, {
  TextScaler textScaler = TextScaler.noScaling,
}) {
  final painter = TextPainter(
    text: TextSpan(text: title, style: browseProductTitleStyle(Colors.black)),
    maxLines: 2,
    textDirection: TextDirection.ltr,
    textScaler: textScaler,
    ellipsis: '…',
  )..layout(maxWidth: (cardWidth - 20).clamp(0, double.infinity));
  return painter.size.height;
}

/// Square image plus the lines this product actually shows.
double browseProductCardExtent(
  double cardWidth, {
  required String title,
  required bool includeDeposit,
  TextScaler textScaler = TextScaler.noScaling,
}) {
  final titleHeight = browseTitleBlockHeight(
    title,
    cardWidth,
    textScaler: textScaler,
  );
  var footer =
      _kBrowseFooterPadTop +
      titleHeight +
      _kBrowseTitlePriceGap +
      _kBrowsePriceLineExtent +
      _kBrowseFooterPadBottom +
      _kBrowseFooterSlack;
  if (includeDeposit) {
    footer += _kBrowsePriceDepositGap + _kBrowseDepositLineExtent;
  }
  return cardWidth + footer;
}

/// A pair of tiles shares one height: the taller name, and a deposit if either rental needs it.
double browseProductRowExtent(
  double cardWidth,
  ProductModel left,
  ProductModel? right, {
  TextScaler textScaler = TextScaler.noScaling,
}) {
  final leftHeight = browseProductCardExtent(
    cardWidth,
    title: left.title,
    includeDeposit: left.canRent,
    textScaler: textScaler,
  );
  if (right == null) return leftHeight;
  final rightHeight = browseProductCardExtent(
    cardWidth,
    title: right.title,
    includeDeposit: right.canRent,
    textScaler: textScaler,
  );
  return leftHeight > rightHeight ? leftHeight : rightHeight;
}

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
    final isOutOfStock =
        product.availableQuantity <= 0 ||
        product.availabilityStatus.trim().toLowerCase() == 'out_of_stock';
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
      primaryUnit =
          product.baseUnit != null && product.baseUnit!.trim().isNotEmpty
          ? ' / ${product.baseUnit}'
          : '';
    }

    // Mobile-tuned: deposit only on the card; buy price and plans live on the PDP.
    String? depositLine;
    if (showRent) {
      depositLine = product.depositRequired
          ? 'Deposit ${formatPlanInr(product.securityDeposit)}'
          : 'Rental plans available';
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
            AspectRatio(
              aspectRatio: 1,
              child: Stack(
                fit: StackFit.expand,
                clipBehavior: Clip.hardEdge,
                children: [
                  const ColoredBox(color: kBrowseProductImageWell),
                  CatalogImage(
                    url: product.primaryImageUrl,
                    fit: BoxFit.contain,
                  ),
                  if (showBadge)
                    Positioned(
                      top: 8,
                      left: 8,
                      child: Container(
                        constraints: const BoxConstraints(maxWidth: 112),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
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
                    top: 8,
                    right: 8,
                    child: Consumer<FavoriteProvider>(
                      builder: (context, favoriteProvider, _) {
                        final isFavorite = favoriteProvider.isFavorite(
                          product.id,
                        );
                        return FavoriteOverlayButton(
                          isFavorite: isFavorite,
                          onTap: () async {
                            final ok = await ensureAuthenticated(
                              context,
                              message: 'Sign in to save favorites.',
                            );
                            if (!ok || !context.mounted) return;
                            await favoriteProvider.toggleFavorite(product.id);
                          },
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
            Container(
              decoration: BoxDecoration(
                color: colors.surface,
                border: Border(top: BorderSide(color: colors.border)),
              ),
              padding: const EdgeInsets.fromLTRB(10, 9, 10, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    product.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: browseProductTitleStyle(colors.textPrimary),
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
                  if (depositLine != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      depositLine,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 11,
                        height: 1.2,
                        color: colors.textMuted,
                      ),
                    ),
                  ],
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

/// Two shop tiles in one row. The row is as tall as the taller tile.
class BrowseProductPair extends StatelessWidget {
  final ProductModel left;
  final ProductModel? right;
  final double cardWidth;
  final ValueChanged<ProductModel> onTap;
  final bool dimWhenInactive;
  final double bottomGap;

  const BrowseProductPair({
    super.key,
    required this.left,
    required this.right,
    required this.cardWidth,
    required this.onTap,
    this.dimWhenInactive = false,
    this.bottomGap = 14,
  });

  @override
  Widget build(BuildContext context) {
    final height = browseProductRowExtent(
      cardWidth,
      left,
      right,
      textScaler: MediaQuery.textScalerOf(context),
    );
    return Padding(
      padding: EdgeInsets.only(bottom: bottomGap),
      child: SizedBox(
        height: height,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: BrowseProductCard(
                product: left,
                dimWhenInactive: dimWhenInactive,
                onTap: () => onTap(left),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: right == null
                  ? const SizedBox.shrink()
                  : BrowseProductCard(
                      product: right!,
                      dimWhenInactive: dimWhenInactive,
                      onTap: () => onTap(right!),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
