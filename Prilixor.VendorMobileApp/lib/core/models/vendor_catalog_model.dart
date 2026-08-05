enum ListingUiStatus { draft, active, inactive }

ListingUiStatus normalizeListingStatus(String raw) {
  final s = raw.trim().toLowerCase();
  if (s == 'approved' || s == 'active') return ListingUiStatus.active;
  if (s == 'inactive' || s == 'blocked' || s == 'rejected') {
    return ListingUiStatus.inactive;
  }
  return ListingUiStatus.draft;
}

String listingStatusToApi(ListingUiStatus status) {
  switch (status) {
    case ListingUiStatus.active:
      return 'active';
    case ListingUiStatus.inactive:
      return 'inactive';
    case ListingUiStatus.draft:
      return 'draft';
  }
}

class VendorCategory {
  final String id;
  final String name;
  final bool isChemical;

  const VendorCategory({
    required this.id,
    required this.name,
    this.isChemical = false,
  });

  factory VendorCategory.fromJson(Map<String, dynamic> json) {
    return VendorCategory(
      id: json['id']?.toString() ?? '',
      name: json['categoryName']?.toString() ?? 'Unknown',
      isChemical: json['isChemical'] == true,
    );
  }
}

class ProductVariant {
  final String? id;
  final String sku;
  final double sizeValue;
  final String sizeUnit;
  final double vendorPrice;
  final double buyPrice;
  final bool isActive;

  const ProductVariant({
    this.id,
    required this.sku,
    required this.sizeValue,
    required this.sizeUnit,
    required this.vendorPrice,
    required this.buyPrice,
    this.isActive = true,
  });

  factory ProductVariant.fromJson(Map<String, dynamic> json) {
    return ProductVariant(
      id: json['id']?.toString(),
      sku: json['sku']?.toString() ?? '',
      sizeValue: _toDouble(json['sizeValue']),
      sizeUnit: json['sizeUnit']?.toString() ?? '',
      vendorPrice: _toDouble(json['vendorPrice']),
      buyPrice: _toDouble(json['buyPrice']),
      isActive: json['isActive'] != false,
    );
  }

  String get label => '$sizeValue $sizeUnit'.trim();
}

class CatalogProduct {
  final String id;
  final String categoryId;
  final String productName;
  final double dailyRent;
  final double weeklyRent;
  final double monthlyRent;
  final double securityDeposit;
  final double? buyPrice;
  final double vendorDailyRent;
  final double? vendorBuyPrice;
  final double gstPercent;
  final bool isRentEnabled;
  final bool isBuyEnabled;
  final String? baseUnit;
  final String? casNumber;
  final String? chemicalFormula;
  final List<ProductVariant> variants;

  const CatalogProduct({
    required this.id,
    required this.categoryId,
    required this.productName,
    required this.dailyRent,
    this.weeklyRent = 0,
    required this.monthlyRent,
    required this.securityDeposit,
    this.buyPrice,
    this.vendorDailyRent = 0,
    this.vendorBuyPrice,
    this.gstPercent = 0,
    this.isRentEnabled = true,
    this.isBuyEnabled = false,
    this.baseUnit,
    this.casNumber,
    this.chemicalFormula,
    this.variants = const [],
  });

  factory CatalogProduct.fromJson(Map<String, dynamic> json) {
    final variantsRaw = json['variants'];
    final variants = variantsRaw is List
        ? variantsRaw
            .whereType<Map>()
            .map((e) => ProductVariant.fromJson(Map<String, dynamic>.from(e)))
            .toList()
        : <ProductVariant>[];

    return CatalogProduct(
      id: json['id']?.toString() ?? '',
      categoryId: json['categoryId']?.toString() ?? '',
      productName: json['productName']?.toString() ?? 'Unknown',
      dailyRent: _toDouble(json['dailyRent']),
      weeklyRent: _toDouble(json['weeklyRent']),
      monthlyRent: _toDouble(json['monthlyRent']),
      securityDeposit: _toDouble(json['securityDeposit']),
      buyPrice: json['buyPrice'] == null ? null : _toDouble(json['buyPrice']),
      vendorDailyRent: _toDouble(json['vendorDailyRent']),
      vendorBuyPrice:
          json['vendorBuyPrice'] == null ? null : _toDouble(json['vendorBuyPrice']),
      gstPercent: _toDouble(json['gstPercent']),
      isRentEnabled: json['isRentEnabled'] != false,
      isBuyEnabled: json['isBuyEnabled'] == true,
      baseUnit: json['baseUnit']?.toString(),
      casNumber: json['casNumber']?.toString(),
      chemicalFormula: json['chemicalFormula']?.toString(),
      variants: variants,
    );
  }

