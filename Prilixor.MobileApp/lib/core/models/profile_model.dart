class ProfileModel {
  final String id;
  final String name;
  final String email;
  final String phoneNumber;
  final String joinDate;

  ProfileModel({
    required this.id,
    required this.name,
    required this.email,
    required this.phoneNumber,
    required this.joinDate,
  });

  factory ProfileModel.fromJson(Map<String, dynamic> json) {
    return ProfileModel(
      id: json['id']?.toString() ?? '',
      // API returns fullName / phone (matches web CustomerProfileDto).
      name: (json['fullName'] ?? json['name'] ?? '').toString(),
      email: json['email']?.toString() ?? '',
      phoneNumber: (json['phone'] ?? json['phoneNumber'] ?? '').toString(),
      joinDate: (json['createdAt'] ?? json['joinDate'] ?? '').toString(),
    );
  }
}

class AddressModel {
  final String id;
  final String label;
  final String streetAddress;
  final String city;
  final String state;
  final String postalCode;
  final bool isDefault;

  AddressModel({
    required this.id,
    required this.label,
    required this.streetAddress,
    required this.city,
    required this.state,
    required this.postalCode,
    required this.isDefault,
  });

  factory AddressModel.fromJson(Map<String, dynamic> json) {
    return AddressModel(
      id: json['id'] ?? '',
      label: json['label'] ?? '',
      streetAddress: json['streetAddress'] ?? '',
      city: json['city'] ?? '',
      state: json['state'] ?? '',
      postalCode: json['postalCode'] ?? '',
      isDefault: json['isDefault'] ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'label': label,
      'streetAddress': streetAddress,
      'city': city,
      'state': state,
      'postalCode': postalCode,
      'isDefault': isDefault,
    };
  }
}
