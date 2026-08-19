import 'product_variant_model.dart';
import 'rental_pricing_plan_model.dart';
import '../utils/media_url.dart';
import '../utils/rental_plan_display.dart';

class CatalogDocumentModel {
  final String id;
  final String documentType;
  final String fileUrl;

  const CatalogDocumentModel({
    required this.id,
    required this.documentType,
    required this.fileUrl,
  });

  String get label {
    switch (documentType.trim().toLowerCase()) {
      case 'spec_sheet':
        return 'Spec Sheet';
      case 'sds':
        return 'Safety Data Sheet (SDS)';
      case 'coa':
        return 'Certificate of Analysis (COA)';
      case 'warranty':
        return 'Warranty';
      case 'compliance':
        return 'Compliance';
      default:
        return documentType.replaceAll('_', ' ');
    }
  }

  String get hint {
    switch (documentType.trim().toLowerCase()) {
      case 'spec_sheet':
        return 'Product specifications and technical details.';
      case 'sds':
        return 'Safety, handling, and storage information.';
      case 'coa':
        return 'Quality and purity certificate.';
      case 'warranty':
        return 'Manufacturer warranty terms.';
      case 'compliance':
        return 'Regulatory and certification documents.';
      default:
        return 'Official product document.';
    }
  }

  String get formatLabel {
    final lower = fileUrl.toLowerCase();
    if (lower.contains('.pdf')) return 'PDF';
    if (RegExp(r'\.(jpg|jpeg|png|gif|webp)').hasMatch(lower)) return 'Image';
    return 'File';
  }

  factory CatalogDocumentModel.fromJson(Map<String, dynamic> json) {
    return CatalogDocumentModel(
      id: json['id']?.toString() ?? '',
      documentType: json['documentType']?.toString() ?? 'document',
      fileUrl: json['fileUrl']?.toString() ?? '',
    );
  }
}

class ProductDetailModel {
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
  final String availabilityStatus;
  final String description;
  final List<String> imageUrls;
  final String? primaryImageUrl;
  final double? buyPrice;
  final bool isRentEnabled;
  final bool isBuyEnabled;
  final bool isChemical;
  final String? casNumber;
  final String? chemicalFormula;
  final double? purityPercentage;
  final double? molecularWeight;
  final String? baseUnit;
  final String? sdsDocumentUrl;
  final String? coaDocumentUrl;
  final List<CatalogDocumentModel> documents;
  final List<ProductVariantModel> variants;
  final List<VariantInventoryModel> variantInventory;
  final List<RentalPricingPlanModel> rentalPricingPlans;

  ProductDetailModel({
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
    required this.availabilityStatus,
    required this.description,
    required this.imageUrls,
    this.primaryImageUrl,
    this.buyPrice,
    this.isRentEnabled = true,
    this.isBuyEnabled = false,
    this.isChemical = false,
    this.casNumber,
    this.chemicalFormula,
    this.purityPercentage,
    this.molecularWeight,
    this.baseUnit,
    this.sdsDocumentUrl,
    this.coaDocumentUrl,
    this.documents = const [],
    this.variants = const [],
    this.variantInventory = const [],
    this.rentalPricingPlans = const [],
  });

  List<ProductVariantModel> get activeVariants =>
      variants.where((v) => v.isActive).toList();

  List<RentalPricingPlanModel> get activeRentalPlans =>
      sortActiveRentalPlans(rentalPricingPlans);

  bool get hasActiveRentalPlans => activeRentalPlans.isNotEmpty;

  RentalPricingPlanModel? get defaultRentalPlan {
    final plans = activeRentalPlans;
    if (plans.isEmpty) return null;
    for (final p in plans) {
      if (p.isRecommended) return p;
    }
    return plans.first;
  }

  bool get canRent => !isChemical && isRentEnabled;
  bool get canBuy => isChemical || isBuyEnabled;

  bool get hasChemSpecs =>
      isChemical &&
      (casNumber != null ||
          chemicalFormula != null ||
          purityPercentage != null ||
          molecularWeight != null);

  int variantStockOf(String variantId) {
    for (final v in activeVariants) {
      if (v.id == variantId && v.availableQuantity != null) {
        return v.availableQuantity!;
      }
    }
    for (final vi in variantInventory) {
      if (vi.productVariantId == variantId) return vi.availableQuantity;
    }
    return 0;
  }

