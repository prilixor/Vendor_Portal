import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:prilixor_vendor_mobile/core/auth/auth_provider.dart';
import 'package:prilixor_vendor_mobile/main.dart';

void main() {
  testWidgets('Vendor app builds AuthGate', (WidgetTester tester) async {
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => AuthProvider()),
        ],
        child: const PrilixorVendorApp(),
      ),
    );

    // Bootstrapping spinner while session restore runs.
    expect(find.byType(AuthGate), findsOneWidget);
  });
}
