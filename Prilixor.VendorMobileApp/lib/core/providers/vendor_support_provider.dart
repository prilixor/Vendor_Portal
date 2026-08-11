import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';

import '../api/api_client.dart';
import '../models/support_model.dart';
import '../utils/multipart_file_util.dart';
import '../utils/support_chat_routing.dart';
import '../utils/support_read_storage.dart';

class VendorSupportProvider extends ChangeNotifier {
  final ApiClient _api = ApiClient();

  bool _ticketsLoading = false;
  bool get ticketsLoading => _ticketsLoading;

  bool _messagesLoading = false;
  bool get messagesLoading => _messagesLoading;

  bool _sending = false;
  bool get sending => _sending;

  bool _awaitingAi = false;
  bool get awaitingAi => _awaitingAi;

  String? _error;
  String? get error => _error;

  List<SupportTicket> _tickets = [];
  List<SupportTicket> get tickets => _tickets;

  List<SupportMessage> _messages = [];
  List<SupportMessage> get messages => _messages;

  String? _activeTicketId;
  String? get activeTicketId => _activeTicketId;

  String? _activeTicketStatus;
  String? get activeTicketStatus => _activeTicketStatus;

  int _unreadAdminReplyCount = 0;
  int get unreadAdminReplyCount => _unreadAdminReplyCount;

  Map<String, DateTime> _lastReadByTicket = {};
  String? _readStateVendorId;

  /// Mirrors Vendor Web `forceNextAsNewTicket` — next AI send creates a new ticket.
  bool _forceNextAsNewTicket = false;
  bool get forceNextAsNewTicket => _forceNextAsNewTicket;

  bool get isTicketClosed =>
      (_activeTicketStatus ?? '').trim().toLowerCase() == 'closed';

  Future<void> fetchTickets(String vendorId) async {
    if (vendorId.isEmpty) return;
    _ticketsLoading = true;
    _error = null;
    notifyListeners();
    try {
      final response = await _api.dio.get('/support/tickets/vendor/$vendorId');
      final list = _parseList(response.data);
      _tickets = list.map((e) => SupportTicket.fromJson(e)).toList()
        ..sort((a, b) {
          final aTime = a.updatedAt ?? a.createdAt;
          final bTime = b.updatedAt ?? b.createdAt;
          return bTime.compareTo(aTime);
        });
      await _ensureReadStateLoaded(vendorId);
      await _recomputeUnreadAdminReplyCount(vendorId);
    } on DioException catch (e) {
      _error = _dioMessage(e, 'Failed to load support tickets.');
    } catch (_) {
      _error = 'Failed to load support tickets.';
    } finally {
      _ticketsLoading = false;
      notifyListeners();
    }
  }

  Future<void> refreshUnreadAdminReplyCount(
    String vendorId, {
    bool allowMessageFallback = true,
  }) async {
    if (vendorId.isEmpty) return;
    try {
      // Always re-fetch — stale ticket.updatedAt missed new admin replies (Web parity).
      final response = await _api.dio.get('/support/tickets/vendor/$vendorId');
      final list = _parseList(response.data);
      _tickets = list.map((e) => SupportTicket.fromJson(e)).toList()
        ..sort((a, b) {
          final aTime = a.updatedAt ?? a.createdAt;
          final bTime = b.updatedAt ?? b.createdAt;
          return bTime.compareTo(aTime);
        });
      await _ensureReadStateLoaded(vendorId);
      await _recomputeUnreadAdminReplyCount(
        vendorId,
        allowMessageFallback: allowMessageFallback,
      );
    } catch (_) {
      // Silent poll failures.
    }
  }

  Future<void> markTicketRead(String vendorId, String ticketId) async {
    if (vendorId.isEmpty || ticketId.isEmpty) return;
    await _ensureReadStateLoaded(vendorId);
    _lastReadByTicket[ticketId] = DateTime.now().toUtc();
    await SupportReadStorage.save(vendorId, _lastReadByTicket);
    await _recomputeUnreadAdminReplyCount(vendorId);
  }

  Future<void> markActiveTicketRead(String vendorId) async {
    final ticketId = _activeTicketId;
    if (ticketId == null) return;
    await markTicketRead(vendorId, ticketId);
  }

  Future<void> _ensureReadStateLoaded(String vendorId) async {
    if (_readStateVendorId == vendorId) return;
    _readStateVendorId = vendorId;
    _lastReadByTicket = await SupportReadStorage.load(vendorId);
  }

