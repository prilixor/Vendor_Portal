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
  });

  /// Unique key for cart line (listing + packaging size).
  String get lineKey => '$listingId|${productVariantId ?? ''}';

  double get lineTotal {
    if (orderType == 'buy') {
      final unit = buyPrice ?? (dailyRent * 30);
      return unit * quantity;
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
              : rentalUnitDay), // legacy local carts were day-based
      orderType: orderType,
      prescriptionRequired: json['prescriptionRequired'] ?? false,
      productVariantId: json['productVariantId'],
      buyPrice: (json['buyPrice'] as num?)?.toDouble(),
      isBuyEnabled: json['isBuyEnabled'] == true || (json['buyPrice'] as num?) != null,
    );
  }
}
