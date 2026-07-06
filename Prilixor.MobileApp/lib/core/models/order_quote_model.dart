class OrderQuoteModel {
  final double subtotalAmount;
  final double depositAmount;
  final double serviceFeeAmount;
  final double distanceFeeAmount;
  final double expressFeeAmount;
  final double gstAmount;
  final double totalAmount;

  OrderQuoteModel({
    required this.subtotalAmount,
    required this.depositAmount,
    required this.serviceFeeAmount,
    required this.distanceFeeAmount,
    required this.expressFeeAmount,
    required this.gstAmount,
    required this.totalAmount,
  });

  factory OrderQuoteModel.fromJson(Map<String, dynamic> json) {
    return OrderQuoteModel(
      subtotalAmount: (json['subtotalAmount'] ?? 0).toDouble(),
      depositAmount: (json['depositAmount'] ?? 0).toDouble(),
      serviceFeeAmount: (json['serviceFeeAmount'] ?? 0).toDouble(),
      distanceFeeAmount: (json['distanceFeeAmount'] ?? 0).toDouble(),
      expressFeeAmount: (json['expressFeeAmount'] ?? 0).toDouble(),
      gstAmount: (json['gstAmount'] ?? 0).toDouble(),
      totalAmount: (json['totalAmount'] ?? 0).toDouble(),
    );
  }
}
