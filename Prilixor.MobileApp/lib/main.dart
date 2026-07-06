import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/theme.dart';
import 'core/auth/auth_provider.dart';
import 'features/auth/login_screen.dart';

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

void main() {
  runApp(
    MultiProvider(
      providers: [
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
      title: 'Prilixor',
      theme: AppTheme.darkTheme,
      home: const WelcomeScreen(),
      debugShowCheckedModeBanner: false,
    );
  }
}

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
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
                const Icon(
                  Icons.storefront_rounded,
                  size: 100,
                  color: Color(0xFF6C63FF),
                ),
                const SizedBox(height: 32),
                const Text(
                  'Prilixor Mobile',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Browse, rent, and buy premium products seamlessly on the go.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 16,
                    color: Colors.grey,
                  ),
                ),
                const SizedBox(height: 48),
                ElevatedButton(
                  onPressed: () {
                    // Navigate to Login (Phase 3)
                    Navigator.pushReplacement(
                      context,
                      MaterialPageRoute(builder: (context) => const LoginScreen()),
                    );
                  },
                  child: const Text('Get Started', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
