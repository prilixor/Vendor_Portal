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

  factory NotificationModel.fromJson(Map<String, dynamic> json) {
    return NotificationModel(
      id: json['id'] ?? '',
      title: json['title'] ?? '',
      body: json['body'] ?? '',
      notificationType: json['notificationType'] ?? '',
      relatedOrderId: json['relatedOrderId'],
      createdAt: DateTime.parse(json['createdAt'] ?? DateTime.now().toIso8601String()),
      readAt: json['readAt'] != null ? DateTime.parse(json['readAt']) : null,
    );
  }
}
