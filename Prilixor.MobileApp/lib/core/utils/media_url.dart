import '../api/api_client.dart';

/// Resolves catalog/media URLs for Mobile.
///
/// React Vite proxies `/api/*` → API host, so relative image paths work there.
/// Flutter web-server on :3000 has no proxy — relative `/api/...` paths must be
/// rewritten to the absolute API base (e.g. https://localhost:5001/api/...).
String? resolveMediaUrl(String? raw) {
  if (raw == null) return null;
  final url = raw.trim();
  if (url.isEmpty || url.toLowerCase() == 'null') return null;

  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:') || url.startsWith('data:')) {
    return url;
  }

  final apiBase = ApiClient().baseUrl; // e.g. https://localhost:5001/api
  final origin = apiBase.replaceFirst(RegExp(r'/api/?$', caseSensitive: false), '');

  if (url.startsWith('/api/') || url == '/api') {
    return '$origin$url';
  }
  if (url.startsWith('/')) {
    return '$origin$url';
  }
  return '$apiBase/${url.replaceFirst(RegExp(r'^/+'), '')}';
}
