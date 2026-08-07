import '../utils/media_url.dart';

class ProductModel {
  final String id;
  final String title;
  final String vendorName;
  final double vendorRating;
  final String serviceAreaHint;
  final String categoryName;
  final double dailyRent;
  final double weeklyRent;
  final double monthlyRent;
  final double securityDeposit;
  final bool prescriptionRequired;
  final bool depositRequired;
  final String listingStatus;
  final int availableQuantity;
  final int productTotalAvailableQuantity;
  final String availabilityStatus;
  final String? primaryImageUrl;
  final double? buyPrice;
  final bool isRentEnabled;
  final bool isBuyEnabled;
  final bool isChemical;
  final String? baseUnit;

  ProductModel({
    required this.id,
    required this.title,
    required this.vendorName,
    required this.vendorRating,
    required this.serviceAreaHint,
    required this.categoryName,
    required this.dailyRent,
    this.weeklyRent = 0,
    required this.monthlyRent,
    required this.securityDeposit,
    required this.prescriptionRequired,
    required this.depositRequired,
    required this.listingStatus,
    required this.availableQuantity,
    required this.productTotalAvailableQuantity,
    required this.availabilityStatus,
    this.primaryImageUrl,
    this.buyPrice,
    this.isRentEnabled = true,
    this.isBuyEnabled = false,
    this.isChemical = false,
    this.baseUnit,
  });

  factory ProductModel.fromJson(Map<String, dynamic> json) {
    return ProductModel(
      id: json['id']?.toString() ?? '',
      title: json['title'] ?? '',
      vendorName: json['vendorName'] ?? '',
      vendorRating: (json['vendorRating'] ?? 0).toDouble(),
      serviceAreaHint: json['serviceAreaHint'] ?? '',
      categoryName: json['categoryName'] ?? '',
      dailyRent: (json['dailyRent'] ?? 0).toDouble(),
      weeklyRent: (json['weeklyRent'] ?? 0).toDouble(),
      monthlyRent: (json['monthlyRent'] ?? 0).toDouble(),
      securityDeposit: (json['securityDeposit'] ?? 0).toDouble(),
      prescriptionRequired: json['prescriptionRequired'] ?? false,
      depositRequired: json['depositRequired'] ?? false,
      listingStatus: json['listingStatus'] ?? '',
      availableQuantity: json['availableQuantity'] ?? 0,
      productTotalAvailableQuantity: json['productTotalAvailableQuantity'] ?? 0,
      availabilityStatus: json['availabilityStatus'] ?? '',
      primaryImageUrl: resolveItemImageUrl(json: json),
      buyPrice: json['buyPrice'] != null ? (json['buyPrice'] as num).toDouble() : null,
      isRentEnabled: json['isRentEnabled'] ?? true,
      isBuyEnabled: json['isBuyEnabled'] ?? false,
      isChemical: json['isChemical'] ?? false,
      baseUnit: json['baseUnit'],
    );
  }

  Map<String, dynamic>? getAvailabilityBadge() {
    final s = availabilityStatus.trim().toLowerCase();
    final ls = listingStatus.trim().toLowerCase();

    if (ls != 'active' && ls != 'approved') {
      return {'label': 'Unavailable', 'color': 0xFF9E9E9E};
    }
    if (availableQuantity <= 0 && productTotalAvailableQuantity > 0) {
      return {'label': 'Out here', 'color': 0xFFFF5722};
    }
    if (s == 'out_of_stock' || availableQuantity <= 0) {
      return {'label': 'Out of stock', 'color': 0xFFF44336};
    }
    if (availableQuantity == 1) {
      return {'label': 'Only 1 left', 'color': 0xFFEF6C00};
    }
    if (s == 'low_stock' || availableQuantity <= 3) {
      return {'label': 'Low stock', 'color': 0xFFF57C00};
    }
    // In-stock / available: no badge per product requirement
    return null;
  }
}
