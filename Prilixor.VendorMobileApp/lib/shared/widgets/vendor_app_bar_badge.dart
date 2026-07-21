import 'package:flutter/material.dart';

/// Branded vendor-portal chip for the main shell app bar.
class VendorAppBarBadge extends StatelessWidget {
  const VendorAppBarBadge({super.key});

  static const _accent = Color(0xFF6C63FF);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 12),
      child: Container(
        height: 30,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              _accent.withValues(alpha: 0.22),
              _accent.withValues(alpha: 0.10),
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: _accent.withValues(alpha: 0.38)),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.storefront_rounded, size: 15, color: _accent),
            SizedBox(width: 6),
            Text(
              'Vendor',
              style: TextStyle(
                color: _accent,
                fontSize: 12,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.2,
                height: 1,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
