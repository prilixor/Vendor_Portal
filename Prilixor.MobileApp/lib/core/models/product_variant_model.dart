class ProductVariantModel {
  final String id;
  final String productId;
  final String sku;
  final double sizeValue;
  final String sizeUnit;
  final double buyPrice;
  final bool isActive;
  final int? availableQuantity;

  ProductVariantModel({
    required this.id,
    required this.productId,
    required this.sku,
    required this.sizeValue,
    required this.sizeUnit,
    required this.buyPrice,
    required this.isActive,
    this.availableQuantity,
  });

  factory ProductVariantModel.fromJson(Map<String, dynamic> json) {
    return ProductVariantModel(
      id: json['id']?.toString() ?? '',
      productId: json['productId']?.toString() ?? '',
      sku: json['sku'] ?? '',
      sizeValue: (json['sizeValue'] ?? 0).toDouble(),
      sizeUnit: json['sizeUnit'] ?? '',
      buyPrice: (json['buyPrice'] ?? 0).toDouble(),
      isActive: json['isActive'] ?? true,
      availableQuantity: json['availableQuantity'] as int?,
    );
  }

  String get sizeLabel => '$sizeValue $sizeUnit';
}

class VariantInventoryModel {
  final String productVariantId;
  final int availableQuantity;

  VariantInventoryModel({
    required this.productVariantId,
    required this.availableQuantity,
  });

  factory VariantInventoryModel.fromJson(Map<String, dynamic> json) {
    return VariantInventoryModel(
      productVariantId: json['productVariantId']?.toString() ?? '',
      availableQuantity: json['availableQuantity'] ?? 0,
    );
  }
}
