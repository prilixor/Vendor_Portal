import '../utils/media_url.dart';

class VendorDispatchOffer {
  final String offerId;
  final String orderId;
  final String orderNumber;
  final String listingId;
  final String listingTitle;
  final String orderType;
  final int quantity;
  final int rentalDays;
  final DateTime expiresAt;
  final String status;
  final double totalAmount;
  final double vendorSubtotalAmount;
  final String? startDate;
  final String? endDate;
  final String? listingPrimaryImageUrl;
  final String? doctorName;
  final String? doctorSpecialization;
  final String? doctorUniqueCode;
  final String? doctorContactNumber;
  final String? hospitalName;
  final String? hospitalCity;

  const VendorDispatchOffer({
    required this.offerId,
    required this.orderId,
    required this.orderNumber,
    required this.listingId,
    required this.listingTitle,
    required this.orderType,
    required this.quantity,
    required this.rentalDays,
    required this.expiresAt,
    required this.status,
    required this.totalAmount,
    required this.vendorSubtotalAmount,
    this.startDate,
    this.endDate,
    this.listingPrimaryImageUrl,
    this.doctorName,
    this.doctorSpecialization,
    this.doctorUniqueCode,
    this.doctorContactNumber,
    this.hospitalName,
    this.hospitalCity,
  });

  double get payoutAmount =>
      vendorSubtotalAmount > 0 ? vendorSubtotalAmount : totalAmount;

  String? get imageUrl => resolveItemImageUrl(
        listingPrimaryImageUrl: listingPrimaryImageUrl,
      );

  factory VendorDispatchOffer.fromJson(Map<String, dynamic> json) {
    return VendorDispatchOffer(
      offerId: json['offerId']?.toString() ?? '',
      orderId: json['orderId']?.toString() ?? '',
      orderNumber: json['orderNumber']?.toString() ?? '',
      listingId: json['listingId']?.toString() ?? '',
      listingTitle: json['listingTitle']?.toString() ?? 'Listing',
      orderType: json['orderType']?.toString() ?? 'rent',
      quantity: (json['quantity'] as num?)?.toInt() ?? 1,
      rentalDays: (json['rentalDays'] as num?)?.toInt() ?? 0,
      expiresAt: DateTime.tryParse(json['expiresAt']?.toString() ?? '') ??
          DateTime.now(),
      status: json['status']?.toString() ?? '',
      totalAmount: (json['totalAmount'] as num?)?.toDouble() ?? 0,
      vendorSubtotalAmount:
          (json['vendorSubtotalAmount'] as num?)?.toDouble() ?? 0,
      startDate: json['startDate']?.toString(),
      endDate: json['endDate']?.toString(),
      listingPrimaryImageUrl: json['listingPrimaryImageUrl']?.toString(),
      doctorName: json['doctorName']?.toString(),
      doctorSpecialization: json['doctorSpecialization']?.toString(),
      doctorUniqueCode: json['doctorUniqueCode']?.toString(),
      doctorContactNumber: json['doctorContactNumber']?.toString(),
      hospitalName: json['hospitalName']?.toString(),
      hospitalCity: json['hospitalCity']?.toString(),
    );
  }
}
