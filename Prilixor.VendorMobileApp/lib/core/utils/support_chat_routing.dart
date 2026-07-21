import '../models/support_model.dart';

const supportEscalationMessage = 'Our support team will assist you shortly.';

bool isSupportEscalationMessage(String message) {
  final normalized = message.trim().replaceAll(RegExp(r'\.$'), '').toLowerCase();
  if (normalized.contains('support team will assist')) {
    return true;
  }
  return normalized ==
      supportEscalationMessage.replaceAll(RegExp(r'\.$'), '').toLowerCase();
}

/// After escalation or admin join, vendor messages go to the ticket API only — no AI.
bool shouldUseAiChat({
  required String? ticketId,
  required String? ticketStatus,
  required List<SupportMessage> messages,
  bool forceNewTicket = false,
}) {
  if (forceNewTicket && (ticketId == null || ticketId.isEmpty)) {
    return true;
  }

  if (ticketId == null || ticketId.isEmpty) {
    return true;
  }

  final status = (ticketStatus ?? '').trim().toLowerCase();
  if (status == 'in progress' ||
      status == 'resolved' ||
      status == 'closed') {
    return false;
  }

  if (messages.any((m) => m.isAdmin)) {
    return false;
  }

  if (messages.any((m) => m.isAi && isSupportEscalationMessage(m.message))) {
    return false;
  }

  return true;
}

bool isWaitingForHumanSupport({
  required List<SupportMessage> messages,
  required bool sending,
}) {
  if (messages.isEmpty || sending) return false;
  if (messages.any((m) => m.isAdmin)) return false;
  final hasEscalation =
      messages.any((m) => m.isAi && isSupportEscalationMessage(m.message));
  if (!hasEscalation) return false;
  return messages.last.isVendor;
}
