class OrderImageModel {
  final String id;
  final String orderId;
  final String? requestId;
  final String? optionId;
  final String fileUrl;
  final String? originalFileName;
  final String? contentType;
  final int sortOrder;

  const OrderImageModel({
    required this.id,
    required this.orderId,
    this.requestId,
    this.optionId,
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
      optionId: (json['optionId'] ?? json['OptionId'])?.toString(),
      fileUrl: (json['fileUrl'] ?? json['FileUrl'] ?? '').toString(),
      originalFileName:
          (json['originalFileName'] ?? json['OriginalFileName'])?.toString(),
      contentType: (json['contentType'] ?? json['ContentType'])?.toString(),
      sortOrder: ((json['sortOrder'] ?? json['SortOrder']) as num?)?.toInt() ?? 0,
    );
  }
}

class OrderImageOptionModel {
  final String id;
  final int optionNumber;
  final String label;
  final String? description;
  final List<OrderImageModel> images;

  const OrderImageOptionModel({
    required this.id,
    required this.optionNumber,
    required this.label,
    this.description,
    this.images = const [],
  });

  factory OrderImageOptionModel.fromJson(Map<String, dynamic> json) {
    final imagesRaw = json['images'] ?? json['Images'];
    final images = imagesRaw is List
        ? imagesRaw
            .whereType<Map>()
            .map((e) => OrderImageModel.fromJson(Map<String, dynamic>.from(e)))
            .where((img) => img.id.isNotEmpty && img.fileUrl.isNotEmpty)
            .toList()
        : <OrderImageModel>[];
    final number = ((json['optionNumber'] ?? json['OptionNumber']) as num?)?.toInt() ?? 0;
    final label = (json['label'] ?? json['Label'])?.toString().trim();
    return OrderImageOptionModel(
      id: (json['id'] ?? json['Id'] ?? '').toString(),
      optionNumber: number,
      label: (label == null || label.isEmpty) ? 'Option $number' : label,
      description: (json['description'] ?? json['Description'])?.toString(),
      images: images,
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
  final List<OrderImageOptionModel> options;

  const OrderImageRequestModel({
    required this.id,
    required this.orderId,
    required this.vendorId,
    required this.status,
    required this.message,
    this.images = const [],
    this.options = const [],
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
    final optionsRaw = json['options'] ?? json['Options'];
    final options = optionsRaw is List
        ? optionsRaw
            .whereType<Map>()
            .map((e) => OrderImageOptionModel.fromJson(Map<String, dynamic>.from(e)))
            .where((o) => o.id.isNotEmpty)
            .toList()
        : <OrderImageOptionModel>[];

    return OrderImageRequestModel(
      id: (json['id'] ?? json['Id'] ?? '').toString(),
      orderId: (json['orderId'] ?? json['OrderId'] ?? '').toString(),
      vendorId: (json['vendorId'] ?? json['VendorId'] ?? '').toString(),
      status: (json['status'] ?? json['Status'] ?? '').toString(),
      message: (json['message'] ?? json['Message'] ?? '').toString(),
      images: images,
      options: options,
    );
  }
}
