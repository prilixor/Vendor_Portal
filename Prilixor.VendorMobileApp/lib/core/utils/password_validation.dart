/// Shared password + confirm-password rules for vendor register and settings.
class PasswordValidation {
  static const minLength = 8;

  static const lengthMessage = 'At least 8 characters';
  static const mismatchMessage = "Passwords don't match";
  static const confirmRequiredMessage = 'Please confirm your password';

  /// Live: show the length rule only after the user has started typing.
  static String? liveLengthError(
    String password, {
    String message = lengthMessage,
  }) {
    if (password.isNotEmpty && password.length < minLength) return message;
    return null;
  }

  /// Live: mismatch only when confirm is non-empty and the values differ.
  static String? liveConfirmError(
    String password,
    String confirm, {
    String message = mismatchMessage,
  }) {
    if (confirm.isNotEmpty && password != confirm) return message;
    return null;
  }

  static String? submitLengthError(
    String password, {
    String message = lengthMessage,
  }) {
    if (password.length < minLength) return message;
    return null;
  }

  static String? submitConfirmError(
    String password,
    String confirm, {
    String requiredMessage = confirmRequiredMessage,
    String mismatchMessage = PasswordValidation.mismatchMessage,
  }) {
    if (confirm.isEmpty) return requiredMessage;
    if (password != confirm) return mismatchMessage;
    return null;
  }
}
