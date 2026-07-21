import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../api/api_client.dart';
import '../models/chat_model.dart';

class VendorChatProvider extends ChangeNotifier {
  final ApiClient _api = ApiClient();

  List<ChatSession> _sessions = [];
  List<ChatSession> get sessions => _sessions;

  List<ChatMessage> _messages = [];
  List<ChatMessage> get messages => _messages;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  bool _sending = false;
  bool get sending => _sending;

  String? _error;
  String? get error => _error;

  Future<void> fetchSessions(String vendorId, {bool silent = false}) async {
    if (vendorId.isEmpty) return;
    if (!silent || _sessions.isEmpty) {
      _isLoading = true;
      _error = null;
      notifyListeners();
    }
    try {
      final response =
          await _api.dio.get('/vendors/$vendorId/chats/sessions');
      final data = response.data is List ? response.data as List : const [];
      _sessions = data
          .whereType<Map>()
          .map((e) => ChatSession.fromJson(Map<String, dynamic>.from(e)))
          .toList()
        ..sort((a, b) => b.lastMessageAt.compareTo(a.lastMessageAt));
    } on DioException catch (e) {
      _error = e.message ?? 'Failed to load chats.';
    } catch (_) {
      _error = 'Failed to load chats.';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchMessages(
    String vendorId,
    String sessionId, {
    bool silent = false,
  }) async {
    if (vendorId.isEmpty || sessionId.isEmpty) return;
    if (!silent || _messages.isEmpty) {
      _isLoading = true;
      _error = null;
      notifyListeners();
    }
    try {
      final response = await _api.dio.get(
        '/vendors/$vendorId/chats/sessions/${Uri.encodeComponent(sessionId)}/messages',
      );
      final data = response.data is List ? response.data as List : const [];
      _messages = data
          .whereType<Map>()
          .map((e) => ChatMessage.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } on DioException catch (e) {
      _error = e.message ?? 'Failed to load messages.';
    } catch (_) {
      _error = 'Failed to load messages.';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> sendMessage(
    String vendorId,
    String sessionId,
    String text,
  ) async {
    if (text.trim().isEmpty) return false;
    _sending = true;
    _error = null;
    notifyListeners();
    try {
      await _api.dio.post(
        '/vendors/$vendorId/chats/sessions/${Uri.encodeComponent(sessionId)}/messages',
        data: {'messageText': text.trim()},
      );
      await fetchMessages(vendorId, sessionId, silent: true);
      return true;
    } on DioException catch (e) {
      _error = e.message ?? 'Failed to send message.';
      return false;
    } catch (_) {
      _error = 'Failed to send message.';
      return false;
    } finally {
      _sending = false;
      notifyListeners();
    }
  }
}
