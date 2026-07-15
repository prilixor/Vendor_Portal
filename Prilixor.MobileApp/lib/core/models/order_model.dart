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
  final String? listingPrimaryImageUrl;

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
    this.listingPrimaryImageUrl,
  });

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
      listingPrimaryImageUrl: resolveItemImageUrl(json: json),
    );
  }
}
