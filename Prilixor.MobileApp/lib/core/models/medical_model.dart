class HospitalModel {
  final String id;
  final String name;
  final String? addressLine1;
  final String? city;
  final String? state;
  final String? postalCode;

  HospitalModel({
    required this.id,
    required this.name,
    this.addressLine1,
    this.city,
    this.state,
    this.postalCode,
  });

  factory HospitalModel.fromJson(Map<String, dynamic> json) {
    return HospitalModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      addressLine1: json['addressLine1']?.toString(),
      city: json['city']?.toString(),
      state: json['state']?.toString(),
      postalCode: json['postalCode']?.toString(),
    );
  }

  String? get placeLabel {
    final parts = [city, state]
        .map((p) => p?.trim())
        .whereType<String>()
        .where((p) => p.isNotEmpty)
        .toList();
    return parts.isEmpty ? null : parts.join(', ');
  }

  String? get detailLabel {
    final line = addressLine1?.trim();
    final place = placeLabel;
    if (line != null && line.isNotEmpty && place != null) return '$line · $place';
    if (line != null && line.isNotEmpty) return line;
    return place;
  }
}

class DoctorModel {
  final String id;
  final String fullName;
  final String uniqueCode;
  final String? email;
  final String? specialization;
  final String? contactNumber;
  final bool isActive;
  final String? publicPageUrl;
  final List<HospitalModel> hospitals;

  DoctorModel({
    required this.id,
    required this.fullName,
    required this.uniqueCode,
    this.email,
    this.specialization,
    this.contactNumber,
    this.isActive = true,
    this.publicPageUrl,
    this.hospitals = const [],
  });

  factory DoctorModel.fromJson(Map<String, dynamic> json) {
    final rawHospitals = json['hospitals'];
    final hospitals = <HospitalModel>[];
    if (rawHospitals is List) {
      for (final item in rawHospitals) {
        if (item is Map<String, dynamic>) {
          final h = HospitalModel.fromJson(item);
          if (h.id.isNotEmpty && h.name.isNotEmpty) hospitals.add(h);
        } else if (item is Map) {
          final h = HospitalModel.fromJson(Map<String, dynamic>.from(item));
          if (h.id.isNotEmpty && h.name.isNotEmpty) hospitals.add(h);
        }
      }
    }
    return DoctorModel(
      id: json['id']?.toString() ?? '',
      fullName: json['fullName'] ?? '',
      uniqueCode: (json['uniqueCode'] ?? '').toString().toUpperCase(),
      email: json['email'],
      specialization: json['specialization'],
      contactNumber: json['contactNumber'],
      isActive: json['isActive'] ?? true,
      publicPageUrl: json['publicPageUrl'],
      hospitals: hospitals,
    );
  }
}

/// Optional doctor Unique ID reference attached to a cart line at checkout.
class MedicalRefModel {
  final String doctorId;
  final String uniqueCode;
  final String? doctorName;
  final String? specialization;
  final List<HospitalModel> hospitals;

  const MedicalRefModel({
    this.doctorId = '',
    this.uniqueCode = '',
    this.doctorName,
    this.specialization,
    this.hospitals = const [],
  });

  bool get hasDoctor => doctorId.isNotEmpty;

  MedicalRefModel copyWith({
    String? doctorId,
    String? uniqueCode,
    String? doctorName,
    String? specialization,
    List<HospitalModel>? hospitals,
  }) {
    return MedicalRefModel(
      doctorId: doctorId ?? this.doctorId,
      uniqueCode: uniqueCode ?? this.uniqueCode,
      doctorName: doctorName ?? this.doctorName,
      specialization: specialization ?? this.specialization,
      hospitals: hospitals ?? this.hospitals,
    );
  }
}
