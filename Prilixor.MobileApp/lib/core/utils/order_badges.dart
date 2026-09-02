/// Matches web `formatOrderStatusLabel` / `formatOrderTypeLabel`.
String formatOrderStatusLabel(String status) {
  final s = status.trim().toLowerCase().replaceAll('_', ' ').replaceAll(RegExp(r'\s+'), ' ');
  if (s == 'awaiting vendor acceptance' ||
      s == 'pending vendor acceptance' ||
      s == 'awaiting') {
    return 'Awaiting';
  }
  if (s == 'dispatch failed') return 'Failed';
  if (s.isEmpty) return status;
  return s
      .split(' ')
      .where((w) => w.isNotEmpty)
      .map((w) => '${w[0].toUpperCase()}${w.substring(1)}')
      .join(' ');
}

String formatOrderTypeLabel(String type) {
  return type.toLowerCase().trim() == 'buy' ? 'Buy' : 'Rent';
}
