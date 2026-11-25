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
                height: browseProductCardExtent(
                  cardWidth,
                  title: product.title,
                  includeDeposit: true,
                ),
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
    expect(find.textContaining('Also buy'), findsNothing);
    expect(find.textContaining('Deposit'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('chemical card ends on the price inside the shorter row', (
    tester,
  ) async {
    const cardWidth = 168.0;
    final product = ProductModel(
      id: 'chem-1',
      title: 'QA Potassium Chloride AR',
      vendorName: 'Lab Supply',
      vendorRating: 0,
      serviceAreaHint: 'Ahmedabad',
      categoryName: 'Chemicals',
      dailyRent: 0,
      monthlyRent: 0,
      securityDeposit: 0,
      prescriptionRequired: false,
      depositRequired: false,
      listingStatus: 'active',
      availableQuantity: 2,
      productTotalAvailableQuantity: 2,
      availabilityStatus: 'in_stock',
      buyPrice: 140,
      isRentEnabled: false,
      isBuyEnabled: true,
      isChemical: true,
      baseUnit: 'Kg',
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
                height: browseProductCardExtent(
                  cardWidth,
                  title: product.title,
                  includeDeposit: false,
                ),
                child: BrowseProductCard(product: product, onTap: () {}),
              ),
            ),
          ),
        ),
      ),
    );

    expect(find.textContaining('Deposit'), findsNothing);
    expect(find.textContaining('140'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'a short name keeps its price under the name beside a long name',
    (tester) async {
      const cardWidth = 168.0;
      ProductModel item(String id, String title) => ProductModel(
        id: id,
        title: title,
        vendorName: 'Care Rentals',
        vendorRating: 0,
        serviceAreaHint: 'Ahmedabad',
        categoryName: 'Beds',
        dailyRent: 100,
        monthlyRent: 0,
        securityDeposit: 1000,
        prescriptionRequired: false,
        depositRequired: true,
        listingStatus: 'active',
        availableQuantity: 1,
        productTotalAvailableQuantity: 1,
        availabilityStatus: 'in_stock',
      );

    final left = item('short', 'Pump');
    final right = item('long', 'Multipara Monitor 5 Para With Extra Words');

      await tester.pumpWidget(
        ChangeNotifierProvider(
          create: (_) => FavoriteProvider(),
          child: MaterialApp(
            theme: AppTheme.darkTheme,
            home: Scaffold(
              body: Center(
                child: SizedBox(
                  width: cardWidth * 2 + 12,
                  child: BrowseProductPair(
                    left: left,
                    right: right,
                    cardWidth: cardWidth,
                    bottomGap: 0,
                    onTap: (_) {},
                  ),
                ),
              ),
            ),
          ),
        ),
      );

    expect(find.text('Pump'), findsOneWidget);
    expect(tester.takeException(), isNull);

    final shortCard = find.ancestor(
      of: find.text('Pump'),
      matching: find.byType(BrowseProductCard),
    );
    final shortName = tester.getTopLeft(find.text('Pump'));
    final nameHeight = tester.getSize(find.text('Pump')).height;
    final shortPrice = tester.getTopLeft(
      find.descendant(of: shortCard, matching: find.textContaining('/day')),
    );
    expect(shortPrice.dy - shortName.dy, lessThan(nameHeight + 12));
    },
  );
}
