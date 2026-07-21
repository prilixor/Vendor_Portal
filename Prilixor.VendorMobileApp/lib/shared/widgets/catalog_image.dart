import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';

import '../../core/utils/media_url.dart';

/// Catalog product image with empty/error placeholders.
/// On web, prefers HTML &lt;img&gt; so cross-origin images render without CORS decode failures.
class CatalogImage extends StatelessWidget {
  final String? url;
  final BoxFit fit;
  final double? width;
  final double? height;
  final BorderRadius? borderRadius;

  const CatalogImage({
    super.key,
    required this.url,
    this.fit = BoxFit.cover,
    this.width,
    this.height,
    this.borderRadius,
  });

  @override
  Widget build(BuildContext context) {
    final resolved = resolveMediaUrl(url);
    final child = resolved == null
        ? const _CatalogImagePlaceholder(message: 'Image will be updated soon')
        : Image.network(
            resolved,
            width: width,
            height: height,
            fit: fit,
            webHtmlElementStrategy:
                kIsWeb ? WebHtmlElementStrategy.prefer : WebHtmlElementStrategy.never,
            errorBuilder: (_, _, _) =>
                const _CatalogImagePlaceholder(message: 'Image currently unavailable'),
            loadingBuilder: (context, child, progress) {
              if (progress == null) return child;
              return Container(
                width: width,
                height: height,
                color: const Color(0xFF334155),
                alignment: Alignment.center,
                child: const SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Color(0xFF6C63FF),
                  ),
                ),
              );
            },
          );

    if (borderRadius != null) {
      return ClipRRect(borderRadius: borderRadius!, child: child);
    }
    return child;
  }
}

class _CatalogImagePlaceholder extends StatelessWidget {
  final String message;

  const _CatalogImagePlaceholder({required this.message});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final h = constraints.maxHeight;
        final w = constraints.maxWidth;
        final iconOnly = !h.isFinite || !w.isFinite || h < 96 || w < 96;
        final tight = h < 130;

        return Container(
          width: double.infinity,
          height: double.infinity,
          color: const Color(0xFF334155),
          alignment: Alignment.center,
          padding: EdgeInsets.symmetric(
            horizontal: tight ? 6 : 10,
            vertical: tight ? 4 : 8,
          ),
          child: iconOnly
              ? Icon(
                  Icons.image_not_supported_outlined,
                  color: Colors.white.withValues(alpha: 0.35),
                  size: h.isFinite ? (h * 0.28).clamp(18.0, 28.0) : 22,
                )
              : FittedBox(
                  fit: BoxFit.scaleDown,
                  child: ConstrainedBox(
                    constraints: BoxConstraints(maxWidth: w.isFinite ? w : 160),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.image_not_supported_outlined,
                          color: Colors.white.withValues(alpha: 0.35),
                          size: tight ? 22 : 28,
                        ),
                        SizedBox(height: tight ? 4 : 8),
                        Text(
                          'No product image',
                          textAlign: TextAlign.center,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.7),
                            fontSize: tight ? 10 : 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          message,
                          textAlign: TextAlign.center,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.45),
                            fontSize: tight ? 9 : 10,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
        );
      },
    );
  }
}
