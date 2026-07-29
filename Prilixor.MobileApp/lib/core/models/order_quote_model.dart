class BuySuggestionModel {
  final String listingId;
  final String listingTitle;
  final double rentAmount;
  final double buyAmount;

  BuySuggestionModel({
    required this.listingId,
    required this.listingTitle,
    required this.rentAmount,
    required this.buyAmount,
  });

  factory BuySuggestionModel.fromJson(Map<String, dynamic> json) {
    return BuySuggestionModel(
      listingId: json['listingId']?.toString() ?? '',
      listingTitle: json['listingTitle']?.toString() ?? '',
      rentAmount: (json['rentAmount'] ?? 0).toDouble(),
      buyAmount: (json['buyAmount'] ?? 0).toDouble(),
    );
  }
}

class OrderQuoteModel {
  final double subtotalAmount;
  final double depositAmount;
  final double serviceFeeAmount;
  final double distanceFeeAmount;
  final double expressFeeAmount;
  final double gstAmount;
  final double totalAmount;
  final List<BuySuggestionModel> buySuggestions;

  OrderQuoteModel({
    required this.subtotalAmount,
    required this.depositAmount,
    required this.serviceFeeAmount,
    required this.distanceFeeAmount,
    required this.expressFeeAmount,
    required this.gstAmount,
    required this.totalAmount,
    this.buySuggestions = const [],
  });

  factory OrderQuoteModel.fromJson(Map<String, dynamic> json) {
    final suggestions = (json['buySuggestions'] as List<dynamic>? ?? [])
        .whereType<Map>()
        .map((e) => BuySuggestionModel.fromJson(Map<String, dynamic>.from(e)))
        .toList();
    return OrderQuoteModel(
      subtotalAmount: (json['subtotalAmount'] ?? 0).toDouble(),
      depositAmount: (json['depositAmount'] ?? 0).toDouble(),
      serviceFeeAmount: (json['serviceFeeAmount'] ?? 0).toDouble(),
      distanceFeeAmount: (json['distanceFeeAmount'] ?? 0).toDouble(),
      expressFeeAmount: (json['expressFeeAmount'] ?? 0).toDouble(),
      gstAmount: (json['gstAmount'] ?? 0).toDouble(),
      totalAmount: (json['totalAmount'] ?? 0).toDouble(),
      buySuggestions: suggestions,
    );
  }
}
