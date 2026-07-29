import 'package:flutter/material.dart';

/// Shown when rental cost ≥ buy price. Forces Buy (or asks to shorten period).
Future<bool?> showRentExceedsBuyDialog(
  BuildContext context, {
  String? itemTitle,
  required double rentalTotal,
  required double buyTotal,
  required String durationLabel,
  bool buyAvailable = true,
  bool compulsory = false,
}) {
  final name = (itemTitle ?? '').trim().isEmpty ? 'this item' : itemTitle!.trim();
  String inr(double n) => '₹${n.round()}';

  return showDialog<bool>(
    context: context,
    barrierDismissible: !compulsory,
    builder: (ctx) {
      return AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: Text(
          buyAvailable ? 'Switching to Buy' : 'Rental exceeds item value',
          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text.rich(
              TextSpan(
                style: const TextStyle(color: Colors.white70, fontSize: 14, height: 1.4),
                children: [
                  const TextSpan(text: 'For '),
                  TextSpan(text: name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                  const TextSpan(text: ', estimated rent of '),
                  TextSpan(
                    text: inr(rentalTotal),
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
                  ),
                  TextSpan(text: ' for $durationLabel meets or exceeds the buy price of '),
                  TextSpan(
                    text: inr(buyTotal),
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
                  ),
                  const TextSpan(text: '.'),
                ],
              ),
            ),
            const SizedBox(height: 10),
            Text(
              buyAvailable
                  ? 'Owning the item is better at this duration. We will set the order type to Buy (no rental deposit).'
                  : 'Buy is not enabled for this product. Please choose a shorter rental period so rent stays below the item value.',
              style: const TextStyle(color: Colors.white70, fontSize: 14, height: 1.4),
            ),
          ],
        ),
        actions: [
          if (buyAvailable) ...[
            if (!compulsory)
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(false),
                child: const Text('Choose shorter period', style: TextStyle(color: Colors.white70)),
              ),
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: const Text('Switch to Buy', style: TextStyle(color: Color(0xFF6C63FF), fontWeight: FontWeight.w700)),
            ),
          ] else
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('OK', style: TextStyle(color: Color(0xFF6C63FF), fontWeight: FontWeight.w700)),
            ),
        ],
      );
    },
  );
}
