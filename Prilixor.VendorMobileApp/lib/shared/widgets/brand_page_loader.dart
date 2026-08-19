import 'dart:math' as math;

import 'package:flutter/material.dart';

enum BrandPageLoaderSize { sm, md, lg }

/// Cropped BlinksMed mark only — never the wordmark lockup (`logo.png`).
const String kBrandLoaderMarkAsset = 'assets/branding/loader_mark.png';

const Color _kLoaderGlow = Color(0xFF8B85FF);
const Color _kLoaderGreen = Color(0xFF31C473);

/// Same motion as web `PageLoader`: two orbiting arcs + three sparks + mark.
class BrandPageLoader extends StatefulWidget {
  const BrandPageLoader({
    super.key,
    this.label,
    this.size = BrandPageLoaderSize.md,
  });

  final String? label;
  final BrandPageLoaderSize size;

  @override
  State<BrandPageLoader> createState() => _BrandPageLoaderState();
}

class _BrandPageLoaderState extends State<BrandPageLoader>
    with TickerProviderStateMixin {
  late final AnimationController _spin;
  late final AnimationController _spinRev;
  late final AnimationController _orbit;
  late final AnimationController _spark;

  bool _reduceMotion = false;

  @override
  void initState() {
    super.initState();
    _spin = AnimationController(vsync: this, duration: const Duration(milliseconds: 1150))
      ..repeat();
    _spinRev = AnimationController(vsync: this, duration: const Duration(milliseconds: 2400))
      ..repeat();
    _orbit = AnimationController(vsync: this, duration: const Duration(milliseconds: 3200))
      ..repeat();
    _spark = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400))
      ..repeat();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final reduce = MediaQuery.disableAnimationsOf(context);
    if (reduce == _reduceMotion && (_spin.isAnimating || reduce)) return;
    _reduceMotion = reduce;
    final controllers = [_spin, _spinRev, _orbit, _spark];
    if (reduce) {
      for (final c in controllers) {
        c.stop();
        c.value = 0;
      }
    } else {
      _spin.repeat();
      _spinRev.repeat();
      _orbit.repeat();
      _spark.repeat();
    }
  }

  @override
  void dispose() {
    _spin.dispose();
    _spinRev.dispose();
    _orbit.dispose();
    _spark.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    final muted = Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.65);
    final dims = switch (widget.size) {
      BrandPageLoaderSize.sm => (box: 72.0, logo: 36.0, stroke: 2.25, radius: 30.0),
      BrandPageLoaderSize.md => (box: 88.0, logo: 42.0, stroke: 2.4, radius: 37.0),
      BrandPageLoaderSize.lg => (box: 112.0, logo: 54.0, stroke: 2.75, radius: 48.0),
    };
    final stage = dims.box + 24;
    final innerR = math.max(dims.radius - 10, 18.0);

    return Semantics(
      label: widget.label ?? 'Loading',
      liveRegion: true,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: stage,
              height: stage,
              child: AnimatedBuilder(
                animation: Listenable.merge([_spin, _spinRev, _orbit, _spark]),
                builder: (context, _) {
                  return Stack(
                    alignment: Alignment.center,
                    children: [
                      CustomPaint(
                        size: Size(dims.box, dims.box),
                        painter: _LoaderRingsPainter(
                          primary: primary,
                          glow: _kLoaderGlow,
                          green: _kLoaderGreen,
                          stroke: dims.stroke,
                          radius: dims.radius,
                          innerR: innerR,
                          spin: _spin.value,
                          spinRev: _spinRev.value,
                          orbit: _orbit.value,
                          sparkT: _spark.value,
                        ),
                      ),
                      DecoratedBox(
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          boxShadow: [
                            BoxShadow(
                              color: primary.withValues(alpha: 0.28),
                              blurRadius: 16,
                              offset: const Offset(0, 6),
                              spreadRadius: -6,
                            ),
                          ],
                          border: Border.all(color: Colors.black.withValues(alpha: 0.05)),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(5),
                          child: Image.asset(
                            kBrandLoaderMarkAsset,
                            width: dims.logo,
                            height: dims.logo,
                            fit: BoxFit.contain,
                          ),
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),
            if (widget.label != null) ...[
              const SizedBox(height: 14),
              Text(
                widget.label!,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: muted,
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _LoaderRingsPainter extends CustomPainter {
  _LoaderRingsPainter({
    required this.primary,
    required this.glow,
    required this.green,
    required this.stroke,
    required this.radius,
    required this.innerR,
    required this.spin,
    required this.spinRev,
    required this.orbit,
    required this.sparkT,
  });

  final Color primary;
  final Color glow;
  final Color green;
  final double stroke;
  final double radius;
  final double innerR;
  final double spin;
  final double spinRev;
  final double orbit;
  final double sparkT;

  @override
  void paint(Canvas canvas, Size size) {
    final c = Offset(size.width / 2, size.height / 2);

    canvas.drawCircle(
      c,
      radius,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..color = primary.withValues(alpha: 0.16),
    );

    canvas.save();
    canvas.translate(c.dx, c.dy);
    canvas.rotate(-spinRev * 2 * math.pi);
    canvas.translate(-c.dx, -c.dy);
    canvas.drawArc(
      Rect.fromCircle(center: c, radius: innerR),
      -math.pi / 2,
      0.9,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = math.max(stroke - 0.75, 1.5)
        ..strokeCap = StrokeCap.round
        ..color = glow.withValues(alpha: 0.7),
    );
    canvas.restore();

    canvas.save();
    canvas.translate(c.dx, c.dy);
    canvas.rotate(spin * 2 * math.pi);
    canvas.translate(-c.dx, -c.dy);
    canvas.drawArc(
      Rect.fromCircle(center: c, radius: radius),
      -math.pi / 2,
      1.55,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke + 0.4
        ..strokeCap = StrokeCap.round
        ..shader = SweepGradient(
          startAngle: -math.pi / 2,
          endAngle: -math.pi / 2 + 1.55,
          colors: [primary, glow, green],
        ).createShader(Rect.fromCircle(center: c, radius: radius)),
    );
    canvas.drawCircle(
      Offset(c.dx, c.dy - radius),
      stroke + 0.6,
      Paint()..color = glow,
    );
    canvas.restore();

    final sparkR = radius + 8;
    for (var i = 0; i < 3; i++) {
      final ang = orbit * 2 * math.pi + i * 2 * math.pi / 3;
      final p = Offset(
        c.dx + sparkR * math.sin(ang),
        c.dy - sparkR * math.cos(ang),
      );
      final t = (sparkT + i * 0.22) % 1;
      final pulse = t < 0.5 ? t * 2 : (1 - t) * 2;
      canvas.drawCircle(
        p,
        1.5,
        Paint()..color = primary.withValues(alpha: 0.2 + 0.8 * pulse),
      );
    }
  }

  @override
  bool shouldRepaint(covariant _LoaderRingsPainter old) {
    return old.spin != spin ||
        old.spinRev != spinRev ||
        old.orbit != orbit ||
        old.sparkT != sparkT ||
        old.primary != primary;
  }
}