  int availableForVariant(String? variantId) {
    if (variantId == null || variantId.isEmpty) return availableQuantity;
    for (final vi in variantInventory) {
      if (vi.productVariantId == variantId) return vi.availableQuantity;
    }
    return variantStockOf(variantId);
  }

  factory ProductDetailModel.fromJson(Map<String, dynamic> json) {
    final variantsJson = json['variants'] as List<dynamic>? ?? [];
    final invJson = json['variantInventory'] as List<dynamic>? ?? [];
    final plansJson = json['rentalPricingPlans'] as List<dynamic>? ?? [];

    return ProductDetailModel(
      id: json['id'] ?? '',
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
      availabilityStatus: json['availabilityStatus'] ?? '',
      description: json['description'] ?? '',
      imageUrls: List<String>.from(json['imageUrls'] ?? [])
          .map((u) => resolveMediaUrl(u))
          .whereType<String>()
          .toList(),
      primaryImageUrl: resolveItemImageUrl(json: json),
      buyPrice: json['buyPrice'] != null ? (json['buyPrice'] as num).toDouble() : null,
      isRentEnabled: json['isRentEnabled'] ?? true,
      isBuyEnabled: json['isBuyEnabled'] ?? false,
      isChemical: json['isChemical'] ?? false,
      casNumber: json['casNumber'],
      chemicalFormula: json['chemicalFormula'],
      purityPercentage: json['purityPercentage'] != null
          ? (json['purityPercentage'] as num).toDouble()
          : null,
      molecularWeight: json['molecularWeight'] != null
          ? (json['molecularWeight'] as num).toDouble()
          : null,
      baseUnit: json['baseUnit'],
      sdsDocumentUrl: json['sdsDocumentUrl'],
      coaDocumentUrl: json['coaDocumentUrl'],
      documents: _parseDocuments(json),
      variants: variantsJson
          .map((e) => ProductVariantModel.fromJson(e as Map<String, dynamic>))
          .toList(),
      variantInventory: invJson
          .map((e) => VariantInventoryModel.fromJson(e as Map<String, dynamic>))
          .toList(),
      rentalPricingPlans: plansJson
          .map((e) => RentalPricingPlanModel.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  Map<String, dynamic>? getAvailabilityBadge({int? qtyOverride}) {
    final qty = qtyOverride ?? availableQuantity;
    final s = availabilityStatus.trim().toLowerCase();
    final ls = listingStatus.trim().toLowerCase();

    if (ls != 'active' && ls != 'approved' && ls != 'available' && ls != 'low_stock' && ls != 'out_of_stock') {
      // Mirror React: listingVisible when status is available/low_stock/out_of_stock
      if (s != 'available' && s != 'low_stock' && s != 'out_of_stock') {
        return {'label': 'Unavailable', 'color': 0xFF9E9E9E};
      }
    }
    if (s == 'out_of_stock' || qty <= 0) {
      return {'label': 'Out of stock', 'color': 0xFFF44336};
    }
    if (qty == 1) {
      return {'label': 'Only 1 left', 'color': 0xFFEF6C00};
    }
    if (s == 'low_stock' || qty <= 3) {
      return {'label': 'Limited stock', 'color': 0xFFF57C00};
    }
    // In-stock / available: no badge per product requirement
    return null;
  }
}

List<CatalogDocumentModel> _parseDocuments(Map<String, dynamic> json) {
  final raw = json['documents'];
  final seen = <String>{};
  final docs = <CatalogDocumentModel>[];

  void add(String id, String type, String? url) {
    final resolved = resolveMediaUrl(url);
    if (resolved == null || resolved.trim().isEmpty) return;
    final key = resolved.trim().toLowerCase();
    if (!seen.add(key)) return;
    docs.add(CatalogDocumentModel(id: id, documentType: type, fileUrl: resolved));
  }

  if (raw is List) {
    for (final item in raw) {
      if (item is! Map) continue;
      final map = Map<String, dynamic>.from(item);
      add(
        map['id']?.toString() ?? '',
        map['documentType']?.toString() ?? 'document',
        map['fileUrl']?.toString(),
      );
    }
  }

  add('legacy-sds', 'sds', json['sdsDocumentUrl']?.toString());
  add('legacy-coa', 'coa', json['coaDocumentUrl']?.toString());
  return docs;
}