  bool get isChemicalProduct =>
      baseUnit != null ||
      casNumber != null ||
      chemicalFormula != null ||
      variants.isNotEmpty;
}

class VendorProductListing {
  final String id;
  final String vendorId;
  final String productId;
  final String listingTitle;
  final double dailyRent;
  final double weeklyRent;
  final double monthlyRent;
  final double securityDeposit;
  final int availableQuantity;
  final String listingStatus;
  final int favoriteCount;
  final bool isChemical;

  const VendorProductListing({
    required this.id,
    required this.vendorId,
    required this.productId,
    required this.listingTitle,
    required this.dailyRent,
    this.weeklyRent = 0,
    required this.monthlyRent,
    required this.securityDeposit,
    required this.availableQuantity,
    required this.listingStatus,
    this.favoriteCount = 0,
    this.isChemical = false,
  });

  factory VendorProductListing.fromJson(Map<String, dynamic> json) {
    return VendorProductListing(
      id: json['id']?.toString() ?? '',
      vendorId: json['vendorId']?.toString() ?? '',
      productId: json['productId']?.toString() ?? '',
      listingTitle: json['listingTitle']?.toString() ?? '',
      dailyRent: _toDouble(json['dailyRent']),
      weeklyRent: _toDouble(json['weeklyRent']),
      monthlyRent: _toDouble(json['monthlyRent']),
      securityDeposit: _toDouble(json['securityDeposit']),
      availableQuantity: _toInt(json['availableQuantity']),
      listingStatus: json['listingStatus']?.toString() ?? 'draft',
      favoriteCount: _toInt(json['favoriteCount']),
      isChemical: json['isChemical'] == true,
    );
  }
}

class VendorListingRow {
  final VendorProductListing listing;
  final String categoryName;
  final String productName;
  final String categoryId;
  final bool isChemical;
  final int quantity;
  final ListingUiStatus status;
  final double? buyPriceMin;
  final double? buyPriceMax;
  final String? primaryImageUrl;

  const VendorListingRow({
    required this.listing,
    required this.categoryName,
    required this.productName,
    required this.categoryId,
    required this.isChemical,
    required this.quantity,
    required this.status,
    this.buyPriceMin,
    this.buyPriceMax,
    this.primaryImageUrl,
  });
}

class VendorInventorySnapshot {
  final String listingId;
  final int total;
  final int available;
  final int reserved;
  final int rented;
  final int blocked;

  const VendorInventorySnapshot({
    required this.listingId,
    this.total = 0,
    this.available = 0,
    this.reserved = 0,
    this.rented = 0,
    this.blocked = 0,
  });
}

class VariantInventoryRow {
  final String id;
  final String productVariantId;
  final String sku;
  final double sizeValue;
  final String sizeUnit;
  final int totalQuantity;
  final int availableQuantity;
  final int reservedQuantity;

  const VariantInventoryRow({
    required this.id,
    required this.productVariantId,
    required this.sku,
    required this.sizeValue,
    required this.sizeUnit,
    required this.totalQuantity,
    required this.availableQuantity,
    required this.reservedQuantity,
  });

