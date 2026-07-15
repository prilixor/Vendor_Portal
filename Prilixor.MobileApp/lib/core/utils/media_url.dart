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

/// Prefer listing primary image, then product primary, then first gallery URL.
/// Mirrors web `resolveItemImageUrl`.
String? resolveItemImageUrl({
  String? listingPrimaryImageUrl,
  String? primaryImageUrl,
  List<String>? imageUrls,
  Map<String, dynamic>? json,
}) {
  String? pick(dynamic value) {
    if (value == null) return null;
    final s = value.toString().trim();
    if (s.isEmpty || s.toLowerCase() == 'null') return null;
    return s;
  }

  final fromListing = pick(listingPrimaryImageUrl) ??
      (json == null
          ? null
          : pick(json['listingPrimaryImageUrl'] ?? json['ListingPrimaryImageUrl']));
  if (fromListing != null) return resolveMediaUrl(fromListing);

  final fromPrimary = pick(primaryImageUrl) ??
      (json == null ? null : pick(json['primaryImageUrl'] ?? json['PrimaryImageUrl']));
  if (fromPrimary != null) return resolveMediaUrl(fromPrimary);

  if (imageUrls != null) {
    for (final u in imageUrls) {
      final resolved = resolveMediaUrl(u);
      if (resolved != null) return resolved;
    }
  }
  return null;
}
