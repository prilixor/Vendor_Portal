import 'package:flutter/material.dart';

import '../models/vendor_notification_model.dart';
import '../theme.dart';

enum VendorNotificationVisualType { info, success, warning, error }

VendorNotificationVisualType visualTypeFor(VendorNotification n) {
  final t = n.notificationType.trim().toLowerCase();
  if (t == 'success' ||
      t.contains('approved') ||
      t.contains('payout') ||
      t.contains('confirmed')) {
    return VendorNotificationVisualType.success;
  }
  if (t.contains('rejected') ||
      t.contains('failed') ||
      t.contains('cancel')) {
    return VendorNotificationVisualType.error;
  }
  if (t.contains('stock') ||
      t.contains('warning') ||
      t.contains('expir') ||
      t.contains('low_')) {
    return VendorNotificationVisualType.warning;
  }
  return VendorNotificationVisualType.info;
}

IconData iconForVisualType(VendorNotificationVisualType type) {
  switch (type) {
    case VendorNotificationVisualType.success:
      return Icons.check_circle_outline;
    case VendorNotificationVisualType.warning:
      return Icons.warning_amber_outlined;
    case VendorNotificationVisualType.error:
      return Icons.error_outline;
    case VendorNotificationVisualType.info:
      return Icons.info_outline;
  }
}

Color colorForVisualType(VendorNotificationVisualType type) {
  switch (type) {
    case VendorNotificationVisualType.success:
      return const Color(0xFF34D399);
    case VendorNotificationVisualType.warning:
      return const Color(0xFFFBBF24);
    case VendorNotificationVisualType.error:
      return const Color(0xFFF87171);
    case VendorNotificationVisualType.info:
      return AppTheme.accent;
  }
}

final _uuidInMessage = RegExp(
  r'\s*\[?ID:\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]?',
  caseSensitive: false,
);

String cleanNotificationMessage(String message) {
  var text = message.replaceAll(_uuidInMessage, '').trim();
  text = text.replaceAll(
    RegExp(r'\s*Reason:\s*(yes|no|true|false|null|n/a|na|-)\.?\s*$', caseSensitive: false),
    '',
  );
  text = text.replaceAll(RegExp(r'\s{2,}'), ' ').trim();
  return text;
}

String? extractOrderIdFromMessage(String message) {
  final match = _uuidInMessage.firstMatch(message);
  return match?.group(1);
}

DateTime effectiveTimestamp(VendorNotification n) {
  return n.sentAt ?? n.readAt ?? DateTime.fromMillisecondsSinceEpoch(0);
}

String formatRelativeTime(DateTime date) {
  final local = date.toLocal();
  final now = DateTime.now();
  final diff = now.difference(local);

  if (diff.inSeconds < 60) return 'Just now';
  if (diff.inMinutes < 60) {
    final m = diff.inMinutes;
    return '$m ${m == 1 ? 'minute' : 'minutes'} ago';
  }
  if (diff.inHours < 24) {
    final h = diff.inHours;
    return '$h ${h == 1 ? 'hour' : 'hours'} ago';
  }
  if (diff.inDays < 7) {
    final d = diff.inDays;
    return '$d ${d == 1 ? 'day' : 'days'} ago';
  }
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return '${months[local.month - 1]} ${local.day}, ${local.year}';
}

bool isNotificationUnread(VendorNotification n) {
  if (n.status.trim().toLowerCase() == 'read') return false;
  return n.readAt == null;
}

int compareNotificationsNewestFirst(VendorNotification a, VendorNotification b) {
  return effectiveTimestamp(b).compareTo(effectiveTimestamp(a));
}
