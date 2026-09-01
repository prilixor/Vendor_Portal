import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/auth/auth_provider.dart';
import 'core/connectivity/connectivity_provider.dart';
import 'core/theme.dart';
import 'features/auth/login_screen.dart';
import 'features/auth/reset_password_screen.dart';
import 'features/auth/verify_email_screen.dart';
import 'features/dashboard/customer_dashboard.dart';
import 'features/medical/doctor_public_screen.dart';
import 'shared/widgets/offline_banner.dart';
import 'shared/widgets/brand_splash.dart';

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
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.system,
      home: const AuthGate(),
      debugShowCheckedModeBanner: false,
      builder: (context, child) => OfflineAwareAppShell(child: child),
      onGenerateRoute: (settings) {
        final name = settings.name ?? '';
        final uri = Uri.tryParse(name.startsWith('http') ? name : 'app://local$name');
        final path = uri?.path ?? name;
        final qp = uri?.queryParameters ?? const <String, String>{};

        if (path == '/verify-email' || path.endsWith('/verify-email')) {
          return MaterialPageRoute(
            builder: (_) => VerifyEmailScreen(
              token: qp['token'] ?? settings.arguments as String?,
            ),
            settings: settings,
          );
        }
        if (path == '/reset-password' || path.endsWith('/reset-password')) {
          return MaterialPageRoute(
            builder: (_) => ResetPasswordScreen(
              token: qp['token'] ?? settings.arguments as String?,
            ),
            settings: settings,
          );
        }
        if (path.startsWith('/dr/') || path.contains('/dr/')) {
          final code = path.split('/dr/').last.split('/').first;
          if (code.trim().isNotEmpty) {
            return MaterialPageRoute(
              builder: (_) => DoctorPublicScreen(code: Uri.decodeComponent(code)),
              settings: settings,
            );
          }
        }
        return null;
      },
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
      return const BrandSplash(label: 'Loading BlinksMed…');
    }
    if (auth.isAuthenticated) {
      return CustomerDashboard(key: CustomerDashboard.navigationKey);
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
                    borderRadius: BorderRadius.circular(12),
                    child: ColoredBox(
                      color: Colors.white,
                      child: Padding(
                        padding: const EdgeInsets.all(6),
                        child: Image.asset(
                          'assets/branding/logo.png',
                          width: 80,
                          height: 80,
                          fit: BoxFit.contain,
                        ),
                      ),
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
                      MaterialPageRoute(
                        builder: (context) => CustomerDashboard(key: CustomerDashboard.navigationKey),
                      ),
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
