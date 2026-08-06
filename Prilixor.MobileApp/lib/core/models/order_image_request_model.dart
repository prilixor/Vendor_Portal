class OrderImageModel {
  final String id;
  final String orderId;
  final String? requestId;
  final String fileUrl;
  final String? originalFileName;
  final String? contentType;
  final int sortOrder;

  const OrderImageModel({
    required this.id,
    required this.orderId,
    this.requestId,
    required this.fileUrl,
    this.originalFileName,
    this.contentType,
    this.sortOrder = 0,
  });

  factory OrderImageModel.fromJson(Map<String, dynamic> json) {
    return OrderImageModel(
      id: (json['id'] ?? json['Id'] ?? '').toString(),
      orderId: (json['orderId'] ?? json['OrderId'] ?? '').toString(),
      requestId: (json['requestId'] ?? json['RequestId'])?.toString(),
      fileUrl: (json['fileUrl'] ?? json['FileUrl'] ?? '').toString(),
      originalFileName:
          (json['originalFileName'] ?? json['OriginalFileName'])?.toString(),
      contentType: (json['contentType'] ?? json['ContentType'])?.toString(),
      sortOrder: ((json['sortOrder'] ?? json['SortOrder']) as num?)?.toInt() ?? 0,
    );
  }
}

class OrderImageRequestModel {
  final String id;
  final String orderId;
  final String vendorId;
  final String status;
  final String message;
  final List<OrderImageModel> images;

  const OrderImageRequestModel({
    required this.id,
    required this.orderId,
    required this.vendorId,
    required this.status,
    required this.message,
    this.images = const [],
  });

  factory OrderImageRequestModel.fromJson(Map<String, dynamic> json) {
    final imagesRaw = json['images'] ?? json['Images'];
    final images = imagesRaw is List
        ? imagesRaw
            .whereType<Map>()
            .map((e) => OrderImageModel.fromJson(Map<String, dynamic>.from(e)))
            .where((img) => img.id.isNotEmpty && img.fileUrl.isNotEmpty)
            .toList()
        : <OrderImageModel>[];

    return OrderImageRequestModel(
      id: (json['id'] ?? json['Id'] ?? '').toString(),
      orderId: (json['orderId'] ?? json['OrderId'] ?? '').toString(),
      vendorId: (json['vendorId'] ?? json['VendorId'] ?? '').toString(),
      status: (json['status'] ?? json['Status'] ?? '').toString(),
      message: (json['message'] ?? json['Message'] ?? '').toString(),
      images: images,
    );
  }
}
