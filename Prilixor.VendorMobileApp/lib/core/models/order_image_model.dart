class OrderImage {
  final String id;
  final String orderId;
  final String fileUrl;
  final String? originalFileName;
  final String? contentType;
  final int sortOrder;
  final DateTime? createdAt;

  const OrderImage({
    required this.id,
    required this.orderId,
    required this.fileUrl,
    this.originalFileName,
    this.contentType,
    this.sortOrder = 0,
    this.createdAt,
  });

  factory OrderImage.fromJson(Map<String, dynamic> json) {
    DateTime? created;
    final raw = json['createdAt'] ?? json['CreatedAt'];
    if (raw is String && raw.isNotEmpty) {
      created = DateTime.tryParse(raw);
    }
    return OrderImage(
      id: (json['id'] ?? json['Id'] ?? '').toString(),
      orderId: (json['orderId'] ?? json['OrderId'] ?? '').toString(),
      fileUrl: (json['fileUrl'] ?? json['FileUrl'] ?? '').toString(),
      originalFileName: (json['originalFileName'] ?? json['OriginalFileName'])?.toString(),
      contentType: (json['contentType'] ?? json['ContentType'])?.toString(),
      sortOrder: ((json['sortOrder'] ?? json['SortOrder']) as num?)?.toInt() ?? 0,
      createdAt: created,
    );
  }
}
