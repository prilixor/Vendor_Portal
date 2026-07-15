class NotificationModel {
  final String id;
  final String title;
  final String body;
  final String notificationType;
  final String? relatedOrderId;
  final DateTime createdAt;
  final DateTime? readAt;

  NotificationModel({
    required this.id,
    required this.title,
    required this.body,
    required this.notificationType,
    this.relatedOrderId,
    required this.createdAt,
    this.readAt,
  });

  bool get isUnread => readAt == null;

  NotificationModel copyWith({
    String? id,
    String? title,
    String? body,
    String? notificationType,
    String? relatedOrderId,
    DateTime? createdAt,
    DateTime? readAt,
    bool clearReadAt = false,
  }) {
    return NotificationModel(
      id: id ?? this.id,
      title: title ?? this.title,
      body: body ?? this.body,
      notificationType: notificationType ?? this.notificationType,
      relatedOrderId: relatedOrderId ?? this.relatedOrderId,
      createdAt: createdAt ?? this.createdAt,
      readAt: clearReadAt ? null : (readAt ?? this.readAt),
    );
  }

  factory NotificationModel.fromJson(Map<String, dynamic> json) {
    DateTime? parseDt(dynamic v) {
      if (v == null) return null;
      final s = v.toString().trim();
      if (s.isEmpty || s.toLowerCase() == 'null') return null;
      return DateTime.tryParse(s);
    }

    return NotificationModel(
      id: (json['id'] ?? json['Id'])?.toString() ?? '',
      title: (json['title'] ?? json['Title'])?.toString() ?? '',
      body: (json['body'] ?? json['Body'])?.toString() ?? '',
      notificationType: (json['notificationType'] ?? json['NotificationType'])?.toString() ?? '',
      relatedOrderId: (json['relatedOrderId'] ?? json['RelatedOrderId'])?.toString(),
      createdAt: parseDt(json['createdAt'] ?? json['CreatedAt']) ?? DateTime.now(),
      readAt: parseDt(json['readAt'] ?? json['ReadAt']),
    );
  }
}
