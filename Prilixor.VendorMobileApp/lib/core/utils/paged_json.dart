Map<String, dynamic>? asJsonMap(dynamic data) {
  if (data is Map<String, dynamic>) return data;
  if (data is Map) return Map<String, dynamic>.from(data);
  return null;
}

List<dynamic> asJsonList(dynamic data) {
  if (data is List) return data;
  return const [];
}

int asJsonInt(dynamic value, [int fallback = 0]) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value?.toString() ?? '') ?? fallback;
}

double asJsonDouble(dynamic value, [double fallback = 0]) {
  if (value is double) return value;
  if (value is num) return value.toDouble();
  return double.tryParse(value?.toString() ?? '') ?? fallback;
}

Map<String, int> asJsonIntMap(dynamic data) {
  final map = asJsonMap(data);
  if (map == null) return {};
  return map.map((key, value) => MapEntry(key, asJsonInt(value)));
}
