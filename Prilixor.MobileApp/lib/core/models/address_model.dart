class AddressModel {
  final String id;
  final String? label;
  final String line1;
  final String city;
  final String state;
  final String postal;
  final double? latitude;
  final double? longitude;
  final bool isDefault;

  AddressModel({
    required this.id,
    this.label,
    required this.line1,
    required this.city,
    required this.state,
    required this.postal,
    this.latitude,
    this.longitude,
    this.isDefault = false,
  });

  factory AddressModel.fromJson(Map<String, dynamic> json) {
    return AddressModel(
      id: json['id'],
      label: json['label'],
      line1: json['line1'] ?? '',
      city: json['city'] ?? '',
      state: json['state'] ?? '',
      postal: json['postal'] ?? '',
      latitude: json['latitude']?.toDouble(),
      longitude: json['longitude']?.toDouble(),
      isDefault: json['isDefault'] ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'label': label,
      'line1': line1,
      'city': city,
      'state': state,
      'postal': postal,
      'latitude': latitude,
      'longitude': longitude,
      'isDefault': isDefault,
    };
  }
}
