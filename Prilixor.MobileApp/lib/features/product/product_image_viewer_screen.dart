import 'package:extended_image/extended_image.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/utils/media_url.dart';
import '../../shared/widgets/catalog_image.dart';

/// Product gallery viewer.
/// - Android/iOS: ExtendedImage free finger pinch (marketplace-style)
/// - Flutter web: CatalogImage (HTML img) + InteractiveViewer (avoids CORS decode failures)
class ProductImageViewerScreen extends StatefulWidget {
  final List<String> imageUrls;
  final int initialIndex;
  final String title;

  const ProductImageViewerScreen({
    super.key,
    required this.imageUrls,
    this.initialIndex = 0,
    this.title = 'Product',
  });

  @override
  State<ProductImageViewerScreen> createState() => _ProductImageViewerScreenState();
}

class _ProductImageViewerScreenState extends State<ProductImageViewerScreen> {
  late final PageController _webPageController;
  late final ExtendedPageController _nativePageController;
  late int _index;
  final Map<int, TransformationController> _webTransforms = {};
  bool _webZoomed = false;

  @override
  void initState() {
    super.initState();
    _index = widget.initialIndex.clamp(0, widget.imageUrls.length - 1);
    _webPageController = PageController(initialPage: _index);
    _nativePageController = ExtendedPageController(initialPage: _index);
    SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle.light);
  }

  @override
  void dispose() {
    clearGestureDetailsCache();
    _webPageController.dispose();
    _nativePageController.dispose();
    for (final c in _webTransforms.values) {
      c.dispose();
    }
    super.dispose();
  }

  String? _resolved(int i) => resolveMediaUrl(widget.imageUrls[i]);

  TransformationController _webController(int i) {
    return _webTransforms.putIfAbsent(i, TransformationController.new);
  }

  void _goTo(int i) {
    if (i < 0 || i >= widget.imageUrls.length) return;
    if (kIsWeb) {
      _webPageController.animateToPage(i, duration: const Duration(milliseconds: 280), curve: Curves.easeOutCubic);
    } else {
      _nativePageController.animateToPage(i, duration: const Duration(milliseconds: 280), curve: Curves.easeOutCubic);
    }
  }

  void _onDoubleTap(ExtendedImageGestureState state) {
    final pointer = state.pointerDownPosition;
    final begin = state.gestureDetails?.totalScale ?? 1.0;
    final end = begin <= 1.05 ? 2.5 : 1.0;
    state.handleDoubleTap(scale: end, doubleTapPosition: pointer);
  }

  void _webDoubleTap(int index, TapDownDetails details, BoxConstraints constraints) {
    final c = _webController(index);
    final current = c.value.getMaxScaleOnAxis();
    if (current > 1.05) {
      c.value = Matrix4.identity();
      setState(() => _webZoomed = false);
      return;
    }
    const target = 2.5;
    final focal = details.localPosition;
    final matrix = Matrix4.identity()
      ..translateByDouble(focal.dx, focal.dy, 0, 1)
      ..scaleByDouble(target, target, 1, 1)
      ..translateByDouble(-focal.dx, -focal.dy, 0, 1);
    c.value = matrix;
    setState(() => _webZoomed = true);
  }

  @override
  Widget build(BuildContext context) {
    final count = widget.imageUrls.length;
    final topPad = MediaQuery.paddingOf(context).top;
    final bottomPad = MediaQuery.paddingOf(context).bottom;

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          Positioned.fill(
            child: kIsWeb ? _buildWebGallery(count) : _buildNativeGallery(count),
          ),

          // Top bar (always on top, never mid-screen)
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: Container(
              padding: EdgeInsets.fromLTRB(4, topPad + 2, 8, 12),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Color(0xB3000000), Color(0x00000000)],
                ),
              ),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close_rounded, color: Colors.white, size: 26),
                    tooltip: 'Close',
                  ),
                  Expanded(
                    child: Text(
                      count > 1 ? '${_index + 1} of $count' : widget.title,
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w600),
                    ),
                  ),
                  const SizedBox(width: 48),
                ],
              ),
            ),
          ),

          // Side arrows for next / previous (hidden while zoomed on web)
          if (count > 1 && !(kIsWeb && _webZoomed)) ...[
            Positioned(
              left: 8,
              top: 0,
              bottom: 0,
              child: Center(
                child: _NavArrowButton(
                  icon: Icons.chevron_left_rounded,
                  tooltip: 'Previous image',
                  onTap: () => _goTo(_index - 1 < 0 ? count - 1 : _index - 1),
                ),
              ),
            ),
            Positioned(
              right: 8,
              top: 0,
              bottom: 0,
              child: Center(
                child: _NavArrowButton(
                  icon: Icons.chevron_right_rounded,
                  tooltip: 'Next image',
                  onTap: () => _goTo(_index + 1 >= count ? 0 : _index + 1),
                ),
              ),
            ),
          ],

          // Bottom thumbs only (no instruction text)
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Container(
              width: double.infinity,
              padding: EdgeInsets.fromLTRB(16, 20, 16, bottomPad + 10),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: [Color(0xCC000000), Color(0x00000000)],
                ),
              ),
              child: count > 1
                  ? SizedBox(
                      height: 58,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: count,
                        separatorBuilder: (_, _) => const SizedBox(width: 8),
                        itemBuilder: (_, i) {
                          final selected = i == _index;
                          return GestureDetector(
                            onTap: () => _goTo(i),
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 160),
                              width: 54,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: selected ? const Color(0xFF6C63FF) : Colors.white24,
                                  width: selected ? 2.2 : 1,
                                ),
                                color: const Color(0xFF1E293B),
                              ),
                              clipBehavior: Clip.antiAlias,
                              child: CatalogImage(
                                url: widget.imageUrls[i],
                                fit: BoxFit.contain,
                              ),
                            ),
                          );
                        },
                      ),
                    )
                  : const SizedBox.shrink(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNativeGallery(int count) {
    return ExtendedImageGesturePageView.builder(
      controller: _nativePageController,
      itemCount: count,
      physics: const BouncingScrollPhysics(),
      canScrollPage: (GestureDetails? details) {
        final scale = details?.totalScale ?? 1.0;
        return scale <= 1.05;
      },
      onPageChanged: (i) => setState(() => _index = i),
      itemBuilder: (context, index) {
        final url = _resolved(index);
        if (url == null) {
          return const ColoredBox(
            color: Colors.black,
            child: Center(child: Text('Image unavailable', style: TextStyle(color: Colors.white54))),
          );
        }

        return ExtendedImage.network(
          url,
          fit: BoxFit.contain,
          mode: ExtendedImageMode.gesture,
          enableLoadState: true,
          handleLoadingProgress: true,
          cache: true,
          loadStateChanged: (ExtendedImageState state) {
            switch (state.extendedImageLoadState) {
              case LoadState.loading:
                return const ColoredBox(
                  color: Colors.black,
                  child: Center(
                    child: SizedBox(
                      width: 28,
                      height: 28,
                      child: CircularProgressIndicator(strokeWidth: 2.5, color: Color(0xFF6C63FF)),
                    ),
                  ),
                );
              case LoadState.failed:
                return ColoredBox(
                  color: Colors.black,
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.broken_image_outlined, color: Colors.white38, size: 40),
                        const SizedBox(height: 10),
                        const Text('Could not load image', style: TextStyle(color: Colors.white54)),
                        const SizedBox(height: 12),
                        TextButton(
                          onPressed: state.reLoadImage,
                          child: const Text('Retry', style: TextStyle(color: Color(0xFFA5B4FC))),
                        ),
                      ],
                    ),
                  ),
                );
              case LoadState.completed:
                return null;
            }
          },
          initGestureConfigHandler: (_) => GestureConfig(
            minScale: 1.0,
            animationMinScale: 0.85,
            maxScale: 4.0,
            animationMaxScale: 4.5,
            speed: 1.0,
            inertialSpeed: 100.0,
            initialScale: 1.0,
            inPageView: true,
            initialAlignment: InitialAlignment.center,
            cacheGesture: false,
            hitTestBehavior: HitTestBehavior.opaque,
          ),
          onDoubleTap: _onDoubleTap,
        );
      },
    );
  }

  Widget _buildWebGallery(int count) {
    return PageView.builder(
      controller: _webPageController,
      physics: _webZoomed ? const NeverScrollableScrollPhysics() : const BouncingScrollPhysics(),
      onPageChanged: (i) {
        _webController(_index).value = Matrix4.identity();
        setState(() {
          _index = i;
          _webZoomed = false;
        });
      },
      itemCount: count,
      itemBuilder: (context, index) {
        final controller = _webController(index);
        return LayoutBuilder(
          builder: (context, constraints) {
            return GestureDetector(
              onDoubleTapDown: (d) => _webDoubleTap(index, d, constraints),
              child: InteractiveViewer(
                transformationController: controller,
                minScale: 1,
                maxScale: 4,
                boundaryMargin: const EdgeInsets.all(64),
                clipBehavior: Clip.hardEdge,
                onInteractionUpdate: (_) {
                  if (index != _index) return;
                  final s = controller.value.getMaxScaleOnAxis();
                  final zoomed = s > 1.05;
                  if (zoomed != _webZoomed) setState(() => _webZoomed = zoomed);
                },
                onInteractionEnd: (_) {
                  if (index != _index) return;
                  final s = controller.value.getMaxScaleOnAxis();
                  if (s < 1.05) {
                    controller.value = Matrix4.identity();
                    setState(() => _webZoomed = false);
                  }
                },
                child: SizedBox(
                  width: constraints.maxWidth,
                  height: constraints.maxHeight,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(12, 72, 12, 120),
                    child: CatalogImage(
                      url: widget.imageUrls[index],
                      fit: BoxFit.contain,
                      width: constraints.maxWidth - 24,
                      height: constraints.maxHeight - 192,
                    ),
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }
}

class _NavArrowButton extends StatelessWidget {
  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;

  const _NavArrowButton({
    required this.icon,
    required this.tooltip,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.black.withValues(alpha: 0.45),
      shape: const CircleBorder(),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Tooltip(
          message: tooltip,
          child: SizedBox(
            width: 44,
            height: 44,
            child: Icon(icon, color: Colors.white, size: 30),
          ),
        ),
      ),
    );
  }
}
