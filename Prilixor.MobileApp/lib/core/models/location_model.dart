class StateModel {
  final int id;
  final String name;
  final String iso2;

  StateModel({
    required this.id,
    required this.name,
    required this.iso2,
  });

  factory StateModel.fromJson(Map<String, dynamic> json) {
    return StateModel(
      id: json['id'] ?? 0,
      name: json['name'] ?? '',
      iso2: json['iso2'] ?? '',
    );
  }
}

class CityModel {
  final int id;
  final String name;

  CityModel({
    required this.id,
    required this.name,
  });

  factory CityModel.fromJson(Map<String, dynamic> json) {
    return CityModel(
      id: json['id'] ?? 0,
      name: json['name'] ?? '',
    );
  }
}
