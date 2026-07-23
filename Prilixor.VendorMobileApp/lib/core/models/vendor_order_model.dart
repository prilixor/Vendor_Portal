import '../utils/media_url.dart';

class VendorOrder {
  final String orderId;
  final String orderNumber;
  final String status;
  final String orderType;
  final int quantity;
  final int rentalDays;
  final double totalAmount;
  final double vendorSubtotalAmount;
  final String? startDate;
  final String? endDate;
  final String listingId;
  final String listingTitle;
  final String? listingPrimaryImageUrl;
  final String customerName;
  final String? customerCity;
  final String? customerState;
  final DateTime createdAtUtc;
  final bool isExtended;
  final String? doctorName;
  final String? doctorSpecialization;
  final String? doctorUniqueCode;
  final String? doctorContactNumber;
  final String? hospitalName;
  final String? hospitalCity;
  final List<String> assignedAssetTags;
  final String? productVariantId;

  const VendorOrder({
    required this.orderId,
    required this.orderNumber,
    required this.status,
    required this.orderType,
    required this.quantity,
    required this.rentalDays,
    required this.totalAmount,
    required this.vendorSubtotalAmount,
    this.startDate,
    this.endDate,
    required this.listingId,
    required this.listingTitle,
    this.listingPrimaryImageUrl,
    required this.customerName,
    this.customerCity,
    this.customerState,
    required this.createdAtUtc,
    required this.isExtended,
    this.doctorName,
    this.doctorSpecialization,
    this.doctorUniqueCode,
    this.doctorContactNumber,
    this.hospitalName,
    this.hospitalCity,
    this.assignedAssetTags = const [],
    this.productVariantId,
  });

  double get payoutAmount =>
      vendorSubtotalAmount > 0 ? vendorSubtotalAmount : totalAmount;

  String get normalizedStatus =>
      status.trim().toLowerCase().replaceAll('_', ' ');

  String? get imageUrl => resolveItemImageUrl(
        listingPrimaryImageUrl: listingPrimaryImageUrl,
      );

  String get customerLocation {
    final parts = [customerCity, customerState]
        .where((e) => e != null && e.trim().isNotEmpty)
        .map((e) => e!.trim())
        .toList();
    return parts.isEmpty ? '—' : parts.join(', ');
  }

  factory VendorOrder.fromJson(Map<String, dynamic> json) {
    return VendorOrder(
      orderId: json['orderId']?.toString() ?? '',
      orderNumber: json['orderNumber']?.toString() ?? '',
      status: json['status']?.toString() ?? '',
      orderType: json['orderType']?.toString() ?? 'rent',
      quantity: (json['quantity'] as num?)?.toInt() ?? 1,
      rentalDays: (json['rentalDays'] as num?)?.toInt() ?? 0,
      totalAmount: (json['totalAmount'] as num?)?.toDouble() ?? 0,
      vendorSubtotalAmount:
          (json['vendorSubtotalAmount'] as num?)?.toDouble() ?? 0,
      startDate: json['startDate']?.toString(),
      endDate: json['endDate']?.toString(),
      listingId: json['listingId']?.toString() ?? '',
      listingTitle: json['listingTitle']?.toString() ?? 'Listing',
      listingPrimaryImageUrl: json['listingPrimaryImageUrl']?.toString(),
      customerName: json['customerName']?.toString() ?? 'Customer',
      customerCity: json['customerCity']?.toString(),
      customerState: json['customerState']?.toString(),
      createdAtUtc: DateTime.tryParse(json['createdAtUtc']?.toString() ?? '') ??
          DateTime.now().toUtc(),
      isExtended: json['isExtended'] == true,
      doctorName: json['doctorName']?.toString(),
      doctorSpecialization: json['doctorSpecialization']?.toString(),
      doctorUniqueCode: json['doctorUniqueCode']?.toString(),
      doctorContactNumber: json['doctorContactNumber']?.toString(),
      hospitalName: json['hospitalName']?.toString(),
      hospitalCity: json['hospitalCity']?.toString(),
      assignedAssetTags: (json['assignedAssetTags'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .where((e) => e.trim().isNotEmpty)
              .toList() ??
          const [],
      productVariantId: json['productVariantId']?.toString(),
    );
  }
}
