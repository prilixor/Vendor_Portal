class PrescriptionFileModel {
  final String id;
  final String orderId;
  final String fileUrl;
  final String? originalFileName;
  final String? contentType;

  const PrescriptionFileModel({
    required this.id,
    required this.orderId,
    required this.fileUrl,
    this.originalFileName,
    this.contentType,
  });

  factory PrescriptionFileModel.fromJson(Map<String, dynamic> json) {
    return PrescriptionFileModel(
      id: json['id']?.toString() ?? '',
      orderId: json['orderId']?.toString() ?? '',
      fileUrl: json['fileUrl']?.toString() ?? '',
      originalFileName: json['originalFileName']?.toString(),
      contentType: json['contentType']?.toString(),
    );
  }

  bool get isImage {
    final type = (contentType ?? '').toLowerCase();
    if (type.startsWith('image/')) return true;
    final name = (originalFileName ?? fileUrl).toLowerCase();
    return name.endsWith('.jpg') ||
        name.endsWith('.jpeg') ||
        name.endsWith('.png') ||
        name.endsWith('.webp');
  }
}
