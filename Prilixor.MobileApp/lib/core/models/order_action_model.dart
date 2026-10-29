class ExtensionQuoteModel {
  final int additionalDays;
  final String newEndDate;
  final double extensionAmount;
  final double serviceFeeAmount;
  final double gstAmount;
  final double? gstPercent;
  final double totalAmount;
  final int pendingDays;

  ExtensionQuoteModel({
    required this.additionalDays,
    required this.newEndDate,
    required this.extensionAmount,
    required this.serviceFeeAmount,
    required this.gstAmount,
    this.gstPercent,
    required this.totalAmount,
    this.pendingDays = 0,
  });

  factory ExtensionQuoteModel.fromJson(Map<String, dynamic> json) {
    return ExtensionQuoteModel(
      additionalDays: json['additionalDays'] ?? 0,
      newEndDate: json['newEndDate'] ?? '',
      extensionAmount: (json['extensionAmount'] ?? 0).toDouble(),
      serviceFeeAmount: (json['serviceFeeAmount'] ?? 0).toDouble(),
      gstAmount: (json['gstAmount'] ?? 0).toDouble(),
      gstPercent: json['gstPercent'] == null ? null : (json['gstPercent'] as num).toDouble(),
      totalAmount: (json['totalAmount'] ?? 0).toDouble(),
      pendingDays: json['pendingDays'] ?? 0,
    );
  }
}

class CustomerExtensionModel {
  final String extensionId;
  final String status;
  final int additionalDays;
  final double extensionAmount;
  final double serviceFeeAmount;
  final double gstAmount;
  final double totalAmount;
  final String? originalEndDate;
  final String? newEndDate;
  final double? gstPercent;

  const CustomerExtensionModel({
    required this.extensionId,
    required this.status,
    required this.additionalDays,
    required this.extensionAmount,
    this.serviceFeeAmount = 0,
    required this.gstAmount,
    required this.totalAmount,
    this.originalEndDate,
    this.newEndDate,
    this.gstPercent,
  });

  bool get isPaid => status == 'paid';
  bool get isAwaitingPayment => status == 'awaiting_payment';
  bool get isPending => status == 'pending_approval';

  factory CustomerExtensionModel.fromJson(Map<String, dynamic> json) {
    return CustomerExtensionModel(
      extensionId: json['extensionId']?.toString() ?? '',
      status: json['status']?.toString() ?? '',
      additionalDays: (json['additionalDays'] as num?)?.toInt() ?? 0,
      extensionAmount: (json['extensionAmount'] as num?)?.toDouble() ?? 0,
      serviceFeeAmount: (json['serviceFeeAmount'] as num?)?.toDouble() ?? 0,
      gstAmount: (json['gstAmount'] as num?)?.toDouble() ?? 0,
      totalAmount: (json['totalAmount'] as num?)?.toDouble() ?? 0,
      originalEndDate: json['originalEndDate']?.toString(),
      newEndDate: json['newEndDate']?.toString(),
      gstPercent: json['gstPercent'] == null ? null : (json['gstPercent'] as num).toDouble(),
    );
  }
}

class ExtensionPaymentSession {
  final String checkoutSessionId;
  final String razorpayKeyId;
  final String? razorpayOrderId;
  final double amount;
  final String currency;

  const ExtensionPaymentSession({
    required this.checkoutSessionId,
    required this.razorpayKeyId,
    this.razorpayOrderId,
    required this.amount,
    required this.currency,
  });

  factory ExtensionPaymentSession.fromJson(Map<String, dynamic> json) {
    return ExtensionPaymentSession(
      checkoutSessionId: json['checkoutSessionId']?.toString() ?? '',
      razorpayKeyId: json['razorpayKeyId']?.toString() ?? '',
      razorpayOrderId: json['razorpayOrderId']?.toString(),
      amount: (json['amount'] as num?)?.toDouble() ?? 0,
      currency: json['currency']?.toString() ?? 'INR',
    );
  }
}

class BuyoutQuoteModel {
  final double baseBuyoutAmount;
  final double rentDeductionAmount;
  final double serviceFeeAmount;
  final double gstAmount;
  final double? gstPercent;
  final double totalAmount;

  BuyoutQuoteModel({
    required this.baseBuyoutAmount,
    required this.rentDeductionAmount,
    required this.serviceFeeAmount,
    required this.gstAmount,
    this.gstPercent,
    required this.totalAmount,
  });

  factory BuyoutQuoteModel.fromJson(Map<String, dynamic> json) {
    return BuyoutQuoteModel(
      baseBuyoutAmount: (json['baseBuyoutAmount'] ?? 0).toDouble(),
      rentDeductionAmount: (json['rentDeductionAmount'] ?? 0).toDouble(),
      serviceFeeAmount: (json['serviceFeeAmount'] ?? 0).toDouble(),
      gstAmount: (json['gstAmount'] ?? 0).toDouble(),
      gstPercent: json['gstPercent'] == null ? null : (json['gstPercent'] as num).toDouble(),
      totalAmount: (json['totalAmount'] ?? 0).toDouble(),
    );
  }
}
