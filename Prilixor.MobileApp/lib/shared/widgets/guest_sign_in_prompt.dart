import 'package:flutter/material.dart';
import '../../features/auth/login_screen.dart';

/// Shown on Orders / Alerts / etc. when user entered via guest "Browse catalog".
class GuestSignInPrompt extends StatelessWidget {
  final String title;
  final String message;

  const GuestSignInPrompt({
    super.key,
    required this.title,
    this.message = 'Sign in to view this section.',
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.lock_outline, size: 56, color: Colors.white24),
            const SizedBox(height: 16),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white54, fontSize: 14),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const LoginScreen(popOnSuccess: true)),
                );
              },
              child: const Text('Sign in', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }
}
