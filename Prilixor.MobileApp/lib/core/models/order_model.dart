import '../utils/media_url.dart';

class OrderModel {
  final String id;
  final String orderNumber;
  final String listingId;
  final String listingTitle;
  final String vendorId;
  final String vendorName;
  final String status;
  final String? startDate;
  final String? endDate;
  final double totalAmount;
  final double depositAmount;
  final double serviceFeeAmount;
  final double distanceFeeAmount;
  final double expressFeeAmount;
  final double gstAmount;
  final String orderType;
  final int quantity;
  final int rentalDays;
  final String rentalPeriodUnit;
  final String? listingPrimaryImageUrl;
  final String? doctorId;
  final String? doctorName;
  final String? doctorSpecialization;
  final String? doctorUniqueCode;
  final String? doctorContactNumber;
  final String? hospitalName;
  final String? hospitalCity;
  final String? rentalPricingPlanId;
  final String? rentalDurationLabel;
  final int? rentalDurationDays;
  final double? rentalNormalPrice;
  final String? rentalDiscountType;
  final double? rentalDiscountValue;
  final double? rentalFinalPrice;

  OrderModel({
    required this.id,
    required this.orderNumber,
    required this.listingId,
    required this.listingTitle,
    required this.vendorId,
    required this.vendorName,
    required this.status,
    this.startDate,
    this.endDate,
    required this.totalAmount,
    required this.depositAmount,
    required this.serviceFeeAmount,
    required this.distanceFeeAmount,
    required this.expressFeeAmount,
    required this.gstAmount,
    required this.orderType,
    required this.quantity,
    required this.rentalDays,
    this.rentalPeriodUnit = 'day',
    this.listingPrimaryImageUrl,
    this.doctorId,
    this.doctorName,
    this.doctorSpecialization,
    this.doctorUniqueCode,
    this.doctorContactNumber,
    this.hospitalName,
    this.hospitalCity,
    this.rentalPricingPlanId,
    this.rentalDurationLabel,
    this.rentalDurationDays,
    this.rentalNormalPrice,
    this.rentalDiscountType,
    this.rentalDiscountValue,
    this.rentalFinalPrice,
  });

  bool get hasMedicalReference {
    final id = doctorId?.trim() ?? '';
    final name = doctorName?.trim() ?? '';
    final code = doctorUniqueCode?.trim() ?? '';
    final hospital = hospitalName?.trim() ?? '';
    return id.isNotEmpty || name.isNotEmpty || code.isNotEmpty || hospital.isNotEmpty;
  }

  factory OrderModel.fromJson(Map<String, dynamic> json) {
    return OrderModel(
      id: json['id'] ?? '',
      orderNumber: json['orderNumber'] ?? '',
      listingId: json['listingId'] ?? '',
      listingTitle: json['listingTitle'] ?? '',
      vendorId: json['vendorId'] ?? '',
      vendorName: json['vendorName'] ?? '',
      status: json['status'] ?? '',
      startDate: json['startDate'],
      endDate: json['endDate'],
      totalAmount: (json['totalAmount'] ?? 0).toDouble(),
      depositAmount: (json['depositAmount'] ?? 0).toDouble(),
      serviceFeeAmount: (json['serviceFeeAmount'] ?? 0).toDouble(),
      distanceFeeAmount: (json['distanceFeeAmount'] ?? 0).toDouble(),
      expressFeeAmount: (json['expressFeeAmount'] ?? 0).toDouble(),
      gstAmount: (json['gstAmount'] ?? 0).toDouble(),
      orderType: json['orderType'] ?? '',
      quantity: json['quantity'] ?? 0,
      rentalDays: json['rentalDays'] ?? 0,
      rentalPeriodUnit: (json['rentalPeriodUnit'] ?? 'day').toString(),
      listingPrimaryImageUrl: resolveItemImageUrl(json: json),
      doctorId: json['doctorId']?.toString(),
      doctorName: json['doctorName']?.toString(),
      doctorSpecialization: json['doctorSpecialization']?.toString(),
      doctorUniqueCode: json['doctorUniqueCode']?.toString(),
      doctorContactNumber: json['doctorContactNumber']?.toString(),
      hospitalName: json['hospitalName']?.toString(),
      hospitalCity: json['hospitalCity']?.toString(),
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
