class OrderImage {
  final String id;
  final String orderId;
  final String? requestId;
  final String fileUrl;
  final String? originalFileName;
  final String? contentType;
  final int sortOrder;
  final DateTime? createdAt;

  const OrderImage({
    required this.id,
    required this.orderId,
    this.requestId,
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
      requestId: (json['requestId'] ?? json['RequestId'])?.toString(),
      fileUrl: (json['fileUrl'] ?? json['FileUrl'] ?? '').toString(),
      originalFileName:
          (json['originalFileName'] ?? json['OriginalFileName'])?.toString(),
      contentType: (json['contentType'] ?? json['ContentType'])?.toString(),
      sortOrder: ((json['sortOrder'] ?? json['SortOrder']) as num?)?.toInt() ?? 0,
      createdAt: created,
    );
  }
}

class OrderImageRequest {
  final String id;
  final String orderId;
  final String vendorId;
  final String status;
  final String message;
  final DateTime? requestedAt;
  final List<OrderImage> images;

  const OrderImageRequest({
    required this.id,
    required this.orderId,
    required this.vendorId,
    required this.status,
    required this.message,
    this.requestedAt,
    this.images = const [],
  });

  factory OrderImageRequest.fromJson(Map<String, dynamic> json) {
    DateTime? requested;
    final raw = json['requestedAt'] ?? json['RequestedAt'];
    if (raw is String && raw.isNotEmpty) {
      requested = DateTime.tryParse(raw);
    }
    final imagesRaw = json['images'] ?? json['Images'];
    final images = imagesRaw is List
        ? imagesRaw
            .whereType<Map>()
            .map((e) => OrderImage.fromJson(Map<String, dynamic>.from(e)))
            .where((img) => img.id.isNotEmpty && img.fileUrl.isNotEmpty)
            .toList()
        : <OrderImage>[];

    return OrderImageRequest(
      id: (json['id'] ?? json['Id'] ?? '').toString(),
      orderId: (json['orderId'] ?? json['OrderId'] ?? '').toString(),
      vendorId: (json['vendorId'] ?? json['VendorId'] ?? '').toString(),
      status: (json['status'] ?? json['Status'] ?? '').toString(),
      message: (json['message'] ?? json['Message'] ?? '').toString(),
      requestedAt: requested,
      images: images,
    );
  }
}
