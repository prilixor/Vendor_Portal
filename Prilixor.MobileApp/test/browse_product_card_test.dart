import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:prilixor_mobile/core/models/product_model.dart';
import 'package:prilixor_mobile/core/providers/favorite_provider.dart';
import 'package:prilixor_mobile/core/theme.dart';
import 'package:prilixor_mobile/shared/widgets/browse_product_card.dart';

void main() {
  testWidgets('shop card image well is a square that fits the grid row', (
    tester,
  ) async {
    const cardWidth = 168.0;
    final product = ProductModel(
      id: 'listing-1',
      title: '3 Function Motorized Bed',
      vendorName: 'Care Rentals',
      vendorRating: 4.5,
      serviceAreaHint: 'Ahmedabad',
      categoryName: 'Beds',
      dailyRent: 166,
      monthlyRent: 3200,
      securityDeposit: 10000,
      prescriptionRequired: false,
      depositRequired: true,
      listingStatus: 'active',
      availableQuantity: 4,
      productTotalAvailableQuantity: 4,
      availabilityStatus: 'in_stock',
      buyPrice: 18000,
      maxBuyPrice: 22000,
      isBuyEnabled: true,
    );

    await tester.pumpWidget(
      ChangeNotifierProvider(
        create: (_) => FavoriteProvider(),
        child: MaterialApp(
          theme: AppTheme.darkTheme,
          home: Scaffold(
            body: Center(
              child: SizedBox(
                width: cardWidth,
                height: browseProductCardExtent(cardWidth),
                child: BrowseProductCard(product: product, onTap: () {}),
              ),
            ),
          ),
        ),
      ),
    );

    final aspect = tester.widget<AspectRatio>(find.byType(AspectRatio));
    expect(aspect.aspectRatio, 1);
    expect(find.byType(ColoredBox), findsWidgets);
    expect(tester.takeException(), isNull);
  });
}
