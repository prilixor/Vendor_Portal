import '../api/api_client.dart';

class PhoneOtpSetting {
  static bool? _cached;

  /// Admin switch. Stays on if the setting cannot be read.
  static Future<bool> isEnabled() async {
    final cached = _cached;
    if (cached != null) return cached;
    try {
      final response = await ApiClient().dio.get('/auth/phone-otp-enabled');
      final data = response.data;
      final enabled = data is! Map || data['phoneOtpEnabled'] != false;
      _cached = enabled;
      return enabled;
    } catch (_) {
      return true;
    }
  }
}
