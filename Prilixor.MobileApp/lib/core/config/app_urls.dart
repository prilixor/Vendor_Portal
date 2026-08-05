/// Production URLs aligned with Web Option 2 (blinksmed.com).
///
/// For local API only, temporarily point [apiBaseUrl] at
/// `https://localhost:5001/api` in [ApiClient] (keep override commented).
class AppUrls {
  AppUrls._();

  /// Shared .NET API (same host as Web `VITE_API_BASE_URL`).
  static const String apiBaseUrl = 'https://api.blinksmed.com/api';

  /// Customer portal web (terms, privacy, browser opens).
  static const String portalWebBaseUrl = 'https://blinksmed.com';

  static const String termsPath = '/terms-and-conditions';
  static const String privacyPath = '/privacy-policy';
  static const String contactPath = '/contact-us';
}
