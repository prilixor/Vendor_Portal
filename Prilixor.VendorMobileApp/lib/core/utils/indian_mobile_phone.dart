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

  /// Restrict typing/paste to 10 national digits (strips +91 / 91 / 0 when pasted).
  static String maskInput(String? value) {
    final digits = digitsOnly(value);
    if (digits.length >= 11) {
      final normalized = normalizeDigits(value);
      return normalized.length > 10 ? normalized.substring(0, 10) : normalized;
    }
    return digits.length > 10 ? digits.substring(0, 10) : digits;
  }

  /// Display form e.g. `+91 9909999099` (empty → empty).
  static String formatDisplay(String? value) {
    final digits = normalizeDigits(value);
    if (digits.isEmpty) return '';
    return '+91 $digits';
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

  static bool isValidEmail(String? value) {
    final trimmed = (value ?? '').trim();
    if (trimmed.isEmpty) return false;
    return RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(trimmed);
  }

  /// Vendor login — email or 10-digit Indian mobile (web Login.tsx parity).
  static String? loginIdentifierError(String? value) {
    final trimmed = (value ?? '').trim();
    if (trimmed.isEmpty) return 'Email or phone number is required.';
    if (isValidEmail(trimmed) || isValid(trimmed)) return null;
    return 'Enter a valid email address or 10-digit Indian mobile number.';
  }

  static String normalizeLoginIdentifier(String value) {
    final trimmed = value.trim();
    if (isValidEmail(trimmed)) return trimmed;
    return normalizeDigits(trimmed);
  }

  /// Compact login placeholder that fits narrow phones (iPhone SE, etc.).
  static String loginIdentifierHint(double width) {
    if (width < 360) return 'Email or mobile';
    return 'Email or mobile number';
  }
}
