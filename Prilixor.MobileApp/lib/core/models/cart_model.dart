import '../utils/media_url.dart';
import '../utils/rental_period.dart';

class CartLineModel {
  final String listingId;
  final String title;
  final String? vendorName;
  String? primaryImageUrl;
  final double dailyRent;
  final double weeklyRent;
  final double monthlyRent;
  final double securityDeposit;
  int quantity;
  /// Period count for [rentalPeriodUnit] (kept as rentalDays for API parity).
  int rentalDays;
  String rentalPeriodUnit;
  String orderType; // 'rent' or 'buy'
  final bool prescriptionRequired;
  final String? productVariantId;
  final double? buyPrice;
  final bool isBuyEnabled;

  /// Admin duration plan snapshot (when listing has rentalPricingPlans).
  String? rentalPricingPlanId;
  String? rentalDurationLabel;
  int? rentalDurationDays;
  double? rentalNormalPrice;
  String? rentalDiscountType;
  double? rentalDiscountValue;
  double? rentalFinalPrice;

  CartLineModel({
    required this.listingId,
    required this.title,
    this.vendorName,
    this.primaryImageUrl,
    required this.dailyRent,
    this.weeklyRent = 0,
    this.monthlyRent = 0,
    required this.securityDeposit,
    this.quantity = 1,
    this.rentalDays = 1,
    this.rentalPeriodUnit = defaultUiRentalUnit,
    this.orderType = 'rent',
    this.prescriptionRequired = false,
    this.productVariantId,
    this.buyPrice,
    this.isBuyEnabled = false,
    this.rentalPricingPlanId,
    this.rentalDurationLabel,
    this.rentalDurationDays,
    this.rentalNormalPrice,
    this.rentalDiscountType,
    this.rentalDiscountValue,
    this.rentalFinalPrice,
  });

  /// Unique key for cart line (listing + packaging size).
  String get lineKey => '$listingId|${productVariantId ?? ''}';

  bool get usesPricingPlan =>
      orderType == 'rent' &&
      rentalPricingPlanId != null &&
      rentalPricingPlanId!.isNotEmpty &&
      rentalFinalPrice != null;

  double get lineTotal {
    if (orderType == 'buy') {
      final unit = buyPrice ?? (dailyRent * 30);
      return unit * quantity;
    }
    if (usesPricingPlan) {
      return (rentalFinalPrice ?? 0) * (quantity < 1 ? 1 : quantity);
    }
    return estimateRent(
      rentalPeriodUnit,
      rentalDays,
      quantity,
      dailyRent: dailyRent,
      weeklyRent: weeklyRent,
      monthlyRent: monthlyRent,
    );
  }

  void applyPricingPlan({
    required String planId,
    required String durationLabel,
    required int durationDays,
    required double normalPrice,
    required String discountType,
    required double discountValue,
    required double finalPrice,
  }) {
    rentalPricingPlanId = planId;
    rentalDurationLabel = durationLabel;
    rentalDurationDays = durationDays;
    rentalNormalPrice = normalPrice;
    rentalDiscountType = discountType;
    rentalDiscountValue = discountValue;
    rentalFinalPrice = finalPrice;
    rentalDays = durationDays < 1 ? 1 : durationDays;
    rentalPeriodUnit = rentalUnitDay;
  }

  void clearPricingPlan() {
    rentalPricingPlanId = null;
    rentalDurationLabel = null;
    rentalDurationDays = null;
    rentalNormalPrice = null;
    rentalDiscountType = null;
    rentalDiscountValue = null;
    rentalFinalPrice = null;
  }

  Map<String, dynamic> toJson() {
    return {
      'listingId': listingId,
      'title': title,
      'vendorName': vendorName,
      'primaryImageUrl': primaryImageUrl,
      'dailyRent': dailyRent,
      'weeklyRent': weeklyRent,
      'monthlyRent': monthlyRent,
      'securityDeposit': securityDeposit,
      'quantity': quantity,
      'rentalDays': rentalDays,
      'rentalPeriodUnit': rentalPeriodUnit,
      'orderType': orderType,
      'prescriptionRequired': prescriptionRequired,
      'productVariantId': productVariantId,
      'buyPrice': buyPrice,
      'isBuyEnabled': isBuyEnabled,
      'rentalPricingPlanId': rentalPricingPlanId,
      'rentalDurationLabel': rentalDurationLabel,
      'rentalDurationDays': rentalDurationDays,
      'rentalNormalPrice': rentalNormalPrice,
      'rentalDiscountType': rentalDiscountType,
      'rentalDiscountValue': rentalDiscountValue,
      'rentalFinalPrice': rentalFinalPrice,
    };
  }

  factory CartLineModel.fromJson(Map<String, dynamic> json) {
    final orderType = json['orderType'] == 'buy' ? 'buy' : 'rent';
    return CartLineModel(
      listingId: json['listingId'],
      title: json['title'],
      vendorName: json['vendorName'],
      primaryImageUrl: resolveItemImageUrl(
        primaryImageUrl: json['primaryImageUrl']?.toString(),
        listingPrimaryImageUrl: json['listingPrimaryImageUrl']?.toString(),
        primaryThumbnailUrl: json['primaryThumbnailUrl']?.toString(),
        thumbnailUrl: json['thumbnailUrl']?.toString(),
        json: json,
      ),
      dailyRent: (json['dailyRent'] as num).toDouble(),
      weeklyRent: (json['weeklyRent'] as num?)?.toDouble() ?? 0,
      monthlyRent: (json['monthlyRent'] as num?)?.toDouble() ?? 0,
      securityDeposit: (json['securityDeposit'] as num).toDouble(),
      quantity: json['quantity'] ?? 1,
      rentalDays: orderType == 'buy' ? 0 : (json['rentalDays'] ?? 1),
      rentalPeriodUnit: orderType == 'buy'
          ? rentalUnitDay
          : (json.containsKey('rentalPeriodUnit')
              ? normalizeRentalUnit(json['rentalPeriodUnit']?.toString())
              : rentalUnitDay),
      orderType: orderType,
      prescriptionRequired: json['prescriptionRequired'] ?? false,
      productVariantId: json['productVariantId'],
      buyPrice: (json['buyPrice'] as num?)?.toDouble(),
      isBuyEnabled: json['isBuyEnabled'] == true,
      rentalPricingPlanId: json['rentalPricingPlanId']?.toString(),
      rentalDurationLabel: json['rentalDurationLabel']?.toString(),
      rentalDurationDays: (json['rentalDurationDays'] as num?)?.toInt(),
      rentalNormalPrice: (json['rentalNormalPrice'] as num?)?.toDouble(),
      rentalDiscountType: json['rentalDiscountType']?.toString(),
      rentalDiscountValue: (json['rentalDiscountValue'] as num?)?.toDouble(),
      rentalFinalPrice: (json['rentalFinalPrice'] as num?)?.toDouble(),
    );
  }
}
