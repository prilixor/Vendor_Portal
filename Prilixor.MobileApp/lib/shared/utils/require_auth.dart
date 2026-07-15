import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_provider.dart';
import '../../features/auth/login_screen.dart';

/// Returns true if the user is (or becomes) authenticated.
/// Guests are sent to [LoginScreen]; on success the login screen pops
/// so the caller can continue (e.g. open checkout). Cart stays local.
Future<bool> ensureAuthenticated(
  BuildContext context, {
  String? message,
}) async {
  final auth = Provider.of<AuthProvider>(context, listen: false);
  if (auth.isAuthenticated) return true;

  if (message != null && context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
    );
  }

  final loggedIn = await Navigator.push<bool>(
    context,
    MaterialPageRoute(builder: (_) => const LoginScreen(popOnSuccess: true)),
  );
  return loggedIn == true;
}
