import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

/// Horizontally scrollable gallery thumbs with overflow arrows.
/// Mouse / trackpad drag works on Flutter web as well as touch.
class GalleryThumbStrip extends StatefulWidget {
  final int itemCount;
  final int selectedIndex;
  final double itemExtent;
  final double separator;
  final double height;
  final IndexedWidgetBuilder itemBuilder;
  final ValueChanged<int> onSelected;
  final Color fadeColor;
  final Color chevronColor;
  final Color chevronFill;

  const GalleryThumbStrip({
    super.key,
    required this.itemCount,
    required this.selectedIndex,
    required this.itemBuilder,
    required this.onSelected,
    required this.fadeColor,
    this.itemExtent = 68,
    this.separator = 10,
    this.height = 68,
    this.chevronColor = Colors.white,
    this.chevronFill = const Color(0xFF6C63FF),
  });

  @override
  State<GalleryThumbStrip> createState() => _GalleryThumbStripState();
}

class _GalleryThumbStripState extends State<GalleryThumbStrip> {
  final _controller = ScrollController();
  var _showStart = false;
  var _showEnd = false;

  double get _step => widget.itemExtent + widget.separator;

  @override
  void initState() {
    super.initState();
    _controller.addListener(_updateHints);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _updateHints();
      _scrollTo(widget.selectedIndex, animate: false);
    });
  }

  @override
  void didUpdateWidget(covariant GalleryThumbStrip oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.selectedIndex != widget.selectedIndex) {
      _scrollTo(widget.selectedIndex);
    }
    if (oldWidget.itemCount != widget.itemCount) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _updateHints());
    }
  }

  @override
  void dispose() {
    _controller.removeListener(_updateHints);
    _controller.dispose();
    super.dispose();
  }

  void _updateHints() {
    if (!_controller.hasClients) return;
    final pos = _controller.position;
    final overflow = pos.maxScrollExtent > 2;
    final start = overflow && pos.pixels > 2;
    final end = overflow && pos.pixels < pos.maxScrollExtent - 2;
    if (start != _showStart || end != _showEnd) {
      setState(() {
        _showStart = start;
        _showEnd = end;
      });
    }
  }

  void _scrollTo(int index, {bool animate = true}) {
    if (!_controller.hasClients) return;
    final target = (index * _step).clamp(0.0, _controller.position.maxScrollExtent);
    if (animate) {
      _controller.animateTo(target, duration: const Duration(milliseconds: 220), curve: Curves.easeOut);
    } else {
      _controller.jumpTo(target);
    }
  }

  void _nudge(double delta) {
    if (!_controller.hasClients) return;
    final target = (_controller.offset + delta).clamp(0.0, _controller.position.maxScrollExtent);
    _controller.animateTo(target, duration: const Duration(milliseconds: 220), curve: Curves.easeOut);
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: widget.height,
      child: Stack(
        children: [
          NotificationListener<ScrollMetricsNotification>(
            onNotification: (_) {
              _updateHints();
              return false;
            },
            child: ScrollConfiguration(
              behavior: const MaterialScrollBehavior().copyWith(
                dragDevices: {
                  PointerDeviceKind.touch,
                  PointerDeviceKind.mouse,
                  PointerDeviceKind.trackpad,
                  PointerDeviceKind.stylus,
                },
                scrollbars: false,
              ),
              child: ListView.separated(
                controller: _controller,
                scrollDirection: Axis.horizontal,
                physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
                padding: const EdgeInsets.symmetric(horizontal: 2),
                itemCount: widget.itemCount,
                separatorBuilder: (_, _) => SizedBox(width: widget.separator),
                itemBuilder: (context, index) {
                  return SizedBox(
                    width: widget.itemExtent,
                    child: GestureDetector(
                      onTap: () => widget.onSelected(index),
                      child: widget.itemBuilder(context, index),
                    ),
                  );
                },
              ),
            ),
          ),
          if (_showStart) ...[
            _EdgeFade(alignment: Alignment.centerLeft, color: widget.fadeColor),
            Align(
              alignment: Alignment.centerLeft,
              child: _StripChevron(
                icon: Icons.chevron_left_rounded,
                color: widget.chevronColor,
                fill: widget.chevronFill,
                onTap: () => _nudge(-_step * 2),
              ),
            ),
          ],
          if (_showEnd) ...[
            _EdgeFade(alignment: Alignment.centerRight, color: widget.fadeColor),
            Align(
              alignment: Alignment.centerRight,
              child: _StripChevron(
                icon: Icons.chevron_right_rounded,
                color: widget.chevronColor,
                fill: widget.chevronFill,
                onTap: () => _nudge(_step * 2),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _EdgeFade extends StatelessWidget {
  final Alignment alignment;
  final Color color;

  const _EdgeFade({required this.alignment, required this.color});

  @override
  Widget build(BuildContext context) {
    final start = alignment == Alignment.centerLeft;
    return IgnorePointer(
      child: Align(
        alignment: alignment,
        child: Container(
          width: 36,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: start ? Alignment.centerLeft : Alignment.centerRight,
              end: start ? Alignment.centerRight : Alignment.centerLeft,
              colors: [color, color.withValues(alpha: 0)],
            ),
          ),
        ),
      ),
    );
  }
}

class _StripChevron extends StatelessWidget {
  final IconData icon;
  final Color color;
  final Color fill;
  final VoidCallback onTap;

  const _StripChevron({
    required this.icon,
    required this.color,
    required this.fill,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: fill.withValues(alpha: 0.92),
      shape: const CircleBorder(),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: SizedBox(
          width: 26,
          height: 26,
          child: Icon(icon, color: color, size: 20),
        ),
      ),
    );
  }
}
