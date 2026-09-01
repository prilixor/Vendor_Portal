import 'package:flutter/material.dart';

import '../../core/theme.dart';
import 'catalog_image.dart';

/// Vendor Web [ListingThumb] parity for product/inventory list rows.
class ListingThumb extends StatelessWidget {
  final String? url;
  final double size;
  final String? semanticsLabel;

  const ListingThumb({
    super.key,
    this.url,
    this.size = 48,
    this.semanticsLabel,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final radius = BorderRadius.circular(10);

    return Semantics(
      label: semanticsLabel ?? 'Product photo',
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          borderRadius: radius,
          border: Border.all(color: colors.border.withValues(alpha: 0.75)),
          color: colors.surfaceElevated,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: context.isDarkMode ? 0.2 : 0.05),
              blurRadius: 4,
              offset: const Offset(0, 1),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: CatalogImage(
          key: ValueKey(url ?? 'listing-thumb-empty'),
          url: url,
          fit: BoxFit.cover,
          width: size,
          height: size,
          borderRadius: radius,
        ),
      ),
    );
  }
}
