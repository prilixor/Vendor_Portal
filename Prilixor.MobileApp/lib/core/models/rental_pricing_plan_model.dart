class RentalPricingPlanModel {
  final String id;
  final String productId;
  final String durationLabel;
  final int durationDays;
  final double billingCycles;
  final double normalPrice;
  final String discountType;
  final double discountValue;
  final double finalRentalPrice;
  final bool isRecommended;
  final bool isActive;
  final int sortOrder;
  final String? rentalDurationIconId;
  final String? iconUrl;
  final String? iconThumbnailUrl;
  final String? valueTier;
  final String? iconName;

  const RentalPricingPlanModel({
    required this.id,
    this.productId = '',
    required this.durationLabel,
    required this.durationDays,
    this.billingCycles = 0,
    required this.normalPrice,
    this.discountType = 'none',
    this.discountValue = 0,
    required this.finalRentalPrice,
    this.isRecommended = false,
    this.isActive = true,
    this.sortOrder = 0,
    this.rentalDurationIconId,
    this.iconUrl,
    this.iconThumbnailUrl,
    this.valueTier,
    this.iconName,
  });

  bool get hasDiscount =>
      discountType != 'none' && discountValue > 0 && normalPrice > finalRentalPrice;

  double get savings => (normalPrice - finalRentalPrice).clamp(0, double.infinity);

  factory RentalPricingPlanModel.fromJson(Map<String, dynamic> json) {
    return RentalPricingPlanModel(
      id: json['id']?.toString() ?? '',
      productId: json['productId']?.toString() ?? '',
      durationLabel: json['durationLabel']?.toString() ?? '',
      durationDays: (json['durationDays'] as num?)?.toInt() ?? 0,
      billingCycles: (json['billingCycles'] as num?)?.toDouble() ?? 0,
      normalPrice: (json['normalPrice'] as num?)?.toDouble() ?? 0,
      discountType: (json['discountType']?.toString() ?? 'none').toLowerCase(),
      discountValue: (json['discountValue'] as num?)?.toDouble() ?? 0,
      finalRentalPrice: (json['finalRentalPrice'] as num?)?.toDouble() ?? 0,
      isRecommended: json['isRecommended'] == true,
      isActive: json['isActive'] != false,
      sortOrder: (json['sortOrder'] as num?)?.toInt() ?? 0,
      rentalDurationIconId: json['rentalDurationIconId']?.toString(),
      iconUrl: json['iconUrl']?.toString(),
      iconThumbnailUrl: json['iconThumbnailUrl']?.toString(),
      valueTier: json['valueTier']?.toString(),
      iconName: json['iconName']?.toString(),
    );
  }
}
