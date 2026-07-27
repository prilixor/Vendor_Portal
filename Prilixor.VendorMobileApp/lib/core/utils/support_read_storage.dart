import 'dart:convert';

import '../storage/secure_storage.dart';

/// Persists per-ticket "last read" timestamps for support reply badges.
class SupportReadStorage {
  SupportReadStorage._();

  static const _storage = appSecureStorage;
  static const _prefix = 'vendor_support_read_';

  static String _key(String vendorId) => '$_prefix$vendorId';

  static Future<Map<String, DateTime>> load(String vendorId) async {
    if (vendorId.isEmpty) return {};
    try {
      final raw = await _storage.read(key: _key(vendorId));
      if (raw == null || raw.isEmpty) return {};
      final decoded = jsonDecode(raw);
      if (decoded is! Map) return {};
      return decoded.map((key, value) {
        final parsed = DateTime.tryParse(value?.toString() ?? '');
        return MapEntry(
          key.toString(),
          parsed?.toUtc() ?? DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
        );
      });
    } catch (_) {
      return {};
    }
  }

  static Future<void> save(String vendorId, Map<String, DateTime> state) async {
    if (vendorId.isEmpty) return;
    final encoded = jsonEncode(
      state.map((key, value) => MapEntry(key, value.toUtc().toIso8601String())),
    );
    await _storage.write(key: _key(vendorId), value: encoded);
  }

  static Future<void> markTicketRead(
    String vendorId,
    String ticketId, {
    DateTime? at,
  }) async {
    if (vendorId.isEmpty || ticketId.isEmpty) return;
    final state = await load(vendorId);
    state[ticketId] = (at ?? DateTime.now()).toUtc();
    await save(vendorId, state);
  }
}
