import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../api/api_client.dart';
import '../models/notification_model.dart';
import '../models/notification_preferences_model.dart';

class NotificationProvider extends ChangeNotifier {
  final ApiClient _apiClient = ApiClient();

  List<NotificationModel> _notifications = [];
  List<NotificationModel> get notifications => _notifications;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _errorMessage;
  String? get errorMessage => _errorMessage;

  /// IDs marked read locally while waiting for (or racing with) the server.
  /// Prevents 15s poll / tab refresh from snapping the badge back to unread.
  final Set<String> _optimisticReadIds = {};

  /// Prevents stampede from dashboard + IndexedStack tab inits + polling.
  Future<void>? _inFlightNotifications;
  DateTime? _lastSilentAttemptAt;
  static const _silentCooldown = Duration(seconds: 8);

  int get unreadCount => _notifications.where((n) => _isEffectivelyUnread(n)).length;

  bool _isEffectivelyUnread(NotificationModel n) {
    if (_optimisticReadIds.contains(n.id)) return false;
    return n.readAt == null;
  }

  bool isUnread(NotificationModel n) => _isEffectivelyUnread(n);

  /// [silent] avoids loading flicker during background/tab refresh.
  Future<void> fetchNotifications({bool silent = false}) async {
    if (_inFlightNotifications != null) return _inFlightNotifications!;
    if (silent &&
        _notifications.isNotEmpty &&
        _lastSilentAttemptAt != null &&
        DateTime.now().difference(_lastSilentAttemptAt!) < _silentCooldown) {
      return;
    }

    final future = _doFetchNotifications(silent: silent);
    _inFlightNotifications = future;
    try {
      await future;
    } finally {
      if (identical(_inFlightNotifications, future)) {
        _inFlightNotifications = null;
      }
    }
  }

