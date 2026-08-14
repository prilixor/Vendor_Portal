import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'core/auth/auth_provider.dart';
import 'core/connectivity/connectivity_provider.dart';
import 'core/providers/vendor_home_provider.dart';
import 'core/providers/vendor_location_provider.dart';
import 'core/providers/vendor_onboarding_provider.dart';
import 'core/providers/vendor_service_area_provider.dart';
import 'core/providers/vendor_catalog_provider.dart';
import 'core/providers/vendor_notification_provider.dart';
import 'core/providers/vendor_order_provider.dart';
import 'core/providers/vendor_profile_provider.dart';
import 'core/providers/vendor_support_provider.dart';
import 'core/theme.dart';
import 'features/auth/login_screen.dart';
import 'features/auth/register_screen.dart';
import 'features/dashboard/vendor_dashboard.dart';
import 'shared/widgets/offline_banner.dart';
import 'shared/widgets/brand_splash.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    debugPrint('FlutterError: ${details.exceptionAsString()}');
  };

  PlatformDispatcher.instance.onError = (error, stack) {
    debugPrint('Uncaught platform error: $error\n$stack');
    // Keep the app alive for non-fatal async errors after resume.
    return true;
  };

  ErrorWidget.builder = (details) {
    return Material(
      color: const Color(0xFF0F172A),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            details.exceptionAsString(),
            style: const TextStyle(color: Colors.white70, fontSize: 13),
          ),
        ),
      ),
    );
  };

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => ConnectivityProvider()),
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => VendorOrderProvider()),
        ChangeNotifierProvider(create: (_) => VendorNotificationProvider()),
        ChangeNotifierProvider(create: (_) => VendorProfileProvider()),
        ChangeNotifierProvider(create: (_) => VendorCatalogProvider()),
        ChangeNotifierProvider(create: (_) => VendorSupportProvider()),
        ChangeNotifierProvider(create: (_) => VendorOnboardingProvider()),
        ChangeNotifierProvider(create: (_) => VendorLocationProvider()),
        ChangeNotifierProvider(create: (_) => VendorServiceAreaProvider()),
        ChangeNotifierProvider(create: (_) => VendorHomeProvider()),
      ],
      child: const PrilixorVendorApp(),
    ),
  );
}

class PrilixorVendorApp extends StatelessWidget {
  const PrilixorVendorApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'BlinksMed Vendor',
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.system,
      home: const AuthGate(),
      debugShowCheckedModeBanner: false,
      builder: (context, child) => OfflineAwareAppShell(child: child),
    );
  }
}

/// Restores JWT session or shows vendor welcome / login.
class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  bool _started = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _bootstrap());
  }

  Future<void> _bootstrap() async {
    if (_started) return;
    _started = true;
    final auth = Provider.of<AuthProvider>(context, listen: false);
    try {
      await auth.tryRestoreSession().timeout(const Duration(seconds: 6));
    } on TimeoutException {
      await auth.forceEndBootstrap(clearAuth: !auth.isAuthenticated);
    } catch (e, st) {
      debugPrint('Auth bootstrap failed: $e\n$st');
      await auth.forceEndBootstrap(clearAuth: !auth.isAuthenticated);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    if (auth.isBootstrapping) {
      return BrandSplash(
        backgroundColor: AppTheme.bgColor,
        label: 'Loading BlinksMed Vendor…',
      );
    }
    if (auth.isAuthenticated) {
      return const VendorDashboard();
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
                      'assets/branding/logo.png',
                      width: 112,
                      height: 112,
                      fit: BoxFit.cover,
                    ),
                  ),
                ),
                const SizedBox(height: 32),
                Text(
                  'BlinksMed Vendor',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                    color: colors.textPrimary,
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  'Manage order requests, fulfillments, and alerts — separate from the Customer app.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 16, color: colors.textMuted),
                ),
                const SizedBox(height: 48),
                ElevatedButton(
                  onPressed: () {
                    Navigator.pushReplacement(
                      context,
                      MaterialPageRoute(builder: (_) => const LoginScreen()),
                    );
                  },
                  child: const Text(
                    'Sign in',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                ),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: () {
                    Navigator.pushReplacement(
                      context,
                      MaterialPageRoute(builder: (_) => const RegisterScreen()),
                    );
                  },
                  style: OutlinedButton.styleFrom(
                    foregroundColor: colors.textSecondary,
                    side: BorderSide(color: colors.border),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  child: const Text(
                    'Create account',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  'Manage orders, inventory, and alerts on the go.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: colors.textMuted,
                    fontSize: 12,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
