import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';

import '../../core/theme.dart';
import '../../core/utils/media_url.dart';

/// Catalog product image with React-like empty/error placeholders.
/// Fixes Flutter web relative `/api/...` URLs and prefers HTML <img> on web
/// so S3/presigned images render without CORS decode failures.
class CatalogImage extends StatelessWidget {
  final String? url;
  final String? fallbackUrl;
  final BoxFit fit;
  final double? width;
  final double? height;
  final BorderRadius? borderRadius;
  final bool showLoadingIndicator;

  const CatalogImage({
    super.key,
    required this.url,
    this.fallbackUrl,
    this.fit = BoxFit.cover,
    this.width,
    this.height,
    this.borderRadius,
    this.showLoadingIndicator = true,
  });

  @override
  Widget build(BuildContext context) {
    final resolved = resolveMediaUrl(url);
    final resolvedFallback = resolveMediaUrl(fallbackUrl);
    final placeholder = _CatalogImagePlaceholder(
      message: resolved == null ? 'Image will be updated soon' : 'Image currently unavailable',
      borderRadius: borderRadius,
    );
    final quietLoad = !showLoadingIndicator ||
        ((width ?? double.infinity) <= 48 && (height ?? double.infinity) <= 48);
    final child = resolved == null
        ? placeholder
        : _CatalogNetworkImage(
            url: resolved,
            fallbackUrl: resolvedFallback,
            width: width,
            height: height,
            fit: fit,
            errorChild: placeholder,
            showLoadingIndicator: !quietLoad,
          );

    if (borderRadius != null) {
      return ClipRRect(borderRadius: borderRadius!, child: child);
    }
    return child;
  }
}

/// Loads a catalog URL, then the non-thumb original on 404.
/// On web we keep the HTML <img> mounted (no spinner swap) so Flutter does not
/// paint a disposed EngineFlutterView after failed loads or hot restart.
class _CatalogNetworkImage extends StatefulWidget {
  final String url;
  final String? fallbackUrl;
  final double? width;
  final double? height;
  final BoxFit fit;
  final Widget errorChild;
  final bool showLoadingIndicator;

  const _CatalogNetworkImage({
    required this.url,
    this.fallbackUrl,
    required this.width,
    required this.height,
    required this.fit,
    required this.errorChild,
    required this.showLoadingIndicator,
  });

  @override
  State<_CatalogNetworkImage> createState() => _CatalogNetworkImageState();
}

class _CatalogNetworkImageState extends State<_CatalogNetworkImage> {
  late String _url;
  var _triedOriginal = false;
  var _fallbackQueued = false;

  @override
  void initState() {
    super.initState();
    _url = widget.url;
  }

  @override
  void didUpdateWidget(covariant _CatalogNetworkImage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.url != widget.url || oldWidget.fallbackUrl != widget.fallbackUrl) {
      _url = widget.url;
      _triedOriginal = false;
      _fallbackQueued = false;
    }
  }

  String? _fallbackCandidate() {
    final stored = widget.fallbackUrl?.trim();
    if (stored != null && stored.isNotEmpty && stored != _url) return stored;
    return originalUrlFromThumb(_url);
  }

  void _queueOriginalFallback() {
    if (_triedOriginal || _fallbackQueued) return;
    final original = _fallbackCandidate();
    if (original == null || original == _url) return;
    _fallbackQueued = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      setState(() {
        _triedOriginal = true;
        _fallbackQueued = false;
        _url = original;
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    final dpr = MediaQuery.maybeOf(context)?.devicePixelRatio ?? 2;
    final decodeW = !kIsWeb && widget.width != null && widget.width! <= 64
        ? (widget.width! * dpr).round().clamp(32, 256).toInt()
        : null;
    return Image.network(
      _url,
      key: ValueKey(_url),
      width: widget.width,
      height: widget.height,
      cacheWidth: decodeW,
      fit: widget.fit,
      gaplessPlayback: true,
      webHtmlElementStrategy: kIsWeb ? WebHtmlElementStrategy.prefer : WebHtmlElementStrategy.never,
      errorBuilder: (_, _, _) {
        if (!_triedOriginal) {
          final original = _fallbackCandidate();
          if (original != null && original != _url) {
            _queueOriginalFallback();
            return ColoredBox(color: context.appColors.surfaceElevated);
          }
        }
        return widget.errorChild;
      },
      loadingBuilder: kIsWeb || !widget.showLoadingIndicator
          ? null
          : (context, child, progress) {
              if (progress == null) return child;
              return Container(
                width: widget.width,
                height: widget.height,
                color: context.appColors.surfaceElevated,
                alignment: Alignment.center,
                child: const SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF6C63FF)),
                ),
              );
            },
    );
  }
}

class _CatalogImagePlaceholder extends StatelessWidget {
  final String message;
  final BorderRadius? borderRadius;

  const _CatalogImagePlaceholder({required this.message, this.borderRadius});

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
          decoration: BoxDecoration(
            color: context.appColors.surfaceElevated,
            borderRadius: borderRadius,
            border: Border.all(
              color: context.isDarkMode
                  ? Colors.white.withValues(alpha: 0.06)
                  : context.appColors.border,
            ),
          ),
          alignment: Alignment.center,
          padding: EdgeInsets.symmetric(
            horizontal: tight ? 6 : 10,
            vertical: tight ? 4 : 8,
          ),
          child: iconOnly
              ? Icon(
                  Icons.image_not_supported_outlined,
                  color: context.isDarkMode
                      ? Colors.white.withValues(alpha: 0.35)
                      : context.appColors.textMuted,
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
                          color: context.isDarkMode
                              ? Colors.white.withValues(alpha: 0.35)
                              : context.appColors.textMuted,
                          size: tight ? 22 : 28,
                        ),
                        SizedBox(height: tight ? 4 : 8),
                        Text(
                          'No product image',
                          textAlign: TextAlign.center,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: context.appColors.textSecondary,
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
                            color: context.appColors.textMuted,
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