  Future<void> _recomputeUnreadAdminReplyCount(
    String vendorId, {
    bool allowMessageFallback = true,
  }) async {
    var unread = 0;
    for (final ticket in _tickets.where((t) => !t.isClosed)) {
      final lastRead =
          _lastReadByTicket[ticket.id] ?? DateTime.fromMillisecondsSinceEpoch(0, isUtc: true);
      final latest = ticket.latestMessage;
      if (latest != null) {
        if (latest.isAdmin && latest.createdAt.toUtc().isAfter(lastRead)) {
          unread++;
        }
        continue;
      }

      // Fallback when API omits latestMessage (skip on silent shell polls — N+1).
      if (!allowMessageFallback) continue;
      final ticketUpdated = (ticket.updatedAt ?? ticket.createdAt).toUtc();
      if (!ticketUpdated.isAfter(lastRead)) continue;
      try {
        final response =
            await _api.dio.get('/support/tickets/${ticket.id}/messages');
        final messages = _parseList(response.data)
            .map((e) => SupportMessage.fromJson(e))
            .toList();
        SupportMessage? latestAdmin;
        for (final message in messages.reversed) {
          if (message.isAdmin) {
            latestAdmin = message;
            break;
          }
        }
        if (latestAdmin != null &&
            latestAdmin.createdAt.toUtc().isAfter(lastRead)) {
          unread++;
        }
      } catch (_) {
        // Ignore per-ticket failures during badge refresh.
      }
    }

    if (_unreadAdminReplyCount != unread) {
      _unreadAdminReplyCount = unread;
    }
    notifyListeners();
  }

  Future<bool> openTicket(SupportTicket ticket, {String? vendorId}) async {
    _activeTicketId = ticket.id;
    _activeTicketStatus = ticket.status;
    _messagesLoading = true;
    _error = null;
    notifyListeners();
    try {
      final response =
          await _api.dio.get('/support/tickets/${ticket.id}/messages');
      _messages = _parseList(response.data)
          .map((e) => SupportMessage.fromJson(e))
          .toList();
      if (vendorId != null && vendorId.isNotEmpty) {
        await markTicketRead(vendorId, ticket.id);
      }
      return true;
    } on DioException catch (e) {
      _error = _dioMessage(e, 'Failed to load messages.');
      return false;
    } catch (_) {
      _error = 'Failed to load messages.';
      return false;
    } finally {
      _messagesLoading = false;
      notifyListeners();
    }
  }

  Future<void> refreshMessages() async {
    final ticketId = _activeTicketId;
    if (ticketId == null || ticketId.isEmpty) return;
    try {
      final response =
          await _api.dio.get('/support/tickets/$ticketId/messages');
      _messages = _parseList(response.data)
          .map((e) => SupportMessage.fromJson(e))
          .toList();
      notifyListeners();
    } catch (_) {
      // Silent poll failures.
    }
  }

  Future<void> refreshActiveConversation(String vendorId) async {
    final ticketId = _activeTicketId;
    if (ticketId == null || ticketId.isEmpty || vendorId.isEmpty) return;
    try {
      final results = await Future.wait([
        _api.dio.get('/support/tickets/$ticketId/messages'),
        _api.dio.get('/support/tickets/vendor/$vendorId'),
      ]);
      _messages = _parseList(results[0].data)
          .map((e) => SupportMessage.fromJson(e))
          .toList();
      final tickets = _parseList(results[1].data)
          .map((e) => SupportTicket.fromJson(e))
          .toList();
      SupportTicket? active;
      for (final ticket in tickets) {
        if (ticket.id == ticketId) {
          active = ticket;
          break;
        }
      }
      if (active != null) {
        _activeTicketStatus = active.status;
      }
      notifyListeners();
    } catch (_) {
      // Silent poll failures.
    }
  }

  void startNewConversation() {
    _activeTicketId = null;
    _activeTicketStatus = null;
    _messages = [];
    _forceNextAsNewTicket = true;
    _error = null;
    notifyListeners();
  }

