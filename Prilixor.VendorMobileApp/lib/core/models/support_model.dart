class SupportTicket {
  final String id;
  final String ticketNumber;
  final String category;
  final String subject;
  final String status;
  final DateTime createdAt;
  final DateTime? updatedAt;
  final SupportMessage? latestMessage;

  const SupportTicket({
    required this.id,
    required this.ticketNumber,
    required this.category,
    required this.subject,
    required this.status,
    required this.createdAt,
    this.updatedAt,
    this.latestMessage,
  });

  factory SupportTicket.fromJson(Map<String, dynamic> json) {
    final latest = json['latestMessage'];
    return SupportTicket(
      id: json['id']?.toString() ?? '',
      ticketNumber: json['ticketNumber']?.toString() ?? '',
      category: json['category']?.toString() ?? '',
      subject: json['subject']?.toString() ?? '',
      status: json['status']?.toString() ?? 'Open',
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
          DateTime.now().toUtc(),
      updatedAt: json['updatedAt'] == null
          ? null
          : DateTime.tryParse(json['updatedAt']?.toString() ?? ''),
      latestMessage: latest is Map
          ? SupportMessage.fromJson(Map<String, dynamic>.from(latest))
          : null,
    );
  }

  bool get isClosed => status.trim().toLowerCase() == 'closed';
}

class SupportMessage {
  final String id;
  final String ticketId;
  final String senderId;
  final String senderType;
  final String message;
  final DateTime createdAt;
  final List<String> attachmentUrls;

  const SupportMessage({
    required this.id,
    required this.ticketId,
    required this.senderId,
    required this.senderType,
    required this.message,
    required this.createdAt,
    this.attachmentUrls = const [],
  });

  factory SupportMessage.fromJson(Map<String, dynamic> json) {
    final attachments = json['attachmentUrls'];
    return SupportMessage(
      id: json['id']?.toString() ?? '',
      ticketId: json['ticketId']?.toString() ?? '',
      senderId: json['senderId']?.toString() ?? '',
      senderType: json['senderType']?.toString() ?? '',
      message: json['message']?.toString() ?? '',
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
          DateTime.now().toUtc(),
      attachmentUrls: attachments is List
          ? attachments.map((e) => e.toString()).toList()
          : const [],
    );
  }

  bool get isVendor => senderType.toLowerCase() == 'vendor';
  bool get isAi => senderType.toLowerCase() == 'ai';
  bool get isAdmin => senderType.toLowerCase() == 'admin';

  String get senderLabel {
    if (isAi) return 'Assistant';
    if (isAdmin) return 'Support Team';
    return 'You';
  }
}

class SupportUploadResult {
  final String fileUrl;
  final String originalFileName;

  const SupportUploadResult({
    required this.fileUrl,
    required this.originalFileName,
  });

  factory SupportUploadResult.fromJson(Map<String, dynamic> json) {
    return SupportUploadResult(
      fileUrl: json['fileUrl']?.toString() ?? '',
      originalFileName: json['originalFileName']?.toString() ??
          json['fileName']?.toString() ??
          'attachment',
    );
  }
}

class SupportQuickReply {
  final String label;
  final String icon;
  final String category;

  const SupportQuickReply({
    required this.label,
    required this.icon,
    required this.category,
  });
}

const supportQuickReplies = <SupportQuickReply>[
  SupportQuickReply(label: 'Product Issue', icon: '📦', category: 'Products'),
  SupportQuickReply(label: 'Account Issue', icon: '👤', category: 'Account'),
  SupportQuickReply(label: 'Document Issue', icon: '📄', category: 'Documents'),
  SupportQuickReply(label: 'Verification Issue', icon: '✅', category: 'Verification'),
  SupportQuickReply(label: 'Inventory Issue', icon: '📊', category: 'Inventory'),
];