  factory VariantInventoryRow.fromJson(Map<String, dynamic> json) {
    return VariantInventoryRow(
      id: json['id']?.toString() ?? '',
      productVariantId: json['productVariantId']?.toString() ?? '',
      sku: json['sku']?.toString() ?? '',
      sizeValue: _toDouble(json['sizeValue']),
      sizeUnit: json['sizeUnit']?.toString() ?? '',
      totalQuantity: _toInt(json['totalQuantity']),
      availableQuantity: _toInt(json['availableQuantity']),
      reservedQuantity: _toInt(json['reservedQuantity']),
    );
  }

  String get label => '$sizeValue $sizeUnit'.trim();
}

class InventoryRecord {
  final String listingId;
  final String productName;
  final String? catalogProductId;
  final bool isChemical;
  final int total;
  final int available;
  final int reserved;
  final int rented;
  final int blocked;

  const InventoryRecord({
    required this.listingId,
    required this.productName,
    this.catalogProductId,
    this.isChemical = false,
    this.total = 0,
    this.available = 0,
    this.reserved = 0,
    this.rented = 0,
    this.blocked = 0,
  });

  double get utilization {
    if (total <= 0) return 0;
    return ((rented + reserved) / total) * 100;
  }
}

class InventoryMovement {
  final String id;
  final String listingId;
  final String productName;
  final String type;
  final int quantity;
  final String reference;
  final DateTime timestamp;

  const InventoryMovement({
    required this.id,
    required this.listingId,
    required this.productName,
    required this.type,
    required this.quantity,
    required this.reference,
    required this.timestamp,
  });

  factory InventoryMovement.fromJson({
    required Map<String, dynamic> json,
    required String listingId,
    required String productName,
  }) {
    return InventoryMovement(
      id: json['id']?.toString() ?? '',
      listingId: listingId,
      productName: productName,
      type: json['movementType']?.toString() ?? '',
      quantity: _toInt(json['quantity']),
      reference: json['referenceType']?.toString() ??
          json['referenceId']?.toString() ??
          '-',
      timestamp: DateTime.tryParse(json['eventAt']?.toString() ?? '') ??
          DateTime.now().toUtc(),
    );
  }

  String get typeLabel {
    switch (type.toLowerCase()) {
      case 'stock_added':
      case 'in':
        return 'Stock Added';
      case 'stock_removed':
      case 'out':
        return 'Stock Removed';
      case 'reserved':
        return 'Reserved';
      case 'reservation_released':
      case 'released':
        return 'Released';
      case 'rented':
        return 'Rented';
      case 'returned':
        return 'Returned';
      case 'blocked':
        return 'Blocked';
      case 'unblocked':
        return 'Unblocked';
      case 'corrected':
        return 'Corrected';
      default:
        return type.replaceAll('_', ' ');
    }
  }
}

class ChemicalVariantStockRow {
  final String productVariantId;
  final String sku;
  final String sizeLabel;
  int total;
  int reserved;
  int available;

  ChemicalVariantStockRow({
    required this.productVariantId,
    required this.sku,
    required this.sizeLabel,
    required this.total,
    required this.reserved,
    required this.available,
  });

  factory ChemicalVariantStockRow.fromVariantInventory(VariantInventoryRow row) {
    return ChemicalVariantStockRow(
      productVariantId: row.productVariantId,
      sku: row.sku,
      sizeLabel: row.label,
      total: row.totalQuantity,
      reserved: row.reservedQuantity,
      available: row.availableQuantity,
    );
  }

  factory ChemicalVariantStockRow.fromCatalogVariant(ProductVariant variant) {
    return ChemicalVariantStockRow(
      productVariantId: variant.id ?? '',
      sku: variant.sku,
      sizeLabel: variant.label,
      total: 0,
      reserved: 0,
      available: 0,
    );
  }

  void setTotal(int nextTotal) {
    total = nextTotal.clamp(0, 1 << 30);
    reserved = reserved.clamp(0, total);
    available = (total - reserved).clamp(0, 1 << 30);
  }
}

class VendorProductImage {
  final String id;
  final String imageUrl;
  final String? thumbnailUrl;
  final bool isPrimary;
  final int displayOrder;

  const VendorProductImage({
    required this.id,
    required this.imageUrl,
    this.thumbnailUrl,
    this.isPrimary = false,
    this.displayOrder = 0,
  });

