import 'package:flutter/material.dart';

import '../../core/theme.dart';

/// Wishlist control on product imagery — frosted chip matching Customer Web browse cards.
class FavoriteOverlayButton extends StatelessWidget {
  static const Color _favoriteRed = Color(0xFFEF4444);

  final bool isFavorite;
  final VoidCallback onTap;
  final double size;

  const FavoriteOverlayButton({
    super.key,
    required this.isFavorite,
    required this.onTap,
    this.size = 34,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final isDark = context.isDarkMode;

    final background = isDark
        ? colors.surface.withValues(alpha: 0.9)
        : colors.surface.withValues(alpha: 0.96);
    final borderColor = colors.border.withValues(alpha: isDark ? 0.55 : 0.65);
    final iconColor = isFavorite
        ? _favoriteRed
        : (isDark ? colors.textSecondary : colors.textMuted);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: Ink(
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: background,
            border: Border.all(color: borderColor),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: isDark ? 0.28 : 0.08),
                blurRadius: isDark ? 6 : 4,
                offset: const Offset(0, 1),
              ),
            ],
          ),
          child: Icon(
            isFavorite ? Icons.favorite_rounded : Icons.favorite_border_rounded,
            size: 16,
            color: iconColor,
          ),
        ),
      ),
    );
  }
}