  Future<void> _doFetchNotifications({required bool silent}) async {
    final showLoading = !silent || _notifications.isEmpty;
    if (showLoading) {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();
    }
    if (silent) {
      _lastSilentAttemptAt = DateTime.now();
    }

    try {
      final response = await _apiClient.dio.get(
        '/customers/me/notifications',
        queryParameters: {'_': DateTime.now().millisecondsSinceEpoch},
        options: Options(
          sendTimeout: const Duration(seconds: 30),
          receiveTimeout: const Duration(seconds: 45),
          headers: const {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
        ),
      );
      if (response.statusCode == 200) {
        final List<dynamic> data = response.data is List ? response.data as List : const [];
        final fetched = data
            .map((json) => NotificationModel.fromJson(json as Map<String, dynamic>))
            .toList();
        _notifications = _mergeWithOptimisticReads(fetched);
        _errorMessage = null;
      }
    } on DioException catch (e) {
      if (e.type == DioExceptionType.cancel ||
          e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout ||
          e.type == DioExceptionType.sendTimeout) {
        return;
      }
      if (_notifications.isEmpty) {
        if (e.response?.statusCode == 401 || e.response?.statusCode == 403) {
          _errorMessage = 'auth_required';
        } else {
          _errorMessage = 'Failed to load alerts. Please try again.';
        }
      }
    } catch (_) {
      if (_notifications.isEmpty) {
        _errorMessage = 'An unexpected error occurred.';
      }
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  List<NotificationModel> _mergeWithOptimisticReads(List<NotificationModel> fetched) {
    final previousById = {for (final n in _notifications) n.id: n};
    return fetched.map((n) {
      if (n.readAt != null) {
        _optimisticReadIds.remove(n.id);
        return n;
      }
      // Server still unread, but we already marked it locally — keep it read in UI.
      if (_optimisticReadIds.contains(n.id)) {
        final prev = previousById[n.id];
        return n.copyWith(readAt: prev?.readAt ?? DateTime.now().toUtc());
      }
      return n;
    }).toList();
  }

  NotificationPreferencesModel? _preferences;
  NotificationPreferencesModel? get preferences => _preferences;

  bool _isLoadingPrefs = false;
  bool get isLoadingPrefs => _isLoadingPrefs;

  Future<void> fetchPreferences() async {
    _isLoadingPrefs = true;
    notifyListeners();
    try {
      final response = await _apiClient.dio.get('/customers/me/notification-preferences');
      if (response.statusCode == 200 && response.data is Map<String, dynamic>) {
        _preferences = NotificationPreferencesModel.fromJson(response.data as Map<String, dynamic>);
      }
    } catch (_) {
      // Keep previous prefs on failure.
    } finally {
      _isLoadingPrefs = false;
      notifyListeners();
    }
  }

  Future<bool> updatePreferences(NotificationPreferencesModel next) async {
    try {
      final response = await _apiClient.dio.put(
        '/customers/me/notification-preferences',
        data: next.toUpdateJson(),
      );
      if (response.statusCode == 200 && response.data is Map<String, dynamic>) {
        _preferences = NotificationPreferencesModel.fromJson(response.data as Map<String, dynamic>);
        notifyListeners();
        return true;
      }
      if (response.statusCode == 200 || response.statusCode == 204) {
        _preferences = next;
        notifyListeners();
        return true;
      }
    } catch (_) {
      return false;
    }
    return false;
  }

  Future<bool> markAsRead(String id) async {
    if (id.trim().isEmpty) return false;

    final index = _notifications.indexWhere((n) => n.id == id);
    if (index == -1) return false;

    final previous = _notifications[index];
    if (previous.readAt != null || _optimisticReadIds.contains(id)) {
      return true;
    }

    _optimisticReadIds.add(id);
    _notifications[index] = previous.copyWith(readAt: DateTime.now().toUtc());
    notifyListeners();

    try {
      // FastEndpoints requires application/json for Endpoint<TRequest> PATCH (route-only DTOs).
      // Sending {} matches the web client and avoids HTTP 415.
      final response = await _apiClient.dio.patch(
        '/customers/me/notifications/${Uri.encodeComponent(id)}/read',
        data: <String, dynamic>{},
        options: Options(contentType: Headers.jsonContentType),
      );
      final code = response.statusCode ?? 0;
      if (code >= 200 && code < 300) {
        final raw = response.data;
        if (raw is Map) {
          try {
            final updated = NotificationModel.fromJson(Map<String, dynamic>.from(raw));
            final i = _notifications.indexWhere((n) => n.id == id);
            if (i != -1) {
              _notifications[i] = updated.readAt != null
                  ? updated
                  : updated.copyWith(readAt: DateTime.now().toUtc());
            }
            if (updated.readAt != null) {
              _optimisticReadIds.remove(id);
            }
          } catch (e) {
            // Mark succeeded on server; keep optimistic read even if body parse fails.
            debugPrint('markAsRead parse warning for $id: $e');
          }
        }
        notifyListeners();
        return true;
      }

      _optimisticReadIds.remove(id);
      final i = _notifications.indexWhere((n) => n.id == id);
      if (i != -1) _notifications[i] = previous;
      notifyListeners();
      return false;
    } on DioException catch (e) {
      debugPrint('markAsRead failed for $id: ${e.response?.statusCode} ${e.response?.data ?? e.message}');
      _optimisticReadIds.remove(id);
      final i = _notifications.indexWhere((n) => n.id == id);
      if (i != -1) _notifications[i] = previous;
      notifyListeners();
      return false;
    } catch (e) {
      debugPrint('markAsRead failed for $id: $e');
      _optimisticReadIds.remove(id);
      final i = _notifications.indexWhere((n) => n.id == id);
      if (i != -1) _notifications[i] = previous;
      notifyListeners();
      return false;
    }
  }

  Future<void> markAllAsRead() async {
    final previouslyUnread = _notifications.where((n) => n.readAt == null).map((n) => n.id).toList();
    if (previouslyUnread.isEmpty) return;

    for (final id in previouslyUnread) {
      _optimisticReadIds.add(id);
    }
    final now = DateTime.now().toUtc();
    _notifications = _notifications
        .map((n) => n.readAt == null ? n.copyWith(readAt: now) : n)
        .toList();
    notifyListeners();

    try {
      final response = await _apiClient.dio.patch(
        '/customers/me/notifications/read-all',
        data: <String, dynamic>{},
        options: Options(contentType: Headers.jsonContentType),
      );
      final code = response.statusCode ?? 0;
      if (code >= 200 && code < 300) {
        await fetchNotifications(silent: true);
        return;
      }
    } catch (e) {
      debugPrint('markAllAsRead failed: $e');
    }

    for (final id in previouslyUnread) {
      _optimisticReadIds.remove(id);
    }
    await fetchNotifications(silent: true);
  }
}
