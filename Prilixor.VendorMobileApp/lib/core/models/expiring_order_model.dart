class ExpiringOrder {
  final String orderId;
  final String orderNumber;
  final String listingTitle;
  final String vendorName;
  final String customerName;
  final String status;
  final String orderType;
  final String endDate;
  final int daysLeft;

  const ExpiringOrder({
    required this.orderId,
    required this.orderNumber,
    required this.listingTitle,
    required this.vendorName,
    required this.customerName,
    required this.status,
    required this.orderType,
    required this.endDate,
    required this.daysLeft,
  });

  factory ExpiringOrder.fromJson(Map<String, dynamic> json) {
    final days = (json['daysLeft'] as num?)?.toInt() ??
        (json['daysUntilEnd'] as num?)?.toInt() ??
        0;
    return ExpiringOrder(
      orderId: json['orderId']?.toString() ?? '',
      orderNumber: json['orderNumber']?.toString() ?? '',
      listingTitle: json['listingTitle']?.toString() ?? 'Listing',
      vendorName: json['vendorName']?.toString() ?? '',
      customerName: json['customerName']?.toString() ?? 'Customer',
      status: json['status']?.toString() ?? '',
      orderType: json['orderType']?.toString() ?? 'rent',
      endDate: json['endDate']?.toString() ?? '',
      daysLeft: days,
    );
  }

  /// Vendor Web parity: 0 → "Due Today", 1 → "1 day left", else "N days left".
  String get daysLeftLabel {
    if (daysLeft <= 0) return 'Due Today';
    if (daysLeft == 1) return '1 day left';
    return '$daysLeft days left';
  }

  bool get isUrgentBadge => daysLeft <= 1;
}
