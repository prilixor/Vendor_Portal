class CheckoutSessionModel {
  final String checkoutSessionId;
  final String razorpayKeyId;
  final String? razorpayOrderId;
  final double amount;
  final String currency;
  final String? paymentLinkUrl;
  final List<dynamic> orders;
  final List<Map<String, dynamic>> failedLines;

  CheckoutSessionModel({
    required this.checkoutSessionId,
    required this.razorpayKeyId,
    this.razorpayOrderId,
    required this.amount,
    required this.currency,
    this.paymentLinkUrl,
    required this.orders,
    required this.failedLines,
  });

  factory CheckoutSessionModel.fromJson(Map<String, dynamic> json) {
    final rawOrders = json['orders'] as List<dynamic>? ?? [];
    final rawFailed = json['failedLines'] as List<dynamic>? ?? [];

    return CheckoutSessionModel(
      checkoutSessionId: (json['checkoutSessionId'] ?? '').toString(),
      razorpayKeyId: (json['razorpayKeyId'] ?? '').toString(),
      razorpayOrderId: json['razorpayOrderId']?.toString(),
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      currency: (json['currency'] ?? 'INR').toString(),
      paymentLinkUrl: json['paymentLinkUrl']?.toString(),
      orders: rawOrders,
      failedLines: rawFailed.map((e) => Map<String, dynamic>.from(e as Map)).toList(),
    );
  }
}
