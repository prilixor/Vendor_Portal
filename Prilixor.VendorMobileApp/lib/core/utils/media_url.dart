import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../api/api_client.dart';
import 'open_document_bytes_stub.dart'
    if (dart.library.io) 'open_document_bytes_io.dart'
    if (dart.library.html) 'open_document_bytes_web.dart' as opener;

/// Resolves catalog/media URLs for Vendor mobile (same rules as Customer app).
String? resolveMediaUrl(String? raw) {
  if (raw == null) return null;
  final url = raw.trim();
  if (url.isEmpty || url.toLowerCase() == 'null') return null;

  if (url.startsWith('blob:') || url.startsWith('data:')) {
    return url;
  }

  final apiBase = ApiClient().baseUrl;
  final origin =
      apiBase.replaceFirst(RegExp(r'/api/?$', caseSensitive: false), '');

  String? resolved;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    resolved = url;
  } else if (url.startsWith('/api/') || url == '/api') {
    resolved = '$origin$url';
  } else if (url.startsWith('/')) {
    resolved = '$origin$url';
  } else {
    resolved = '$apiBase/${url.replaceFirst(RegExp(r'^/+'), '')}';
  }

  return normalizeHostedFileUrl(resolved);
}

/// Normalizes vendor-hosted file URLs (mirrors Vendor Web `normalizeHostedFileUrl`).
String? normalizeHostedFileUrl(String? fileUrl) {
  if (fileUrl == null) return null;
  var normalized = fileUrl.trim();
  if (normalized.isEmpty) return null;

  // Legacy DB paths used `product_images`; static files live under `product-images`.
  normalized = normalized.replaceAll('/product_images/', '/product-images/');
  normalized = normalized.replaceAll('product_images/', 'product-images/');

  if (normalized.startsWith('data:') || normalized.startsWith('blob:')) {
    return normalized;
  }

  final apiBase = ApiClient().baseUrl;
  final origin =
      apiBase.replaceFirst(RegExp(r'/api/?$', caseSensitive: false), '');

  try {
    final parsed = Uri.parse(normalized);
    if (!parsed.hasScheme) return normalized;

    final apiOrigin = Uri.parse(origin.isNotEmpty ? origin : apiBase);
    if (parsed.host != apiOrigin.host) {
      return normalized;
    }

    // wwwroot/uploads is served at /uploads (not /api/uploads).
    if (parsed.path.startsWith('/uploads/')) {
      return '$origin${parsed.path}${parsed.hasQuery ? '?${parsed.query}' : ''}';
    }
  } catch (_) {
    // Fall through to normalized string.
  }

  return normalized;
}

String? resolveItemImageUrl({
  String? listingPrimaryImageUrl,
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
  return null;
}

/// Converts stored file references to a path the `/files/download` endpoint can read locally.
String? normalizeFileDownloadUrl(String fileUrl) {
  final trimmed = fileUrl.trim();
  if (trimmed.isEmpty) return null;

  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return trimmed.replaceFirst(RegExp(r'^/+'), '');
  }

  final resolved = resolveMediaUrl(trimmed);
  if (resolved == null) return trimmed;

  try {
    final uri = Uri.parse(resolved);
    var path = uri.path;
    if (path.startsWith('/api/')) {
      path = path.substring('/api/'.length);
    } else if (path.startsWith('/')) {
      path = path.substring(1);
    }
    if (path.startsWith('uploads/')) {
      return path;
    }
  } catch (_) {
    // Fall through to original url.
  }

  return trimmed;
}

/// Fetches vendor document bytes through the authenticated `/files/download` API.
Future<Uint8List?> fetchAuthenticatedFileBytes(String fileUrl) async {
  if (fileUrl.trim().isEmpty) return null;

  final downloadUrl = normalizeFileDownloadUrl(fileUrl);
  if (downloadUrl != null) {
    final viaProxy = await _fetchBytesFromDownloadEndpoint(downloadUrl);
    if (viaProxy != null) return viaProxy;
  }

  final directUrl = resolveMediaUrl(fileUrl);
  if (directUrl != null) {
    final viaDirect = await _fetchBytesFromDirectUrl(directUrl);
    if (viaDirect != null) return viaDirect;
  }

  if (downloadUrl != null && downloadUrl != fileUrl.trim()) {
    return _fetchBytesFromDownloadEndpoint(fileUrl.trim());
  }
  return null;
}

Future<Uint8List?> _fetchBytesFromDownloadEndpoint(String url) async {
  try {
    final response = await ApiClient().dio.get<List<int>>(
      '/files/download',
      queryParameters: {'url': url},
      options: Options(responseType: ResponseType.bytes),
    );
    final data = response.data;
    if (data == null || data.isEmpty) return null;
    return Uint8List.fromList(data);
  } catch (_) {
    return null;
  }
}

Future<Uint8List?> _fetchBytesFromDirectUrl(String url) async {
  try {
    final response = await ApiClient().dio.get<List<int>>(
      url,
      options: Options(responseType: ResponseType.bytes),
    );
    final data = response.data;
    if (data == null || data.isEmpty) return null;
    return Uint8List.fromList(data);
  } catch (_) {
    return null;
  }
}

/// Opens downloaded document bytes: browser tab on web, system viewer on mobile.
Future<bool> openDocumentBytes(
  Uint8List bytes,
  String mimeType, {
  String? fileName,
}) {
  return opener.openDocumentBytes(bytes, mimeType, fileName: fileName);
}
