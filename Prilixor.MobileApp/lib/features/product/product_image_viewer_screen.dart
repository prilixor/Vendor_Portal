import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:photo_view/photo_view.dart';
import 'package:photo_view/photo_view_gallery.dart';
import '../../core/utils/media_url.dart';

/// Marketplace-style full-screen gallery:
/// pinch zoom, double-tap zoom, swipe between photos, zoom buttons.
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
  late final PageController _pageController;
  late int _index;
  final Map<int, PhotoViewController> _controllers = {};
  double _scale = 1;
  bool _chromeVisible = true;

  @override
  void initState() {
    super.initState();
    _index = widget.initialIndex.clamp(0, widget.imageUrls.length - 1);
    _pageController = PageController(initialPage: _index);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  }

  @override
  void dispose() {
    _pageController.dispose();
    for (final c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  PhotoViewController _controllerFor(int i) {
    return _controllers.putIfAbsent(i, () {
      final c = PhotoViewController();
      c.outputStateStream.listen((state) {
        if (!mounted || i != _index) return;
        final s = state.scale ?? 1;
        if ((s - _scale).abs() > 0.02) {
          setState(() => _scale = s);
        }
      });
      return c;
    });
  }

  String? _resolved(int i) => resolveMediaUrl(widget.imageUrls[i]);

  void _zoomBy(double factor) {
    final c = _controllerFor(_index);
    final current = c.scale ?? 1.0;
    final next = (current * factor).clamp(1.0, 4.0);
    c.scale = next;
    setState(() => _scale = next);
  }

  void _resetZoom() {
    final c = _controllerFor(_index);
    c.scale = 1;
    c.position = Offset.zero;
    setState(() => _scale = 1);
  }

  void _goTo(int i) {
    if (i < 0 || i >= widget.imageUrls.length) return;
    _pageController.animateToPage(
      i,
      duration: const Duration(milliseconds: 260),
      curve: Curves.easeOutCubic,
    );
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
          // Gallery
          PhotoViewGallery.builder(
            pageController: _pageController,
            itemCount: count,
            backgroundDecoration: const BoxDecoration(color: Colors.black),
            wantKeepAlive: true,
            gaplessPlayback: true,
            onPageChanged: (i) {
              setState(() {
                _index = i;
                _scale = _controllerFor(i).scale ?? 1;
              });
            },
            loadingBuilder: (context, event) => const Center(
              child: SizedBox(
                width: 28,
                height: 28,
                child: CircularProgressIndicator(strokeWidth: 2.5, color: Color(0xFF6C63FF)),
              ),
            ),
            builder: (context, index) {
              final url = _resolved(index);
              if (url == null) {
                return PhotoViewGalleryPageOptions.customChild(
                  child: const Center(
                    child: Text('Image unavailable', style: TextStyle(color: Colors.white54)),
                  ),
                  initialScale: PhotoViewComputedScale.contained,
                  minScale: PhotoViewComputedScale.contained,
                  maxScale: PhotoViewComputedScale.contained,
                );
              }

              return PhotoViewGalleryPageOptions(
                imageProvider: NetworkImage(url),
                controller: _controllerFor(index),
                initialScale: PhotoViewComputedScale.contained,
                minScale: PhotoViewComputedScale.contained,
                maxScale: PhotoViewComputedScale.covered * 3.2,
                basePosition: Alignment.center,
                tightMode: false,
                filterQuality: FilterQuality.high,
                gestureDetectorBehavior: HitTestBehavior.opaque,
                errorBuilder: (_, error, stack) => const Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.broken_image_outlined, color: Colors.white38, size: 40),
                      SizedBox(height: 8),
                      Text('Could not load image', style: TextStyle(color: Colors.white54)),
                    ],
                  ),
                ),
                onTapUp: (context, details, controllerValue) {
                  setState(() => _chromeVisible = !_chromeVisible);
                },
              );
            },
          ),

          // Top chrome
          AnimatedOpacity(
            opacity: _chromeVisible ? 1 : 0,
            duration: const Duration(milliseconds: 180),
            child: IgnorePointer(
              ignoring: !_chromeVisible,
              child: Container(
                padding: EdgeInsets.fromLTRB(4, topPad + 4, 8, 10),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Color(0xCC000000), Color(0x00000000)],
                  ),
                ),
                child: Row(
                  children: [
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.close_rounded, color: Colors.white),
                      tooltip: 'Close',
                    ),
                    Expanded(
                      child: Text(
                        count > 1 ? '${_index + 1} of $count' : widget.title,
                        textAlign: TextAlign.center,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    const SizedBox(width: 48),
                  ],
                ),
              ),
            ),
          ),

          // Zoom controls (right side, always easy to reach)
          AnimatedOpacity(
            opacity: _chromeVisible ? 1 : 0,
            duration: const Duration(milliseconds: 180),
            child: IgnorePointer(
              ignoring: !_chromeVisible,
              child: Align(
                alignment: Alignment.centerRight,
                child: Padding(
                  padding: const EdgeInsets.only(right: 10),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _ZoomFab(
                        icon: Icons.add_rounded,
                        tooltip: 'Zoom in',
                        onTap: () => _zoomBy(1.35),
                      ),
                      const SizedBox(height: 10),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.black54,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          '${_scale.toStringAsFixed(1)}×',
                          style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700),
                        ),
                      ),
                      const SizedBox(height: 10),
                      _ZoomFab(
                        icon: Icons.remove_rounded,
                        tooltip: 'Zoom out',
                        onTap: () {
                          if (_scale <= 1.05) {
                            _resetZoom();
                          } else {
                            _zoomBy(1 / 1.35);
                          }
                        },
                      ),
                      const SizedBox(height: 10),
                      _ZoomFab(
                        icon: Icons.fit_screen_rounded,
                        tooltip: 'Reset',
                        onTap: _resetZoom,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),

          // Bottom chrome: hint + thumbs
          AnimatedOpacity(
            opacity: _chromeVisible ? 1 : 0,
            duration: const Duration(milliseconds: 180),
            child: IgnorePointer(
              ignoring: !_chromeVisible,
              child: Align(
                alignment: Alignment.bottomCenter,
                child: Container(
                  width: double.infinity,
                  padding: EdgeInsets.fromLTRB(16, 16, 16, bottomPad + 12),
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.bottomCenter,
                      end: Alignment.topCenter,
                      colors: [Color(0xE6000000), Color(0x00000000)],
                    ),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text(
                        'Pinch to zoom  ·  Double-tap  ·  Drag to pan',
                        style: TextStyle(color: Colors.white60, fontSize: 11, fontWeight: FontWeight.w500),
                      ),
                      if (count > 1) ...[
                        const SizedBox(height: 12),
                        SizedBox(
                          height: 60,
                          child: ListView.separated(
                            scrollDirection: Axis.horizontal,
                            itemCount: count,
                            separatorBuilder: (_, _) => const SizedBox(width: 8),
                            itemBuilder: (_, i) {
                              final selected = i == _index;
                              final url = _resolved(i);
                              return GestureDetector(
                                onTap: () => _goTo(i),
                                child: AnimatedContainer(
                                  duration: const Duration(milliseconds: 160),
                                  width: 56,
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(
                                      color: selected ? const Color(0xFF6C63FF) : Colors.white24,
                                      width: selected ? 2.2 : 1,
                                    ),
                                    color: const Color(0xFF1E293B),
                                  ),
                                  clipBehavior: Clip.antiAlias,
                                  child: url == null
                                      ? const ColoredBox(color: Color(0xFF334155))
                                      : Image.network(
                                          url,
                                          fit: BoxFit.contain,
                                          errorBuilder: (context, error, stack) => const ColoredBox(color: Color(0xFF334155)),
                                        ),
                                ),
                              );
                            },
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ZoomFab extends StatelessWidget {
  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;

  const _ZoomFab({
    required this.icon,
    required this.tooltip,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white12,
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
            child: Icon(icon, color: Colors.white, size: 22),
          ),
        ),
      ),
    );
  }
}
