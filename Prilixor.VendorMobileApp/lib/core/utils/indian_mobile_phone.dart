/// Indian mobile: 10 digits starting with 6–9.
/// Optional +91 / 91 / 0 prefixes are stripped when normalizing.
class IndianMobilePhone {
  IndianMobilePhone._();

  static final RegExp pattern = RegExp(r'^[6-9]\d{9}$');

  static const String invalidMessage =
      'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.';

  static String digitsOnly(String? value) =>
      (value ?? '').replaceAll(RegExp(r'\D'), '');

  static String normalizeDigits(String? value) {
    var digits = digitsOnly(value);
    if (digits.length == 12 && digits.startsWith('91')) {
      digits = digits.substring(2);
    } else if (digits.length == 11 && digits.startsWith('0')) {
      digits = digits.substring(1);
    }
    return digits;
  }

  static bool isValid(String? value) => pattern.hasMatch(normalizeDigits(value));

  /// Empty is OK for optional fields; non-empty must be valid.
  static String? optionalError(String? value) {
    final trimmed = (value ?? '').trim();
    if (trimmed.isEmpty) return null;
    return isValid(trimmed) ? null : invalidMessage;
  }

  static String? requiredError(String? value) {
    final trimmed = (value ?? '').trim();
    if (trimmed.isEmpty) return 'Phone number is required.';
    return isValid(trimmed) ? null : invalidMessage;
  }
}