  /// Prefer thumbnail for list/grid cards; fall back to full image.
  String get displayUrl {
    final thumb = thumbnailUrl?.trim();
    if (thumb != null && thumb.isNotEmpty) return thumb;
    return imageUrl;
  }

  factory VendorProductImage.fromJson(Map<String, dynamic> json) {
    return VendorProductImage(
      id: json['id']?.toString() ?? '',
      imageUrl: json['imageUrl']?.toString() ?? '',
      thumbnailUrl: json['thumbnailUrl']?.toString(),
      isPrimary: json['isPrimary'] == true,
      displayOrder: _toInt(json['displayOrder']),
    );
  }
}

class VendorListingDocument {
  final String id;
  final String vendorProductListingId;
  final String documentType;
  final String fileUrl;
  final String verificationStatus;
  final String? rejectionReason;
  final String? verifiedAt;

  const VendorListingDocument({
    required this.id,
    required this.vendorProductListingId,
    required this.documentType,
    required this.fileUrl,
    this.verificationStatus = 'pending',
    this.rejectionReason,
    this.verifiedAt,
  });

  factory VendorListingDocument.fromJson(Map<String, dynamic> json) {
    return VendorListingDocument(
      id: json['id']?.toString() ?? '',
      vendorProductListingId: json['vendorProductListingId']?.toString() ?? '',
      documentType: json['documentType']?.toString() ?? '',
      fileUrl: json['fileUrl']?.toString() ?? '',
      verificationStatus: json['verificationStatus']?.toString() ?? 'pending',
      rejectionReason: json['rejectionReason']?.toString(),
      verifiedAt: json['verifiedAt']?.toString(),
    );
  }
}

class VendorProductAsset {
  final String id;
  final String listingId;
  final String assetTag;
  final String status;
  final String? condition;
  final String? productVariantId;
  final String? variantLabel;

  const VendorProductAsset({
    required this.id,
    required this.listingId,
    required this.assetTag,
    required this.status,
    this.condition,
    this.productVariantId,
    this.variantLabel,
  });

  factory VendorProductAsset.fromJson(Map<String, dynamic> json) {
    return VendorProductAsset(
      id: json['id']?.toString() ?? '',
      listingId: json['vendorProductListingId']?.toString() ?? '',
      assetTag: json['assetTag']?.toString() ?? '',
      status: json['status']?.toString() ?? '',
      condition: json['condition']?.toString(),
      productVariantId: json['productVariantId']?.toString(),
      variantLabel: json['variantLabel']?.toString(),
    );
  }
}

class TrackedAsset {
  final String assetId;
  final String assetTag;
  final String status;
  final String? condition;
  final String productName;
  final String? currentOrderId;
  final String? currentOrderNumber;
  final String? currentCustomerName;
  final String? dueDate;

  const TrackedAsset({
    required this.assetId,
    required this.assetTag,
    required this.status,
    this.condition,
    required this.productName,
    this.currentOrderId,
    this.currentOrderNumber,
    this.currentCustomerName,
    this.dueDate,
  });

  factory TrackedAsset.fromJson(Map<String, dynamic> json) {
    return TrackedAsset(
      assetId: json['assetId']?.toString() ?? '',
      assetTag: json['assetTag']?.toString() ?? '',
      status: json['status']?.toString() ?? '',
      condition: json['condition']?.toString(),
      productName: json['productName']?.toString() ?? '',
      currentOrderId: json['currentOrderId']?.toString(),
      currentOrderNumber: json['currentOrderNumber']?.toString(),
      currentCustomerName: json['currentCustomerName']?.toString(),
      dueDate: json['dueDate']?.toString(),
    );
  }
}

double _toDouble(dynamic value) {
  if (value == null) return 0;
  if (value is num) return value.toDouble();
  return double.tryParse(value.toString()) ?? 0;
}

int _toInt(dynamic value) {
  if (value == null) return 0;
  if (value is num) return value.toInt();
  return int.tryParse(value.toString()) ?? 0;
}
