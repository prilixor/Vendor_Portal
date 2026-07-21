class VendorNotification {
  final String id;
  final String vendorId;
  final String notificationType;
  final String title;
  final String message;
  final String channel;
  final String status;
  final DateTime? sentAt;
  final DateTime? readAt;

  const VendorNotification({
    required this.id,
    required this.vendorId,
    required this.notificationType,
    required this.title,
    required this.message,
    required this.channel,
    required this.status,
    this.sentAt,
    this.readAt,
  });

  bool get isUnread => readAt == null;

  VendorNotification copyWith({
    DateTime? readAt,
    bool clearReadAt = false,
    String? status,
  }) {
    return VendorNotification(
      id: id,
      vendorId: vendorId,
      notificationType: notificationType,
      title: title,
      message: message,
      channel: channel,
      status: status ?? this.status,
      sentAt: sentAt,
      readAt: clearReadAt ? null : (readAt ?? this.readAt),
    );
  }

  factory VendorNotification.fromJson(Map<String, dynamic> json) {
    DateTime? parseDt(dynamic v) {
      if (v == null) return null;
      final s = v.toString().trim();
      if (s.isEmpty || s.toLowerCase() == 'null') return null;
      return DateTime.tryParse(s);
    }

    return VendorNotification(
      id: json['id']?.toString() ?? '',
      vendorId: json['vendorId']?.toString() ?? '',
      notificationType: json['notificationType']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      message: (json['message'] ?? json['body'])?.toString() ?? '',
      channel: json['channel']?.toString() ?? 'in_app',
      status: json['status']?.toString() ?? '',
      sentAt: parseDt(json['sentAt'] ?? json['createdAt']),
      readAt: parseDt(json['readAt']),
    );
  }
}
