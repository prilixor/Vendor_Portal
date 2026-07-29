import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/auth/auth_provider.dart';
import 'core/connectivity/connectivity_provider.dart';
import 'core/theme.dart';
import 'features/auth/login_screen.dart';
import 'features/dashboard/customer_dashboard.dart';
import 'shared/widgets/offline_banner.dart';

import 'core/providers/product_provider.dart';
import 'core/providers/checkout_provider.dart';
import 'core/providers/order_provider.dart';
import 'core/providers/order_detail_provider.dart';
import 'core/providers/notification_provider.dart';
import 'core/providers/profile_provider.dart';
import 'core/providers/chat_provider.dart';
import 'core/providers/favorite_provider.dart';
import 'core/providers/location_provider.dart';
import 'core/providers/address_provider.dart';
import 'core/providers/cart_provider.dart';
import 'core/providers/medical_provider.dart';

void main() {
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => ConnectivityProvider()),
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => ProductProvider()),
        ChangeNotifierProvider(create: (_) => CheckoutProvider()),
        ChangeNotifierProvider(create: (_) => OrderProvider()),
        ChangeNotifierProvider(create: (_) => OrderDetailProvider()),
        ChangeNotifierProvider(create: (_) => NotificationProvider()),
        ChangeNotifierProvider(create: (_) => ProfileProvider()),
        ChangeNotifierProvider(create: (_) => FavoriteProvider()),
        ChangeNotifierProvider(create: (_) => LocationProvider()),
        ChangeNotifierProvider(create: (_) => AddressProvider()),
        ChangeNotifierProvider(create: (_) => CartProvider()),
        ChangeNotifierProvider(create: (_) => MedicalProvider()),
        ChangeNotifierProxyProvider<ProfileProvider, ChatProvider>(
          create: (ctx) => ChatProvider(ctx.read<ProfileProvider>()),
          update: (ctx, profile, prev) => ChatProvider(profile),
        ),
      ],
      child: const PrilixorMobileApp(),
    ),
  );
}

class PrilixorMobileApp extends StatelessWidget {
  const PrilixorMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'BlinksMed',
      theme: AppTheme.darkTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.dark,
      home: const AuthGate(),
      debugShowCheckedModeBanner: false,
      builder: (context, child) => OfflineAwareAppShell(child: child),
    );
  }
}

/// Restores JWT session (like web) or shows Welcome.
class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final ok = await auth.tryRestoreSession();
      if (!mounted) return;
      if (ok) {
        // Warm profile; interceptor/refresh handles expired access tokens.
        Provider.of<ProfileProvider>(context, listen: false).fetchProfile();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    if (auth.isBootstrapping) {
      return Scaffold(
        body: Center(
          child: CircularProgressIndicator(color: Theme.of(context).colorScheme.primary),
        ),
      );
    }
    if (auth.isAuthenticated) {
      return const CustomerDashboard();
    }
    return const WelcomeScreen();
  }
}

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [colors.background, colors.surface],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(24),
                    child: Image.asset(
                      'assets/branding/app_icon.png',
                      width: 112,
                      height: 112,
                      fit: BoxFit.cover,
                    ),
                  ),
                ),
                const SizedBox(height: 32),
                Text(
                  'BlinksMed',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                    color: colors.textPrimary,
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  'Browse, rent, and buy premium products seamlessly on the go.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 16,
                    color: colors.textMuted,
                  ),
                ),
                const SizedBox(height: 48),
                ElevatedButton(
                  onPressed: () {
                    Navigator.pushReplacement(
                      context,
                      MaterialPageRoute(builder: (context) => const LoginScreen()),
                    );
                  },
                  child: const Text('Sign in', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                ),
                const SizedBox(height: 12),
                OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: colors.textSecondary,
                    side: BorderSide(color: colors.border),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  onPressed: () {
                    // Guest browse: Discover + local cart only.
                    // Checkout, medical refs, orders, and account require sign-in.
                    Navigator.pushReplacement(
                      context,
                      MaterialPageRoute(builder: (context) => const CustomerDashboard()),
                    );
                  },
                  child: const Text('Browse catalog', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
