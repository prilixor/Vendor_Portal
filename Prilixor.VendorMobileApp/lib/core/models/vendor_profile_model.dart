class VendorProfile {
  final String id;
  final String vendorId;
  final String businessName;
  final String ownerName;
  final String supportPhone;
  final String? gstNumber;
  final String addressLine1;
  final String? addressLine2;
  final String city;
  final String state;
  final String postalCode;
  final double? latitude;
  final double? longitude;
  final bool onboardingCompleted;
  final bool isPhoneVerified;

  const VendorProfile({
    required this.id,
    required this.vendorId,
    required this.businessName,
    required this.ownerName,
    required this.supportPhone,
    this.gstNumber,
    required this.addressLine1,
    this.addressLine2,
    required this.city,
    required this.state,
    required this.postalCode,
    this.latitude,
    this.longitude,
    required this.onboardingCompleted,
    this.isPhoneVerified = false,
  });

  Map<String, dynamic> toUpsertPayload() => {
        'vendorId': vendorId,
        'businessName': businessName,
        'ownerName': ownerName,
        'supportPhone': supportPhone,
        'gstNumber': gstNumber,
        'addressLine1': addressLine1,
        'addressLine2': addressLine2,
        'city': city,
        'state': state,
        'postalCode': postalCode,
        if (latitude != null) 'latitude': latitude,
        if (longitude != null) 'longitude': longitude,
      };

  VendorProfile copyWith({
    String? businessName,
    String? ownerName,
    String? supportPhone,
    String? gstNumber,
    String? addressLine1,
    String? addressLine2,
    String? city,
    String? state,
    String? postalCode,
    double? latitude,
    double? longitude,
    bool? isPhoneVerified,
  }) {
    return VendorProfile(
      id: id,
      vendorId: vendorId,
      businessName: businessName ?? this.businessName,
      ownerName: ownerName ?? this.ownerName,
      supportPhone: supportPhone ?? this.supportPhone,
      gstNumber: gstNumber ?? this.gstNumber,
      addressLine1: addressLine1 ?? this.addressLine1,
      addressLine2: addressLine2 ?? this.addressLine2,
      city: city ?? this.city,
      state: state ?? this.state,
      postalCode: postalCode ?? this.postalCode,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      onboardingCompleted: onboardingCompleted,
      isPhoneVerified: isPhoneVerified ?? this.isPhoneVerified,
    );
  }

  factory VendorProfile.fromJson(Map<String, dynamic> json) {
    double? lat;
    double? lng;
    if (json['latitude'] != null) {
      lat = double.tryParse(json['latitude'].toString());
    }
    if (json['longitude'] != null) {
      lng = double.tryParse(json['longitude'].toString());
    }
    return VendorProfile(
      id: json['id']?.toString() ?? '',
      vendorId: json['vendorId']?.toString() ?? '',
      businessName: json['businessName']?.toString() ?? '',
      ownerName: json['ownerName']?.toString() ?? '',
      supportPhone: json['supportPhone']?.toString() ?? '',
      gstNumber: json['gstNumber']?.toString(),
      addressLine1: json['addressLine1']?.toString() ?? '',
      addressLine2: json['addressLine2']?.toString(),
      city: json['city']?.toString() ?? '',
      state: json['state']?.toString() ?? '',
      postalCode: json['postalCode']?.toString() ?? '',
      latitude: lat,
      longitude: lng,
      onboardingCompleted: json['onboardingCompleted'] == true,
      isPhoneVerified: json['isPhoneVerified'] == true || json['phoneVerified'] == true,
    );
  }
}

class VendorStatus {
  final String id;
  final String email;
  final bool isEmailVerified;
  final String accountStatus;
  final String registrationStage;

  const VendorStatus({
    required this.id,
    required this.email,
    required this.isEmailVerified,
    required this.accountStatus,
    required this.registrationStage,
  });

  bool get isPending =>
      accountStatus.trim().toLowerCase() == 'pending';

  factory VendorStatus.fromJson(Map<String, dynamic> json) {
    return VendorStatus(
      id: json['id']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      isEmailVerified: json['isEmailVerified'] == true,
      accountStatus: json['accountStatus']?.toString() ?? '',
      registrationStage: json['registrationStage']?.toString() ?? '',
    );
  }
}