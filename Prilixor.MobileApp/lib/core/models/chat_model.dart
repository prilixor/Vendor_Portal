class ChatSessionModel {
  final String sessionId;
  final String participantId;
  final String participantName;
  final String? relatedOrderId;
  final String? relatedOrderNumber;
  final String? subject;
  final DateTime lastMessageAt;

  ChatSessionModel({
    required this.sessionId,
    required this.participantId,
    required this.participantName,
    this.relatedOrderId,
    this.relatedOrderNumber,
    this.subject,
    required this.lastMessageAt,
  });

  factory ChatSessionModel.fromJson(Map<String, dynamic> json) {
    return ChatSessionModel(
      sessionId: json['id'] ?? json['sessionId'] ?? '',
      participantId: json['vendorId'] ?? json['participantId'] ?? '',
      participantName: json['vendorName'] ?? json['participantName'] ?? '',
      relatedOrderId: json['orderId'] ?? json['relatedOrderId'],
      relatedOrderNumber: json['orderNumber'] ?? json['relatedOrderNumber'],
      subject: json['subject'] ?? json['lastMessagePreview'],
      lastMessageAt: DateTime.parse(json['lastMessageAt'] ?? DateTime.now().toIso8601String()),
    );
  }
}

class ChatMessageModel {
  final String messageId;
  final String senderId;
  final String senderName;
  final String text;
  final DateTime sentAt;
  final bool isMe;

  ChatMessageModel({
    required this.messageId,
    required this.senderId,
    required this.senderName,
    required this.text,
    required this.sentAt,
    this.isMe = false,
  });

  factory ChatMessageModel.fromJson(Map<String, dynamic> json, String currentUserId) {
    final senderType = json['senderType'] ?? '';
    return ChatMessageModel(
      messageId: json['id'] ?? json['messageId'] ?? '',
      senderId: json['senderId'] ?? '',
      senderName: json['senderName'] ?? '',
      text: json['messageText'] ?? json['text'] ?? '',
      sentAt: DateTime.parse(json['sentAt'] ?? DateTime.now().toIso8601String()),
      isMe: senderType == 'Customer',
    );
  }
}
