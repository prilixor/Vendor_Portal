import 'package:flutter/foundation.dart' show kIsWeb;

/// Production URLs aligned with Web Option 2 (blinksmed.com).
///
/// Flutter Web on `localhost` automatically uses the local API so browsers
/// do not hit production CORS (api.blinksmed.com does not allow localhost).
class AppUrls {
  AppUrls._();

  static const String _prodApiBaseUrl = 'https://api.blinksmed.com/api';
  static const String _localApiBaseUrl = 'https://localhost:5001/api';

  /// Shared .NET API (same host as Web `VITE_API_BASE_URL`).
  static String get apiBaseUrl {
    if (kIsWeb) {
      final host = Uri.base.host.toLowerCase();
      if (host == 'localhost' || host == '127.0.0.1') {
        return _localApiBaseUrl;
      }
    }
    return _prodApiBaseUrl;
  }

  /// Vendor portal web (terms, privacy, browser opens).
  static const String portalWebBaseUrl = 'https://vendor.blinksmed.com';

  static const String termsPath = '/terms-and-conditions';
  static const String privacyPath = '/privacy-policy';
}