  Future<bool> sendAiMessage({
    required String vendorId,
    required String text,
    String? category,
    List<String>? attachmentUrls,
    bool forceNewTicket = false,
  }) async {
    if (vendorId.isEmpty || text.trim().isEmpty) return false;

    final startNewTicket =
        forceNewTicket || (_forceNextAsNewTicket && (_activeTicketId == null || _activeTicketId!.isEmpty));

    final useAi = shouldUseAiChat(
      ticketId: _activeTicketId,
      ticketStatus: _activeTicketStatus,
      messages: _messages,
      forceNewTicket: startNewTicket,
    );

    final optimistic = SupportMessage(
      id: 'temp-${DateTime.now().millisecondsSinceEpoch}',
      ticketId: _activeTicketId ?? '',
      senderId: vendorId,
      senderType: 'Vendor',
      message: text.trim(),
      createdAt: DateTime.now().toUtc(),
      attachmentUrls: attachmentUrls ?? const [],
    );
    _messages = [..._messages, optimistic];
    _awaitingAi = useAi;
    _sending = true;
    _error = null;
    notifyListeners();

    try {
      if (useAi) {
        final response = await _api.dio.post(
          '/support/ai-chat',
          data: {
            'vendorId': vendorId,
            'message': text.trim(),
            'category': ?category,
            'forceNewTicket':
                startNewTicket && (_activeTicketId == null || _activeTicketId!.isEmpty),
            if (attachmentUrls != null && attachmentUrls.isNotEmpty)
              'attachmentUrls': attachmentUrls,
          },
        );

        if (response.data is! Map) {
          _messages = _messages.where((m) => m.id != optimistic.id).toList();
          _error = 'Unexpected response from support chat.';
          return false;
        }

        final map = Map<String, dynamic>.from(response.data as Map);
        final ticketJson = map['ticket'];
        if (ticketJson is Map) {
          final ticket = SupportTicket.fromJson(
            Map<String, dynamic>.from(ticketJson),
          );
          _activeTicketId = ticket.id;
          _activeTicketStatus = ticket.status;
        }
        _forceNextAsNewTicket = false;
      } else {
        final ticketId = _activeTicketId;
        if (ticketId == null || ticketId.isEmpty) {
          _messages = _messages.where((m) => m.id != optimistic.id).toList();
          _error = 'Missing active support ticket.';
          return false;
        }

        await _api.dio.post(
          '/support/tickets/$ticketId/messages',
          data: {
            'senderId': vendorId,
            'senderType': 'Vendor',
            'message': text.trim(),
            if (attachmentUrls != null && attachmentUrls.isNotEmpty)
              'attachmentUrls': attachmentUrls,
          },
        );
      }

      await refreshActiveConversation(vendorId);
      if (vendorId.isNotEmpty) {
        final ticketId = _activeTicketId;
        if (ticketId != null) {
          await markTicketRead(vendorId, ticketId);
        }
      }
      return true;
    } on DioException catch (e) {
      _messages = _messages.where((m) => m.id != optimistic.id).toList();
      _error = _dioMessage(e, 'Failed to send message.');
      return false;
    } catch (_) {
      _messages = _messages.where((m) => m.id != optimistic.id).toList();
      _error = 'Failed to send message.';
      return false;
    } finally {
      _awaitingAi = false;
      _sending = false;
      notifyListeners();
    }
  }

  Future<SupportUploadResult?> uploadFile({
    required String vendorId,
    required PlatformFile file,
  }) async {
    try {
      final multipart = await multipartFromPlatformFile(file);
      if (multipart == null) {
        _error = 'Could not read the selected file.';
        notifyListeners();
        return null;
      }

      final formData = FormData.fromMap({
        'vendorId': vendorId,
        'file': multipart,
      });
      final response = await _api.dio.post('/support/upload', data: formData);
      if (response.data is Map) {
        return SupportUploadResult.fromJson(
          Map<String, dynamic>.from(response.data as Map),
        );
      }
      return null;
    } on DioException catch (e) {
      _error = _dioMessage(e, 'Failed to upload file.');
      notifyListeners();
      return null;
    } catch (_) {
      _error = 'Failed to upload file.';
      notifyListeners();
      return null;
    }
  }

  List<Map<String, dynamic>> _parseList(dynamic data) {
    if (data is! List) return const [];
    return data
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  String _dioMessage(DioException e, String fallback) {
    final data = e.response?.data;
    if (data is Map) {
      final detail = data['detail'] ?? data['message'] ?? data['title'];
      if (detail != null && detail.toString().trim().isNotEmpty) {
        return detail.toString();
      }
    }
    if (e.type == DioExceptionType.connectionError ||
        e.type == DioExceptionType.connectionTimeout) {
      return 'Cannot reach API. Check network / base URL.';
    }
    return fallback;
  }
}
