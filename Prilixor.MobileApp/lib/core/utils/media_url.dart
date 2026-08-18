import '../api/api_client.dart';

/// Resolves catalog/media URLs for Mobile.
///
/// Relative `/api/...` paths are rewritten to the absolute API base
/// ([AppUrls.apiBaseUrl] / `https://api.blinksmed.com/api` in production).
String? resolveMediaUrl(String? raw) {
  if (raw == null) return null;
  final url = raw.trim();
  if (url.isEmpty || url.toLowerCase() == 'null') return null;

  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:') || url.startsWith('data:')) {
    return url;
  }

  final apiBase = ApiClient().baseUrl; // production: https://api.blinksmed.com/api
  final origin = apiBase.replaceFirst(RegExp(r'/api/?$', caseSensitive: false), '');

  if (url.startsWith('/api/') || url == '/api') {
    return '$origin$url';
  }
  if (url.startsWith('/')) {
    return '$origin$url';
  }
  return '$apiBase/${url.replaceFirst(RegExp(r'^/+'), '')}';
}

/// Prefer thumbnail, then listing/product primary, then first gallery URL.
/// Mirrors web `resolveItemImageUrl`.
String? originalUrlFromThumb(String url) {
  final match = RegExp(r'_thumb(\.[a-z0-9]+)(?:[?#].*)?$', caseSensitive: false).firstMatch(url);
  if (match == null) return null;
  return url.replaceFirst(RegExp(r'_thumb(?=\.[a-z0-9]+)', caseSensitive: false), '');
}

String? resolveItemImageUrl({
  String? listingPrimaryImageUrl,
  String? primaryImageUrl,
  String? primaryThumbnailUrl,
  String? thumbnailUrl,
  List<String>? imageUrls,
  Map<String, dynamic>? json,
}) {
  String? pick(dynamic value) {
    if (value == null) return null;
    final s = value.toString().trim();
    if (s.isEmpty || s.toLowerCase() == 'null') return null;
    return s;
  }

  final fromThumb = pick(primaryThumbnailUrl) ??
      pick(thumbnailUrl) ??
      (json == null
          ? null
          : pick(
              json['primaryThumbnailUrl'] ??
                  json['PrimaryThumbnailUrl'] ??
                  json['thumbnailUrl'] ??
                  json['ThumbnailUrl'],
            ));
  if (fromThumb != null) return resolveMediaUrl(fromThumb);

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
  if (json != null) {
    final gallery = json['imageUrls'] ?? json['ImageUrls'];
    if (gallery is List) {
      for (final u in gallery) {
        final resolved = resolveMediaUrl(u?.toString());
        if (resolved != null) return resolved;
      }
    }
  }
  return null;
}
