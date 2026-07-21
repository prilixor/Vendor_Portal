import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../api/api_client.dart';
import '../models/vendor_notification_model.dart';
import '../utils/vendor_notification_utils.dart';

class VendorNotificationProvider extends ChangeNotifier {
  final ApiClient _api = ApiClient();

  List<VendorNotification> _notifications = [];
  List<VendorNotification> get notifications => _sortedNotifications();

  List<VendorNotification> filteredNotifications({bool unreadOnly = false}) {
    final items = _sortedNotifications();
    if (!unreadOnly) return items;
    return items.where(isUnread).toList();
  }

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _error;
  String? get error => _error;

  final Set<String> _optimisticReadIds = {};
  final Set<String> _optimisticUnreadIds = {};

  int get unreadCount =>
      _notifications.where((n) => _isEffectivelyUnread(n)).length;

  bool _isEffectivelyUnread(VendorNotification n) {
    if (_optimisticReadIds.contains(n.id)) return false;
    if (_optimisticUnreadIds.contains(n.id)) return true;
    return isNotificationUnread(n);
  }

  bool isUnread(VendorNotification n) => _isEffectivelyUnread(n);

  List<VendorNotification> _sortedNotifications() {
    final copy = List<VendorNotification>.from(_notifications);
    copy.sort(compareNotificationsNewestFirst);
    return copy;
  }

  Future<void> fetchNotifications(
    String vendorId, {
    bool silent = false,
  }) async {
    if (vendorId.isEmpty) return;
    final showLoading = !silent || _notifications.isEmpty;
    if (showLoading) {
      _isLoading = true;
      _error = null;
      notifyListeners();
    }
    try {
      final response = await _api.dio.get(
        '/vendors/$vendorId/notifications',
        queryParameters: {'_': DateTime.now().millisecondsSinceEpoch},
        options: Options(
          headers: const {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
        ),
      );
      final data = response.data is List ? response.data as List : const [];
      final fetched = data
          .whereType<Map>()
          .map((e) =>
              VendorNotification.fromJson(Map<String, dynamic>.from(e)))
          .toList();
      _notifications = _mergeOptimistic(fetched);
      _error = null;
    } on DioException catch (e) {
      if (_notifications.isEmpty) {
        _error = e.response?.statusCode == 401
            ? 'auth_required'
            : 'Failed to load alerts.';
      }
    } catch (_) {
      if (_notifications.isEmpty) _error = 'Failed to load alerts.';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchUnreadCount(String vendorId) async {
    if (vendorId.isEmpty) return;
    try {
      final response =
          await _api.dio.get('/vendors/$vendorId/notifications/unread-count');
      // Prefer list-derived count when we already have notifications;
      // still refresh list silently so badge stays accurate.
      if (response.statusCode == 200) {
        await fetchNotifications(vendorId, silent: true);
      }
    } catch (_) {
      // Ignore background badge errors.
    }
  }

  Future<void> markAsRead(String vendorId, String notificationId) async {
    _optimisticReadIds.add(notificationId);
    _optimisticUnreadIds.remove(notificationId);
    _notifications = _notifications
        .map((n) => n.id == notificationId
            ? n.copyWith(readAt: DateTime.now().toUtc(), status: 'read')
            : n)
        .toList();
    notifyListeners();
    try {
      await _api.dio.patch(
        '/vendors/$vendorId/notifications/$notificationId/read',
        data: {'vendorId': vendorId, 'notificationId': notificationId},
      );
    } catch (_) {
      // Keep optimistic read; next fetch will reconcile.
    }
  }

  Future<void> markAsUnread(String vendorId, String notificationId) async {
    _optimisticReadIds.remove(notificationId);
    _optimisticUnreadIds.add(notificationId);
    _notifications = _notifications
        .map((n) => n.id == notificationId
            ? n.copyWith(clearReadAt: true, status: 'unread')
            : n)
        .toList();
    notifyListeners();
    try {
      await _api.dio.patch(
        '/vendors/$vendorId/notifications/$notificationId/unread',
        data: {'vendorId': vendorId, 'notificationId': notificationId},
      );
    } catch (_) {}
  }

  Future<void> markAllAsRead(String vendorId) async {
    for (final n in _notifications) {
      _optimisticReadIds.add(n.id);
      _optimisticUnreadIds.remove(n.id);
    }
    _notifications = _notifications
        .map((n) => n.copyWith(readAt: DateTime.now().toUtc(), status: 'read'))
        .toList();
    notifyListeners();
    try {
      await _api.dio.patch(
        '/vendors/$vendorId/notifications/read-all',
        data: {'vendorId': vendorId},
      );
    } catch (_) {}
  }

  List<VendorNotification> _mergeOptimistic(List<VendorNotification> fetched) {
    final previousById = {for (final n in _notifications) n.id: n};
    return fetched.map((n) {
      if (n.readAt != null || n.status.trim().toLowerCase() == 'read') {
        _optimisticReadIds.remove(n.id);
        _optimisticUnreadIds.remove(n.id);
        return n;
      }
      if (_optimisticReadIds.contains(n.id)) {
        final prev = previousById[n.id];
        return n.copyWith(
          readAt: prev?.readAt ?? DateTime.now().toUtc(),
          status: 'read',
        );
      }
      if (_optimisticUnreadIds.contains(n.id)) {
        return n.copyWith(clearReadAt: true, status: 'unread');
      }
      return n;
    }).toList();
  }
}
