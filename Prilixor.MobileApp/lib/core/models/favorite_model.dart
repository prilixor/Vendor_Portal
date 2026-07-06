class FavoriteModel {
  final String id;
  final String customerId;
  final String vendorProductListingId;
  final DateTime createdAt;

  FavoriteModel({
    required this.id,
    required this.customerId,
    required this.vendorProductListingId,
    required this.createdAt,
  });

  factory FavoriteModel.fromJson(Map<String, dynamic> json) {
    return FavoriteModel(
      id: json['id'] ?? '',
      customerId: json['customerId'] ?? '',
      vendorProductListingId: json['vendorProductListingId'] ?? '',
      createdAt: DateTime.parse(json['createdAt'] ?? DateTime.now().toIso8601String()),
    );
  }
}
