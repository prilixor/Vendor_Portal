import '../utils/media_url.dart';

class PrescriptionFileModel {
  final String id;
  final String orderId;
  final String fileUrl;
  final String? originalFileName;
  final String? contentType;

  const PrescriptionFileModel({
    required this.id,
    required this.orderId,
    required this.fileUrl,
    this.originalFileName,
    this.contentType,
  });

  factory PrescriptionFileModel.fromJson(Map<String, dynamic> json) {
    return PrescriptionFileModel(
      id: json['id']?.toString() ?? '',
      orderId: json['orderId']?.toString() ?? '',
      fileUrl: json['fileUrl']?.toString() ?? '',
      originalFileName: json['originalFileName']?.toString(),
      contentType: json['contentType']?.toString(),
    );
  }

  bool get isImage {
    final type = (contentType ?? '').toLowerCase();
    if (type.startsWith('image/')) return true;
    final name = (originalFileName ?? '').toLowerCase();
    return name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.webp');
  }
}

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
  final bool isExtended;
  final OrderReturnInfo? returnSettlement;
  final OrderCancellationInfo? cancellationRefund;

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
    this.isExtended = false,
    this.returnSettlement,
    this.cancellationRefund,
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
      isExtended: json['isExtended'] == true,
      returnSettlement: OrderReturnInfo.fromJson(json['returnSettlement']),
      cancellationRefund: OrderCancellationInfo.fromJson(json['cancellationRefund']),
    );
  }
}

class OrderReturnInfo {
  final double depositAmount;
  final double damageAmount;
  final String? damageReason;
  final double refundAmount;
  final String status;
  final String? refundedAt;

  const OrderReturnInfo({
    required this.depositAmount,
    required this.damageAmount,
    this.damageReason,
    required this.refundAmount,
    required this.status,
    this.refundedAt,
  });

  static OrderReturnInfo? fromJson(dynamic raw) {
    if (raw is! Map) return null;
    final json = Map<String, dynamic>.from(raw);
    return OrderReturnInfo(
      depositAmount: (json['depositAmount'] as num?)?.toDouble() ?? 0,
      damageAmount: (json['damageAmount'] as num?)?.toDouble() ?? 0,
      damageReason: json['damageReason']?.toString(),
      refundAmount: (json['refundAmount'] as num?)?.toDouble() ?? 0,
      status: json['status']?.toString() ?? '',
      refundedAt: json['refundedAt']?.toString(),
    );
  }

  static String format(num value) {
    final rounded = (value * 100).round() / 100;
    final whole = rounded == rounded.roundToDouble();
    return '₹${whole ? rounded.toStringAsFixed(0) : rounded.toStringAsFixed(2)}';
  }

  String money(num value) => format(value);

  String? get chipLabel {
    if (refundAmount > 0) {
      final amount = 'Refund ${money(refundAmount)}';
      return status == 'refunded' ? amount : '$amount processing';
    }
    if (damageAmount > 0) return 'Damage ${money(damageAmount)}';
    return null;
  }
}

class OrderCancellationInfo {
  final double paidAmount;
  final double chargeAmount;
  final String? chargeReason;
  final double refundAmount;
  final String status;
  final String actorLabel;
  final String? refundedAt;

  const OrderCancellationInfo({
    required this.paidAmount,
    required this.chargeAmount,
    this.chargeReason,
    required this.refundAmount,
    required this.status,
    required this.actorLabel,
    this.refundedAt,
  });

  static OrderCancellationInfo? fromJson(dynamic raw) {
    if (raw is! Map) return null;
    final json = Map<String, dynamic>.from(raw);
    return OrderCancellationInfo(
      paidAmount: (json['paidAmount'] as num?)?.toDouble() ?? 0,
      chargeAmount: (json['chargeAmount'] as num?)?.toDouble() ?? 0,
      chargeReason: json['chargeReason']?.toString(),
      refundAmount: (json['refundAmount'] as num?)?.toDouble() ?? 0,
      status: json['status']?.toString() ?? '',
      actorLabel: json['actorLabel']?.toString() ?? '',
      refundedAt: json['refundedAt']?.toString(),
    );
  }

  String money(num value) => OrderReturnInfo.format(value);

  String? get chipLabel {
    if (status == 'pending_review') return 'Refund in review';
    if (status == 'refunding') return 'Refund ${money(refundAmount)} processing';
    if (status == 'refunded' && refundAmount > 0) return 'Refund ${money(refundAmount)}';
    if (chargeAmount > 0 && refundAmount <= 0) return 'Charge ${money(chargeAmount)}';
    return null;
  }
}
