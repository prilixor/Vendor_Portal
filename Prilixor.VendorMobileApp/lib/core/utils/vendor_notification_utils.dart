import 'package:flutter/material.dart';

import '../models/vendor_notification_model.dart';
import '../theme.dart';

enum VendorNotificationVisualType {
  photoRequest,
  orderRequest,
  dispatch,
  payout,
  success,
  warning,
  error,
  support,
  product,
  document,
  info,
}

VendorNotificationVisualType visualTypeFor(VendorNotification n) {
  final t = n.notificationType.trim().toLowerCase();
  final title = n.title.trim().toLowerCase();

  // Photo requests (e.g. customer requested photos)
  if (t.contains('photo') || title.contains('photo')) {
    return VendorNotificationVisualType.photoRequest;
  }

  // New orders / dispatch offers / order requests
  if (t == 'dispatch_offer' ||
      t == 'new_order' ||
      t.contains('order_request') ||
      title.contains('order request') ||
      title.contains('new order')) {
    return VendorNotificationVisualType.orderRequest;
  }

  // Shipping / Dispatch / Transit / Delivery
  if (t.contains('dispatch') ||
      t.contains('transit') ||
      t.contains('delivery') ||
      t.contains('shipping') ||
      title.contains('dispatch') ||
      title.contains('delivery')) {
    return VendorNotificationVisualType.dispatch;
  }

  // Payouts & financial
  if (t.contains('payout') || t.contains('payment') || title.contains('payout')) {
    return VendorNotificationVisualType.payout;
  }

  // Approvals & confirmations
  if (t == 'success' ||
      t.contains('approved') ||
      t.contains('confirmed') ||
      title.contains('approved') ||
      title.contains('confirmed')) {
    return VendorNotificationVisualType.success;
  }

  // Rejections / cancellations / failures
  if (t.contains('rejected') ||
      t.contains('failed') ||
      t.contains('cancel') ||
      title.contains('rejected') ||
      title.contains('cancelled')) {
    return VendorNotificationVisualType.error;
  }

  // Support / chat replies
  if (t.contains('support') || t.contains('chat') || title.contains('support')) {
    return VendorNotificationVisualType.support;
  }

  // Inventory / Stock / Expirations
  if (t.contains('stock') ||
      t.contains('warning') ||
      t.contains('expir') ||
      t.contains('low_') ||
      title.contains('stock') ||
      title.contains('expir')) {
    return VendorNotificationVisualType.warning;
  }

  // Product listing notices
  if (t.startsWith('listing_') || t.contains('product') || title.contains('product')) {
    return VendorNotificationVisualType.product;
  }

  // KYC / Docs / Bank
  if (t.startsWith('document_') || t.startsWith('bank_') || title.contains('document')) {
    return VendorNotificationVisualType.document;
  }

  return VendorNotificationVisualType.info;
}

IconData iconForVisualType(VendorNotificationVisualType type) {
  switch (type) {
    case VendorNotificationVisualType.photoRequest:
      return Icons.add_a_photo_outlined;
    case VendorNotificationVisualType.orderRequest:
      return Icons.shopping_bag_outlined;
    case VendorNotificationVisualType.dispatch:
      return Icons.local_shipping_outlined;
    case VendorNotificationVisualType.payout:
      return Icons.payments_outlined;
    case VendorNotificationVisualType.success:
      return Icons.check_circle_outline;
    case VendorNotificationVisualType.warning:
      return Icons.hourglass_bottom_rounded;
    case VendorNotificationVisualType.error:
      return Icons.cancel_outlined;
    case VendorNotificationVisualType.support:
      return Icons.chat_bubble_outline_rounded;
    case VendorNotificationVisualType.product:
      return Icons.category_outlined;
    case VendorNotificationVisualType.document:
      return Icons.assignment_outlined;
    case VendorNotificationVisualType.info:
      return Icons.notifications_active_outlined;
  }
}

Color colorForVisualType(VendorNotificationVisualType type) {
  switch (type) {
    case VendorNotificationVisualType.photoRequest:
      return const Color(0xFF0EA5E9); // Sky blue
    case VendorNotificationVisualType.orderRequest:
      return const Color(0xFF6366F1); // Indigo
    case VendorNotificationVisualType.dispatch:
      return const Color(0xFF3B82F6); // Blue
    case VendorNotificationVisualType.payout:
      return const Color(0xFF10B981); // Emerald
    case VendorNotificationVisualType.success:
      return const Color(0xFF10B981); // Emerald
    case VendorNotificationVisualType.warning:
      return const Color(0xFFF59E0B); // Amber
    case VendorNotificationVisualType.error:
      return const Color(0xFFEF4444); // Rose
    case VendorNotificationVisualType.support:
      return const Color(0xFF8B5CF6); // Purple
    case VendorNotificationVisualType.product:
      return const Color(0xFF14B8A6); // Teal
    case VendorNotificationVisualType.document:
      return const Color(0xFFF97316); // Orange
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
