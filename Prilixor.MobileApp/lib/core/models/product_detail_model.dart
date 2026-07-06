class ProductDetailModel {
  final String id;
  final String title;
  final String vendorName;
  final double vendorRating;
  final String serviceAreaHint;
  final String categoryName;
  final double dailyRent;
  final double monthlyRent;
  final double securityDeposit;
  final bool prescriptionRequired;
  final bool depositRequired;
  final String listingStatus;
  final int availableQuantity;
  final String availabilityStatus;
  final String description;
  final List<String> imageUrls;

  ProductDetailModel({
    required this.id,
    required this.title,
    required this.vendorName,
    required this.vendorRating,
    required this.serviceAreaHint,
    required this.categoryName,
    required this.dailyRent,
    required this.monthlyRent,
    required this.securityDeposit,
    required this.prescriptionRequired,
    required this.depositRequired,
    required this.listingStatus,
    required this.availableQuantity,
    required this.availabilityStatus,
    required this.description,
    required this.imageUrls,
  });

  factory ProductDetailModel.fromJson(Map<String, dynamic> json) {
    return ProductDetailModel(
      id: json['id'] ?? '',
      title: json['title'] ?? '',
      vendorName: json['vendorName'] ?? '',
      vendorRating: (json['vendorRating'] ?? 0).toDouble(),
      serviceAreaHint: json['serviceAreaHint'] ?? '',
      categoryName: json['categoryName'] ?? '',
      dailyRent: (json['dailyRent'] ?? 0).toDouble(),
      monthlyRent: (json['monthlyRent'] ?? 0).toDouble(),
      securityDeposit: (json['securityDeposit'] ?? 0).toDouble(),
      prescriptionRequired: json['prescriptionRequired'] ?? false,
      depositRequired: json['depositRequired'] ?? false,
      listingStatus: json['listingStatus'] ?? '',
      availableQuantity: json['availableQuantity'] ?? 0,
      availabilityStatus: json['availabilityStatus'] ?? '',
      description: json['description'] ?? '',
      imageUrls: List<String>.from(json['imageUrls'] ?? []),
    );
  }

  Map<String, dynamic> getAvailabilityBadge() {
    final s = availabilityStatus.trim().toLowerCase();
    final ls = listingStatus.trim().toLowerCase();
    
    if (ls != 'active' && ls != 'approved') {
      return {'label': 'Unavailable', 'color': 0xFF9E9E9E}; // Colors.grey
    }
    if (s == 'out_of_stock' || availableQuantity <= 0) {
      return {'label': 'Out of stock', 'color': 0xFFF44336}; // Colors.red
    }
    if (availableQuantity == 1) {
      return {'label': 'Only 1 left', 'color': 0xFFEF6C00}; // Colors.orange[800]
    }
    if (s == 'low_stock' || availableQuantity <= 3) {
      return {'label': 'Limited stock', 'color': 0xFFF57C00}; // Colors.orange[700]
    }
    return {'label': 'Available', 'color': 0xFF4CAF50}; // Colors.green
  }
}
