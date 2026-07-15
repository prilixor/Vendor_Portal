class NotificationPreferencesModel {
  final String customerId;
  final bool orderStatusUpdatesEnabled;
  final bool expirationRemindersEnabled;
  final bool depositRefundsEnabled;
  final bool directMessagesEnabled;
  final bool marketingEmailsEnabled;

  NotificationPreferencesModel({
    required this.customerId,
    required this.orderStatusUpdatesEnabled,
    required this.expirationRemindersEnabled,
    required this.depositRefundsEnabled,
    required this.directMessagesEnabled,
    required this.marketingEmailsEnabled,
  });

  factory NotificationPreferencesModel.fromJson(Map<String, dynamic> json) {
    return NotificationPreferencesModel(
      customerId: json['customerId']?.toString() ?? '',
      orderStatusUpdatesEnabled: json['orderStatusUpdatesEnabled'] ?? true,
      expirationRemindersEnabled: json['expirationRemindersEnabled'] ?? true,
      depositRefundsEnabled: json['depositRefundsEnabled'] ?? true,
      directMessagesEnabled: json['directMessagesEnabled'] ?? true,
      marketingEmailsEnabled: json['marketingEmailsEnabled'] ?? false,
    );
  }

  Map<String, dynamic> toUpdateJson() {
    return {
      'orderStatusUpdatesEnabled': orderStatusUpdatesEnabled,
      'expirationRemindersEnabled': expirationRemindersEnabled,
      'depositRefundsEnabled': depositRefundsEnabled,
      'directMessagesEnabled': directMessagesEnabled,
      'marketingEmailsEnabled': marketingEmailsEnabled,
    };
  }

  NotificationPreferencesModel copyWith({
    bool? orderStatusUpdatesEnabled,
    bool? expirationRemindersEnabled,
    bool? depositRefundsEnabled,
    bool? directMessagesEnabled,
    bool? marketingEmailsEnabled,
  }) {
    return NotificationPreferencesModel(
      customerId: customerId,
      orderStatusUpdatesEnabled: orderStatusUpdatesEnabled ?? this.orderStatusUpdatesEnabled,
      expirationRemindersEnabled: expirationRemindersEnabled ?? this.expirationRemindersEnabled,
      depositRefundsEnabled: depositRefundsEnabled ?? this.depositRefundsEnabled,
      directMessagesEnabled: directMessagesEnabled ?? this.directMessagesEnabled,
      marketingEmailsEnabled: marketingEmailsEnabled ?? this.marketingEmailsEnabled,
    );
  }
}
