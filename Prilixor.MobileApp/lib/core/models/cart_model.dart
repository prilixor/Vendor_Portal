class CartLineModel {
  final String listingId;
  final String title;
  final String? primaryImageUrl;
  final double dailyRent;
  final double securityDeposit;
  int quantity;
  int rentalDays;
  String orderType; // 'rent' or 'buy'

  CartLineModel({
    required this.listingId,
    required this.title,
    this.primaryImageUrl,
    required this.dailyRent,
    required this.securityDeposit,
    this.quantity = 1,
    this.rentalDays = 1,
    this.orderType = 'rent',
  });

  double get lineTotal {
    if (orderType == 'buy') {
      return dailyRent * 30 * quantity; // Buy price estimate
    }
    return dailyRent * quantity * rentalDays;
  }

  Map<String, dynamic> toJson() {
    return {
      'listingId': listingId,
      'title': title,
      'primaryImageUrl': primaryImageUrl,
      'dailyRent': dailyRent,
      'securityDeposit': securityDeposit,
      'quantity': quantity,
      'rentalDays': rentalDays,
      'orderType': orderType,
    };
  }

  factory CartLineModel.fromJson(Map<String, dynamic> json) {
    return CartLineModel(
      listingId: json['listingId'],
      title: json['title'],
      primaryImageUrl: json['primaryImageUrl'],
      dailyRent: (json['dailyRent'] as num).toDouble(),
      securityDeposit: (json['securityDeposit'] as num).toDouble(),
      quantity: json['quantity'],
      rentalDays: json['rentalDays'],
      orderType: json['orderType'],
    );
  }
}
