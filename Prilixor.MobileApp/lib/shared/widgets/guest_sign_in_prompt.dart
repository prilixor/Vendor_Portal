import 'package:flutter/material.dart';
import '../../features/auth/login_screen.dart';

/// Polished empty state for guest users or expired sessions (Orders, Alerts, Profile, etc.).
class GuestSignInPrompt extends StatelessWidget {
  final String title;
  final String message;
  final IconData icon;
  final String primaryLabel;
  final VoidCallback? onPrimary;
  final String? secondaryLabel;
  final VoidCallback? onSecondary;

  const GuestSignInPrompt({
    super.key,
    required this.title,
    this.message = 'Sign in to view this section.',
    this.icon = Icons.lock_person_rounded,
    this.primaryLabel = 'Sign in',
    this.onPrimary,
    this.secondaryLabel,
    this.onSecondary,
  });

  /// Guest browsing catalog — needs login to access account features.
  factory GuestSignInPrompt.guest({
    required String title,
    required String message,
    IconData icon = Icons.lock_person_rounded,
  }) {
    return GuestSignInPrompt(
      title: title,
      message: message,
      icon: icon,
    );
  }

  /// Stored token is no longer valid — prompt re-login.
  factory GuestSignInPrompt.sessionExpired({
    required VoidCallback onSignInAgain,
    String title = 'Session expired',
    String message = 'Your sign-in session ended. Sign in again to continue.',
  }) {
    return GuestSignInPrompt(
      title: title,
      message: message,
      icon: Icons.lock_clock_rounded,
      primaryLabel: 'Sign in again',
      onPrimary: onSignInAgain,
    );
  }

  /// Network or server error — offer retry, with optional re-login fallback.
  factory GuestSignInPrompt.loadError({
    required VoidCallback onRetry,
    VoidCallback? onSignInAgain,
    String title = 'Could not load',
    String message = 'Something went wrong. Check your connection and try again.',
  }) {
    return GuestSignInPrompt(
      title: title,
      message: message,
      icon: Icons.cloud_off_outlined,
      primaryLabel: 'Try again',
      onPrimary: onRetry,
      secondaryLabel: onSignInAgain != null ? 'Sign in again' : null,
      onSecondary: onSignInAgain,
    );
  }

  void _defaultSignIn(BuildContext context) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const LoginScreen(popOnSuccess: true)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 360),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
            decoration: BoxDecoration(
              color: const Color(0xFF1E293B),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.25),
                  blurRadius: 24,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: const Color(0xFF6C63FF).withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                    border: Border.all(color: const Color(0xFF6C63FF).withValues(alpha: 0.35)),
                  ),
                  child: Icon(icon, size: 36, color: const Color(0xFF6C63FF)),
                ),
                const SizedBox(height: 20),
                Text(
                  title,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    height: 1.25,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  message,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Colors.white60,
                    fontSize: 14,
                    height: 1.45,
                  ),
                ),
                const SizedBox(height: 28),
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton(
                    onPressed: () {
                      if (onPrimary != null) {
                        onPrimary!();
                      } else {
                        _defaultSignIn(context);
                      }
                    },
                    child: Text(
                      primaryLabel,
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
                if (secondaryLabel != null && onSecondary != null) ...[
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white70,
                        side: BorderSide(color: Colors.white.withValues(alpha: 0.18)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: onSecondary,
                      child: Text(
                        secondaryLabel!,
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
