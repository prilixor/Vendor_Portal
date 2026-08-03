class OrderContinuations {
  final List<PendingExtension> pendingExtensions;
  final List<PendingBuyout> pendingBuyouts;

  const OrderContinuations({
    this.pendingExtensions = const [],
    this.pendingBuyouts = const [],
  });

  bool get hasPending =>
      pendingExtensions.isNotEmpty || pendingBuyouts.isNotEmpty;

  factory OrderContinuations.fromJson(Map<String, dynamic> json) {
    final extensions = (json['pendingExtensions'] as List?)
            ?.whereType<Map>()
            .map((e) => PendingExtension.fromJson(Map<String, dynamic>.from(e)))
            .toList() ??
        const <PendingExtension>[];
    final buyouts = (json['pendingBuyouts'] as List?)
            ?.whereType<Map>()
            .map((e) => PendingBuyout.fromJson(Map<String, dynamic>.from(e)))
            .toList() ??
        const <PendingBuyout>[];
    return OrderContinuations(
      pendingExtensions: extensions,
      pendingBuyouts: buyouts,
    );
  }

  static const empty = OrderContinuations();
}

class PendingExtension {
  final String extensionId;
  final String orderId;
  final int additionalDays;
  final double extensionAmount;
  final double serviceFeeAmount;
  final double gstAmount;
  final double totalAmount;
  final String? originalEndDate;
  final String? newEndDate;
  final String? createdAtUtc;

  const PendingExtension({
    required this.extensionId,
    required this.orderId,
    required this.additionalDays,
    required this.extensionAmount,
    this.serviceFeeAmount = 0,
    required this.gstAmount,
    required this.totalAmount,
    this.originalEndDate,
    this.newEndDate,
    this.createdAtUtc,
  });

  factory PendingExtension.fromJson(Map<String, dynamic> json) {
    return PendingExtension(
      extensionId: json['extensionId']?.toString() ?? '',
      orderId: json['orderId']?.toString() ?? '',
      additionalDays: (json['additionalDays'] as num?)?.toInt() ?? 0,
      extensionAmount: (json['extensionAmount'] as num?)?.toDouble() ?? 0,
      serviceFeeAmount: (json['serviceFeeAmount'] as num?)?.toDouble() ?? 0,
      gstAmount: (json['gstAmount'] as num?)?.toDouble() ?? 0,
      totalAmount: (json['totalAmount'] as num?)?.toDouble() ?? 0,
      originalEndDate: json['originalEndDate']?.toString(),
      newEndDate: json['newEndDate']?.toString(),
      createdAtUtc: json['createdAtUtc']?.toString(),
    );
  }
}

class PendingBuyout {
  final String buyoutId;
  final String orderId;
  final double baseBuyoutAmount;
  final double rentDeductionAmount;
  final double serviceFeeAmount;
  final double gstAmount;
  final double totalAmount;
  final String? createdAtUtc;

  const PendingBuyout({
    required this.buyoutId,
    required this.orderId,
    required this.baseBuyoutAmount,
    required this.rentDeductionAmount,
    this.serviceFeeAmount = 0,
    required this.gstAmount,
    required this.totalAmount,
    this.createdAtUtc,
  });

  factory PendingBuyout.fromJson(Map<String, dynamic> json) {
    return PendingBuyout(
      buyoutId: json['buyoutId']?.toString() ?? '',
      orderId: json['orderId']?.toString() ?? '',
      baseBuyoutAmount: (json['baseBuyoutAmount'] as num?)?.toDouble() ?? 0,
      rentDeductionAmount: (json['rentDeductionAmount'] as num?)?.toDouble() ?? 0,
      serviceFeeAmount: (json['serviceFeeAmount'] as num?)?.toDouble() ?? 0,
      gstAmount: (json['gstAmount'] as num?)?.toDouble() ?? 0,
      totalAmount: (json['totalAmount'] as num?)?.toDouble() ?? 0,
      createdAtUtc: json['createdAtUtc']?.toString(),
    );
  }
}
