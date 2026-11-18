import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';

import '../../core/theme.dart';
import '../../core/utils/media_url.dart';
import '../../core/utils/stable_media_url.dart';

/// Catalog product image with empty/error placeholders.
/// On web, prefers HTML <img> so cross-origin images render without CORS decode failures.
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
        ? _CatalogImagePlaceholder(message: 'Image will be updated soon', borderRadius: borderRadius)
        : _CatalogNetworkImage(
            url: resolved,
            width: width,
            height: height,
            fit: fit,
            errorChild: _CatalogImagePlaceholder(
              message: 'Image currently unavailable',
              borderRadius: borderRadius,
            ),
          );

    if (borderRadius != null) {
      return ClipRRect(borderRadius: borderRadius!, child: child);
    }
    return child;
  }
}

/// Holds the signed URL already on screen so a poll cannot reload the same file.
class _CatalogNetworkImage extends StatefulWidget {
  final String url;
  final double? width;
  final double? height;
  final BoxFit fit;
  final Widget errorChild;

  const _CatalogNetworkImage({
    required this.url,
    required this.width,
    required this.height,
    required this.fit,
    required this.errorChild,
  });

  @override
  State<_CatalogNetworkImage> createState() => _CatalogNetworkImageState();
}

class _CatalogNetworkImageState extends State<_CatalogNetworkImage> {
  late String _url;
  var _triedOriginal = false;
  var _fallbackQueued = false;
  var _hasFrame = false;

  @override
  void initState() {
    super.initState();
    _url = widget.url;
  }

  @override
  void didUpdateWidget(covariant _CatalogNetworkImage oldWidget) {
    super.didUpdateWidget(oldWidget);
    final next = _adoptIncoming(widget.url);
    if (mediaObjectKey(next) != mediaObjectKey(_url)) {
      _triedOriginal = false;
      _fallbackQueued = false;
      _hasFrame = false;
    }
    _url = next;
  }

  String _adoptIncoming(String incoming) {
    final originalOfIncoming = originalUrlFromThumb(incoming);
    if (_triedOriginal &&
        originalOfIncoming != null &&
        mediaObjectKey(_url) == mediaObjectKey(originalOfIncoming)) {
      return _url;
    }
    return keepStableMediaUrl(_url, incoming);
  }

  String? _fallbackCandidate() => originalUrlFromThumb(_url);

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
        _hasFrame = false;
        _url = original;
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    return Image.network(
      _url,
      key: ValueKey(mediaObjectKey(_url)),
      width: widget.width,
      height: widget.height,
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
      loadingBuilder: (context, child, progress) {
        if (progress == null) {
          _hasFrame = true;
          return child;
        }
        if (_hasFrame) return child;
        return Container(
          width: widget.width,
          height: widget.height,
          color: context.appColors.surfaceElevated,
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
