/// Keeps a photo on screen when a refresh only replaces the S3 signature.
/// Same rule as web `stableMediaUrl.ts`.
const _refreshBefore = Duration(seconds: 60);

/// Path of a stored file. A new S3 signature does not change this.
String mediaObjectKey(String url) {
  final trimmed = url.trim();
  if (trimmed.isEmpty) return trimmed;
  final query = trimmed.indexOf('?');
  final withoutQuery = query >= 0 ? trimmed.substring(0, query) : trimmed;
  try {
    final path = Uri.parse(trimmed).path;
    if (path.isEmpty) return withoutQuery;
    return path;
  } catch (_) {
    return withoutQuery;
  }
}

DateTime? signedUrlExpiresAt(String url) {
  try {
    final params = Uri.parse(url).queryParameters;
    final stamp = params['X-Amz-Date'];
    final expires = int.tryParse(params['X-Amz-Expires'] ?? '');
    if (stamp == null || expires == null) return null;
    final match = RegExp(r'^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$').firstMatch(stamp);
    if (match == null) return null;
    final start = DateTime.utc(
      int.parse(match[1]!),
      int.parse(match[2]!),
      int.parse(match[3]!),
      int.parse(match[4]!),
      int.parse(match[5]!),
      int.parse(match[6]!),
    );
    return start.add(Duration(seconds: expires));
  } catch (_) {
    return null;
  }
}

/// Keep [previous] when [next] is the same file and the signature is still valid.
String keepStableMediaUrl(String? previous, String next, [DateTime? now]) {
  if (previous == null || previous.isEmpty) return next;
  if (mediaObjectKey(previous) != mediaObjectKey(next)) return next;
  final expiry = signedUrlExpiresAt(previous);
  final clock = now ?? DateTime.now().toUtc();
  if (expiry == null || clock.isBefore(expiry.subtract(_refreshBefore))) return previous;
  return next;
}
