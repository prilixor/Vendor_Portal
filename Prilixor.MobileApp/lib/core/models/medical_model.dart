class HospitalModel {
  final String id;
  final String name;
  final String? addressLine1;
  final String? city;
  final String? state;
  final String? postalCode;
  final bool isVerified;

  HospitalModel({
    required this.id,
    required this.name,
    this.addressLine1,
    this.city,
    this.state,
    this.postalCode,
    this.isVerified = false,
  });

  factory HospitalModel.fromJson(Map<String, dynamic> json) {
    return HospitalModel(
      id: json['id']?.toString() ?? '',
      name: json['name'] ?? '',
      addressLine1: json['addressLine1'],
      city: json['city'],
      state: json['state'],
      postalCode: json['postalCode'],
      isVerified: json['isVerified'] ?? false,
    );
  }
}

class DoctorModel {
  final String id;
  final String fullName;
  final String? specialization;
  final String? contactNumber;
  final bool isVerified;

  DoctorModel({
    required this.id,
    required this.fullName,
    this.specialization,
    this.contactNumber,
    this.isVerified = false,
  });

  factory DoctorModel.fromJson(Map<String, dynamic> json) {
    return DoctorModel(
      id: json['id']?.toString() ?? '',
      fullName: json['fullName'] ?? '',
      specialization: json['specialization'],
      contactNumber: json['contactNumber'],
      isVerified: json['isVerified'] ?? false,
    );
  }
}

/// Prescription reference attached to a cart line at checkout (mirrors React MedicalRef).
class MedicalRefModel {
  final String hospitalId;
  final String doctorId;
  final String contactNumber;
  final String referenceNumber;
  final String? hospitalName;
  final String? doctorName;

  const MedicalRefModel({
    this.hospitalId = '',
    this.doctorId = '',
    this.contactNumber = '',
    this.referenceNumber = '',
    this.hospitalName,
    this.doctorName,
  });

  bool get isComplete => hospitalId.isNotEmpty && doctorId.isNotEmpty;

  MedicalRefModel copyWith({
    String? hospitalId,
    String? doctorId,
    String? contactNumber,
    String? referenceNumber,
    String? hospitalName,
    String? doctorName,
  }) {
    return MedicalRefModel(
      hospitalId: hospitalId ?? this.hospitalId,
      doctorId: doctorId ?? this.doctorId,
      contactNumber: contactNumber ?? this.contactNumber,
      referenceNumber: referenceNumber ?? this.referenceNumber,
      hospitalName: hospitalName ?? this.hospitalName,
      doctorName: doctorName ?? this.doctorName,
    );
  }
}
