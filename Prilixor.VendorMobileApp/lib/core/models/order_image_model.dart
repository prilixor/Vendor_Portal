class OrderImage {
  final String id;
  final String orderId;
  final String? requestId;
  final String? optionId;
  final String fileUrl;
  final String? originalFileName;
  final String? contentType;
  final int sortOrder;
  final DateTime? createdAt;

  const OrderImage({
    required this.id,
    required this.orderId,
    this.requestId,
    this.optionId,
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
      optionId: (json['optionId'] ?? json['OptionId'])?.toString(),
      fileUrl: (json['fileUrl'] ?? json['FileUrl'] ?? '').toString(),
      originalFileName:
          (json['originalFileName'] ?? json['OriginalFileName'])?.toString(),
      contentType: (json['contentType'] ?? json['ContentType'])?.toString(),
      sortOrder: ((json['sortOrder'] ?? json['SortOrder']) as num?)?.toInt() ?? 0,
      createdAt: created,
    );
  }

  OrderImage copyWith({String? fileUrl}) {
    return OrderImage(
      id: id,
      orderId: orderId,
      requestId: requestId,
      optionId: optionId,
      fileUrl: fileUrl ?? this.fileUrl,
      originalFileName: originalFileName,
      contentType: contentType,
      sortOrder: sortOrder,
      createdAt: createdAt,
    );
  }
}

OrderImage? imageAtSlot(List<OrderImage> photos, int slot) {
  for (final photo in photos) {
    if (photo.sortOrder == slot) return photo;
  }
  return null;
}

class OrderImageOption {
  final String id;
  final int optionNumber;
  final String label;
  final String? description;
  final List<OrderImage> images;

  const OrderImageOption({
    required this.id,
    required this.optionNumber,
    required this.label,
    this.description,
    this.images = const [],
  });

  factory OrderImageOption.fromJson(Map<String, dynamic> json) {
    final imagesRaw = json['images'] ?? json['Images'];
    final images = imagesRaw is List
        ? imagesRaw
            .whereType<Map>()
            .map((e) => OrderImage.fromJson(Map<String, dynamic>.from(e)))
            .where((img) => img.id.isNotEmpty && img.fileUrl.isNotEmpty)
            .toList()
        : <OrderImage>[];
    final number = ((json['optionNumber'] ?? json['OptionNumber']) as num?)?.toInt() ?? 0;
    final label = (json['label'] ?? json['Label'])?.toString().trim();
    return OrderImageOption(
      id: (json['id'] ?? json['Id'] ?? '').toString(),
      optionNumber: number,
      label: (label == null || label.isEmpty) ? 'Option $number' : label,
      description: (json['description'] ?? json['Description'])?.toString(),
      images: images,
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
  final List<OrderImageOption> options;
  final int optionCount;
  final int maxImagesPerOption;
  final int maxDescriptionLength;
  final String? selectedOptionId;

  const OrderImageRequest({
    required this.id,
    required this.orderId,
    required this.vendorId,
    required this.status,
    required this.message,
    this.requestedAt,
    this.images = const [],
    this.options = const [],
    this.optionCount = 3,
    this.maxImagesPerOption = 3,
    this.maxDescriptionLength = 500,
    this.selectedOptionId,
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
    final optionsRaw = json['options'] ?? json['Options'];
    final options = optionsRaw is List
        ? optionsRaw
            .whereType<Map>()
            .map((e) => OrderImageOption.fromJson(Map<String, dynamic>.from(e)))
            .where((o) => o.id.isNotEmpty)
            .toList()
        : <OrderImageOption>[];

    return OrderImageRequest(
      id: (json['id'] ?? json['Id'] ?? '').toString(),
      orderId: (json['orderId'] ?? json['OrderId'] ?? '').toString(),
      vendorId: (json['vendorId'] ?? json['VendorId'] ?? '').toString(),
      status: (json['status'] ?? json['Status'] ?? '').toString(),
      message: (json['message'] ?? json['Message'] ?? '').toString(),
      requestedAt: requested,
      images: images,
      options: options,
      optionCount: ((json['optionCount'] ?? json['OptionCount']) as num?)?.toInt() ?? 3,
      maxImagesPerOption:
          ((json['maxImagesPerOption'] ?? json['MaxImagesPerOption']) as num?)?.toInt() ?? 3,
      maxDescriptionLength:
          ((json['maxDescriptionLength'] ?? json['MaxDescriptionLength']) as num?)?.toInt() ?? 500,
      selectedOptionId: (json['selectedOptionId'] ?? json['SelectedOptionId'])?.toString(),
    );
  }
}

OrderImageRequest reuseOrderImageUrls(OrderImageRequest previous, OrderImageRequest next) {
  final urls = <String, String>{
    for (final photo in previous.images) photo.id: photo.fileUrl,
  };
  for (final option in previous.options) {
    for (final photo in option.images) {
      urls.putIfAbsent(photo.id, () => photo.fileUrl);
    }
  }
  List<OrderImage> keep(List<OrderImage> photos) => [
        for (final photo in photos)
          urls.containsKey(photo.id) ? photo.copyWith(fileUrl: urls[photo.id]) : photo,
      ];
  return OrderImageRequest(
    id: next.id,
    orderId: next.orderId,
    vendorId: next.vendorId,
    status: next.status,
    message: next.message,
    requestedAt: next.requestedAt,
    images: keep(next.images),
    options: [
      for (final option in next.options)
        OrderImageOption(
          id: option.id,
          optionNumber: option.optionNumber,
          label: option.label,
          description: option.description,
          images: keep(option.images),
        ),
    ],
    optionCount: next.optionCount,
    maxImagesPerOption: next.maxImagesPerOption,
    maxDescriptionLength: next.maxDescriptionLength,
    selectedOptionId: next.selectedOptionId,
  );
}
