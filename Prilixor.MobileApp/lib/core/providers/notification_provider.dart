import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../api/api_client.dart';
import '../models/notification_model.dart';

class NotificationProvider extends ChangeNotifier {
  final ApiClient _apiClient = ApiClient();

  List<NotificationModel> _notifications = [];
  List<NotificationModel> get notifications => _notifications;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _errorMessage;
  String? get errorMessage => _errorMessage;

  int get unreadCount => _notifications.where((n) => n.readAt == null).length;

  Future<void> fetchNotifications() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _apiClient.dio.get('/customers/me/notifications');
      if (response.statusCode == 200) {
        final List<dynamic> data = response.data;
        _notifications = data.map((json) => NotificationModel.fromJson(json)).toList();
      }
    } on DioException catch (e) {
      _errorMessage = 'Failed to load notifications: ${e.message}';
    } catch (e) {
      _errorMessage = 'An unexpected error occurred.';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> markAsRead(String id) async {
    // Optimistic update for instant UI feedback
    final index = _notifications.indexWhere((n) => n.id == id);
    if (index != -1 && _notifications[index].readAt == null) {
      _notifications[index] = NotificationModel(
        id: _notifications[index].id,
        title: _notifications[index].title,
        body: _notifications[index].body,
        notificationType: _notifications[index].notificationType,
        relatedOrderId: _notifications[index].relatedOrderId,
        createdAt: _notifications[index].createdAt,
        readAt: DateTime.now(),
      );
      notifyListeners();
    }

    try {
      await _apiClient.dio.patch('/customers/me/notifications/$id/read');
    } catch (e) {
      // Ignore errors for mark as read
    }
  }

  Future<void> markAllAsRead() async {
    try {
      final response = await _apiClient.dio.patch('/customers/me/notifications/read-all');
      if (response.statusCode == 200) {
        await fetchNotifications();
      }
    } catch (e) {
      // Ignore errors for mark as read
    }
  }
}
