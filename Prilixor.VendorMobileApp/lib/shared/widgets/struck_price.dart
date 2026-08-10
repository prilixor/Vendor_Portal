import 'package:flutter/material.dart';

/// Diagonal strikethrough price, matching web `.strike-diagonal` / StruckPrice.
class StruckPrice extends StatelessWidget {
  final String text;
  final TextStyle? style;
  final Color color;

  const StruckPrice(
    this.text, {
    super.key,
    this.style,
    this.color = const Color(0xFFF43F5E),
  });

  @override
  Widget build(BuildContext context) {
    final base = (style ?? const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)).copyWith(
      color: color,
      decoration: TextDecoration.none,
    );
    return CustomPaint(
      foregroundPainter: _DiagonalStrikePainter(color: color.withValues(alpha: 0.95)),
      child: Text(text, style: base),
    );
  }
}

class _DiagonalStrikePainter extends CustomPainter {
  final Color color;

  _DiagonalStrikePainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final padX = size.width * 0.02;
    final midY = size.height * 0.52;
    final rise = size.height * 0.22;
    canvas.drawLine(
      Offset(-padX, midY + rise),
      Offset(size.width + padX, midY - rise),
      paint,
    );
  }

  @override
  bool shouldRepaint(covariant _DiagonalStrikePainter oldDelegate) =>
      oldDelegate.color != color;
}
