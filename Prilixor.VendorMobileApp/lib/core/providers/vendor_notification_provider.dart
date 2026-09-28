import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../api/api_client.dart';
import '../models/vendor_notification_model.dart';
import '../utils/paged_json.dart';
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

  static const pageSize = 15;

  int _page = 1;
  int _totalCount = 0;
  int _unreadCount = 0;
  bool _isLoadingMore = false;
  bool get isLoadingMore => _isLoadingMore;
  bool get hasMore => _notifications.length < _totalCount;

  int get unreadCount => _unreadCount;

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

  Future<void>? _notificationsInflight;

  Future<void> fetchNotifications(
    String vendorId, {
    bool silent = false,
    bool reset = true,
    bool unreadOnly = false,
  }) async {
    if (vendorId.isEmpty) return;
    if (!reset) {
      await _fetchNotificationsInternal(
        vendorId,
        silent: true,
        reset: false,
        unreadOnly: unreadOnly,
      );
      return;
    }
    if (_notificationsInflight != null) return _notificationsInflight!;
    _notificationsInflight = _fetchNotificationsInternal(
      vendorId,
      silent: silent,
      reset: true,
      unreadOnly: unreadOnly,
    );
    try {
      await _notificationsInflight;
    } finally {
      _notificationsInflight = null;
    }
  }

  Future<void> _fetchNotificationsInternal(
    String vendorId, {
    required bool silent,
    required bool reset,
    bool unreadOnly = false,
  }) async {
    if (!reset) {
      if (_isLoading || _isLoadingMore || !hasMore) return;
      _isLoadingMore = true;
      notifyListeners();
      _page += 1;
    } else {
      _page = 1;
      final showLoading = !silent || _notifications.isEmpty;
      if (showLoading) {
        _isLoading = true;
        _error = null;
        notifyListeners();
      }
    }
    try {
      final query = <String, dynamic>{
        'page': reset ? 1 : _page,
        'pageSize': pageSize,
        '_': DateTime.now().millisecondsSinceEpoch,
      };
      if (unreadOnly) query['unreadOnly'] = true;
      final response = await _api.dio.get(
        '/vendors/$vendorId/notifications/summaries',
        queryParameters: query,
        options: Options(
          headers: const {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
        ),
      );
      if (response.statusCode == 200) {
        final body = asJsonMap(response.data);
        final fetched = asJsonList(body?['items'] ?? response.data)
            .whereType<Map>()
            .map((e) =>
                VendorNotification.fromJson(Map<String, dynamic>.from(e)))
            .toList();
        _totalCount = asJsonInt(body?['totalCount'], fetched.length);
        _unreadCount = asJsonInt(body?['unreadCount'], _unreadCount);
        final merged = _mergeOptimistic(fetched);
        _notifications = reset ? merged : [..._notifications, ...merged];
        _error = null;
      }
    } on DioException catch (e) {
      if (!reset) _page = (_page - 1).clamp(1, 1 << 20);
      if (_notifications.isEmpty) {
        _error = e.response?.statusCode == 401
            ? 'auth_required'
            : 'Failed to load alerts.';
      }
    } catch (_) {
      if (!reset) _page = (_page - 1).clamp(1, 1 << 20);
      if (_notifications.isEmpty) _error = 'Failed to load alerts.';
    } finally {
      _isLoading = false;
      _isLoadingMore = false;
      notifyListeners();
    }
  }

  Future<void> fetchUnreadCount(String vendorId) async {
    if (vendorId.isEmpty) return;
    try {
      final response =
          await _api.dio.get('/vendors/$vendorId/notifications/unread-count');
      if (response.statusCode == 200) {
        final map = asJsonMap(response.data);
        _unreadCount =
            asJsonInt(map?['unreadCount'] ?? map?['count'] ?? response.data);
        notifyListeners();
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
    if (_unreadCount > 0) _unreadCount--;
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
    _unreadCount += 1;
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
    _unreadCount = 0;
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
