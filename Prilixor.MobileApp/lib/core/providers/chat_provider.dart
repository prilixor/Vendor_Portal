import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../api/api_client.dart';
import '../models/chat_model.dart';
import 'profile_provider.dart';

class ChatProvider extends ChangeNotifier {
  final ApiClient _apiClient = ApiClient();
  final ProfileProvider _profileProvider;

  ChatProvider(this._profileProvider);

  List<ChatSessionModel> _sessions = [];
  List<ChatSessionModel> get sessions => _sessions;

  List<ChatMessageModel> _messages = [];
  List<ChatMessageModel> get messages => _messages;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _errorMessage;
  String? get errorMessage => _errorMessage;

  String? get currentUserId {
    return _profileProvider.profile?.id;
  }

  Future<void> fetchSessions() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _apiClient.dio.get('/customers/me/chats/sessions');
      if (response.statusCode == 200) {
        final List<dynamic> data = response.data;
        _sessions = data.map((json) => ChatSessionModel.fromJson(json)).toList();
      }
    } on DioException catch (e) {
      _errorMessage = 'Failed to load chat sessions: ${e.message}';
    } catch (e) {
      _errorMessage = 'An unexpected error occurred.';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchMessages(String sessionId) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _apiClient.dio.get('/customers/me/chats/sessions/${Uri.encodeComponent(sessionId)}/messages');
      if (response.statusCode == 200) {
        final List<dynamic> data = response.data;
        final myId = currentUserId ?? '';
        _messages = data.map((json) => ChatMessageModel.fromJson(json, myId)).toList();
      }
    } on DioException catch (e) {
      _errorMessage = 'Failed to load messages: ${e.message}';
    } catch (e) {
      _errorMessage = 'An unexpected error occurred.';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> sendMessage(String sessionId, String text) async {
    bool success = false;
    try {
      final response = await _apiClient.dio.post(
        '/customers/me/chats/sessions/${Uri.encodeComponent(sessionId)}/messages',
        data: {'messageText': text},
      );
      if (response.statusCode == 200) {
        success = true;
        await fetchMessages(sessionId); // reload messages
      }
    } catch (e) {
      _errorMessage = 'Failed to send message.';
      notifyListeners();
    }
    return success;
  }

  Future<String?> createSession(String vendorId, String orderId) async {
    _isLoading = true;
    notifyListeners();
    String? newSessionId;
    try {
      final response = await _apiClient.dio.post(
        '/customers/me/chats/sessions',
        data: {'vendorId': vendorId, 'orderId': orderId},
      );
      if (response.statusCode == 200 || response.statusCode == 201) {
        newSessionId = response.data['id'];
      }
    } catch (e) {
      _errorMessage = 'Failed to create chat session.';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
    return newSessionId;
  }
}
