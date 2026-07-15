import '../utils/media_url.dart';

class ExpiringOrderModel {
  final String orderId;
  final String orderNumber;
  final String listingTitle;
  final String status;
  final String orderType;
  final DateTime endDate;
  final int daysLeft;
  final String? listingPrimaryImageUrl;

  ExpiringOrderModel({
    required this.orderId,
    required this.orderNumber,
    required this.listingTitle,
    required this.status,
    required this.orderType,
    required this.endDate,
    required this.daysLeft,
    this.listingPrimaryImageUrl,
  });

  factory ExpiringOrderModel.fromJson(Map<String, dynamic> json) {
    final endRaw = json['endDate']?.toString();
    return ExpiringOrderModel(
      orderId: json['orderId']?.toString() ?? '',
      orderNumber: json['orderNumber']?.toString() ?? '',
      listingTitle: json['listingTitle']?.toString() ?? '',
      status: json['status']?.toString() ?? '',
      orderType: json['orderType']?.toString() ?? '',
      endDate: endRaw != null ? DateTime.tryParse(endRaw) ?? DateTime.now() : DateTime.now(),
      daysLeft: (json['daysLeft'] as num?)?.toInt() ?? 0,
      listingPrimaryImageUrl: resolveItemImageUrl(json: json),
    );
  }
}
