/// Filters admin-entered rejection notes for vendor-facing UI.
String? sanitizeAdminComment(String? raw) {
  final value = raw?.trim();
  if (value == null || value.isEmpty) return null;
  if (RegExp(
    r'^(yes|no|true|false|null|n/a|na|-)$',
    caseSensitive: false,
  ).hasMatch(value)) {
    return null;
  }
  return value;
}

/// Parses admin notes embedded in notification messages (`Reason: ...`).
String? extractAdminCommentFromNotification(String message) {
  final match = RegExp(
    r'Reason:\s*(.+)$',
    caseSensitive: false,
    dotAll: true,
  ).firstMatch(message.trim());
  if (match == null) return null;
  return sanitizeAdminComment(match.group(1));
}

/// Removes a trailing `Reason: ...` suffix when shown separately in UI.
String notificationBodyWithoutAdminReason(String message) {
  return message
      .replaceAll(
        RegExp(r'\s*Reason:\s*.+$', caseSensitive: false, dotAll: true),
        '',
      )
      .trim();
}

bool isVerificationRejectionNotification(String notificationType) {
  final type = notificationType.trim().toLowerCase();
  return type.startsWith('document_') ||
      type.startsWith('bank_') ||
      type.contains('rejected');
}
