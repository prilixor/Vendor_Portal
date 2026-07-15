class CategoryModel {
  final String id;
  final String categoryName;
  final bool prescriptionRequired;
  final bool depositRequired;
  final bool installationRequired;
  final bool isActive;
  final bool isChemical;

  CategoryModel({
    required this.id,
    required this.categoryName,
    required this.prescriptionRequired,
    required this.depositRequired,
    required this.installationRequired,
    required this.isActive,
    this.isChemical = false,
  });

  factory CategoryModel.fromJson(Map<String, dynamic> json) {
    return CategoryModel(
      id: json['id'] ?? '',
      categoryName: json['categoryName'] ?? '',
      prescriptionRequired: json['prescriptionRequired'] ?? false,
      depositRequired: json['depositRequired'] ?? false,
      installationRequired: json['installationRequired'] ?? false,
      isActive: json['isActive'] ?? true,
      isChemical: json['isChemical'] ?? false,
    );
  }
}
