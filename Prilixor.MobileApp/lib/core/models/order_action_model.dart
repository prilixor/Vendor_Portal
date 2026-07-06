class ExtensionQuoteModel {
  final int additionalDays;
  final String newEndDate;
  final double extensionAmount;
  final double serviceFeeAmount;
  final double gstAmount;
  final double totalAmount;

  ExtensionQuoteModel({
    required this.additionalDays,
    required this.newEndDate,
    required this.extensionAmount,
    required this.serviceFeeAmount,
    required this.gstAmount,
    required this.totalAmount,
  });

  factory ExtensionQuoteModel.fromJson(Map<String, dynamic> json) {
    return ExtensionQuoteModel(
      additionalDays: json['additionalDays'] ?? 0,
      newEndDate: json['newEndDate'] ?? '',
      extensionAmount: (json['extensionAmount'] ?? 0).toDouble(),
      serviceFeeAmount: (json['serviceFeeAmount'] ?? 0).toDouble(),
      gstAmount: (json['gstAmount'] ?? 0).toDouble(),
      totalAmount: (json['totalAmount'] ?? 0).toDouble(),
    );
  }
}

class BuyoutQuoteModel {
  final double baseBuyoutAmount;
  final double rentDeductionAmount;
  final double serviceFeeAmount;
  final double gstAmount;
  final double totalAmount;

  BuyoutQuoteModel({
    required this.baseBuyoutAmount,
    required this.rentDeductionAmount,
    required this.serviceFeeAmount,
    required this.gstAmount,
    required this.totalAmount,
  });

  factory BuyoutQuoteModel.fromJson(Map<String, dynamic> json) {
    return BuyoutQuoteModel(
      baseBuyoutAmount: (json['baseBuyoutAmount'] ?? 0).toDouble(),
      rentDeductionAmount: (json['rentDeductionAmount'] ?? 0).toDouble(),
      serviceFeeAmount: (json['serviceFeeAmount'] ?? 0).toDouble(),
      gstAmount: (json['gstAmount'] ?? 0).toDouble(),
      totalAmount: (json['totalAmount'] ?? 0).toDouble(),
    );
  }
}
