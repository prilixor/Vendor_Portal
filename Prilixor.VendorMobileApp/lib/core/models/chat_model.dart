class ChatSession {
  final String id;
  final String customerId;
  final String customerName;
  final String vendorId;
  final String vendorName;
  final String? orderId;
  final String? orderNumber;
  final String subject;
  final DateTime lastMessageAt;
  final bool isClosed;

  const ChatSession({
    required this.id,
    required this.customerId,
    required this.customerName,
    required this.vendorId,
    required this.vendorName,
    this.orderId,
    this.orderNumber,
    required this.subject,
    required this.lastMessageAt,
    required this.isClosed,
  });

  factory ChatSession.fromJson(Map<String, dynamic> json) {
    return ChatSession(
      id: json['id']?.toString() ?? '',
      customerId: json['customerId']?.toString() ?? '',
      customerName: json['customerName']?.toString() ?? 'Customer',
      vendorId: json['vendorId']?.toString() ?? '',
      vendorName: json['vendorName']?.toString() ?? '',
      orderId: json['orderId']?.toString(),
      orderNumber: json['orderNumber']?.toString(),
      subject: json['subject']?.toString() ?? '',
      lastMessageAt: DateTime.tryParse(json['lastMessageAt']?.toString() ?? '') ??
          DateTime.now(),
      isClosed: json['isClosed'] == true,
    );
  }
}

class ChatMessage {
  final String id;
  final String chatSessionId;
  final String senderType;
  final String text;
  final DateTime sentAt;
  final bool isRead;
  final bool isMe;

  const ChatMessage({
    required this.id,
    required this.chatSessionId,
    required this.senderType,
    required this.text,
    required this.sentAt,
    required this.isRead,
    required this.isMe,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    final senderType = json['senderType']?.toString() ?? '';
    return ChatMessage(
      id: json['id']?.toString() ?? '',
      chatSessionId: json['chatSessionId']?.toString() ?? '',
      senderType: senderType,
      text: (json['messageText'] ?? json['text'])?.toString() ?? '',
      sentAt: DateTime.tryParse(json['sentAt']?.toString() ?? '') ?? DateTime.now(),
      isRead: json['isRead'] == true,
      isMe: senderType.toLowerCase() == 'vendor',
    );
  }
}
