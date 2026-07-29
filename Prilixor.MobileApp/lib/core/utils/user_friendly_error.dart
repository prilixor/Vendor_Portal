/// Maps API ProblemDetails / Dio errors to user-facing text (never shows codes like customers.xxx).
String userFriendlyApiError(Object? error, [String fallback = 'Something went wrong. Please try again.']) {
  if (error == null) return fallback;

  String? detail;
  String? title;
  String? code;

  if (error is Map) {
    detail = error['detail']?.toString();
    title = error['title']?.toString();
    code = error['code']?.toString() ?? error['errorCode']?.toString();
  } else {
    detail = error.toString();
  }

  final resolvedCode = _normalizeCode(code) ??
      _normalizeCode(title) ??
      _extractCodeFromText(detail) ??
      _extractCodeFromText(title);

  if (resolvedCode != null && _mappedMessages.containsKey(resolvedCode)) {
    return _mappedMessages[resolvedCode]!;
  }

  final cleaned = _stripCodes(detail ?? '');
  if (cleaned.length > 8 && cleaned.contains(' ') && !_looksLikeCode(cleaned)) {
    return cleaned;
  }

  return fallback;
}

String userFriendlyDioMessage(dynamic responseData, String? dioMessage, [String fallback = 'Something went wrong. Please try again.']) {
  if (responseData is Map) {
    return userFriendlyApiError(responseData, fallback);
  }
  if (dioMessage != null && dioMessage.trim().isNotEmpty) {
    return userFriendlyApiError(dioMessage, fallback);
  }
  return fallback;
}

const Map<String, String> _mappedMessages = {
  'customers.out_of_service_area':
      "This delivery address is outside the vendor's service area. Please choose another address, or remove items that cannot be delivered there.",
  'customers.vendor_location_missing':
      "This item cannot be delivered yet because the vendor's location is not set up. Please try another product.",
  'customers.delivery_distance_error':
      "We couldn't verify delivery for this address. Please check your address or try again.",
  'customers.address_required': 'Please select a delivery address to continue.',
  'customers.address_pin_required':
      'Place the pin on the map before saving. Address text alone is not enough for delivery.',
  'customers.stock_unavailable':
      'Some items are out of stock or no longer available. Please update your cart and try again.',
  'customers.quantity_exceeds_stock':
      'Requested quantity is higher than available stock. Please reduce the quantity and try again.',
  'EMAIL_NOT_VERIFIED': 'Please verify your email before continuing.',
  'auth.invalid_credentials': 'Invalid email or password.',
  'directory.doctor_not_found':
      'No doctor found for this Unique ID. Please check the ID and try again.',
  'directory.doctor_code_required': 'Enter the doctor\'s Unique ID',
};

final RegExp _codePattern = RegExp(
  r'(?:vendors|customers|admins|documents|bank_accounts|auth|catalog|orders|directory)\.[a-z0-9_]+(?:\.[a-z0-9_]+)*|EMAIL_NOT_VERIFIED',
  caseSensitive: false,
);

String? _normalizeCode(String? raw) {
  if (raw == null) return null;
  final trimmed = raw.trim();
  if (trimmed.isEmpty || trimmed.contains('://') || trimmed.startsWith('http')) return null;
  final match = _codePattern.firstMatch(trimmed);
  return match?.group(0);
}

String? _extractCodeFromText(String? text) => _normalizeCode(text);

String _stripCodes(String message) {
  return message
      .replaceAll(RegExp(r'\s*\[[^\]]+\]\s*'), ' ')
      .replaceAll(_codePattern, ' ')
      .replaceAll(RegExp(r'\s{2,}'), ' ')
      .trim();
}

bool _looksLikeCode(String text) {
  final t = text.trim();
  if (t.isEmpty) return true;
  if (_codePattern.hasMatch(t) && !t.contains(' ')) return true;
  if (RegExp(r'^[a-z0-9_.-]+$', caseSensitive: false).hasMatch(t) && t.contains('.')) {
    return true;
  }
  return false;
}
