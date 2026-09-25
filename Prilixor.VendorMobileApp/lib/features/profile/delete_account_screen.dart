import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/config/app_urls.dart';
import '../../core/theme.dart';
import '../../shared/widgets/custom_text_field.dart';
import '../auth/login_screen.dart';

class DeleteAccountScreen extends StatefulWidget {
  const DeleteAccountScreen({super.key});

  @override
  State<DeleteAccountScreen> createState() => _DeleteAccountScreenState();
}

class _DeleteAccountScreenState extends State<DeleteAccountScreen> {
  final _password = TextEditingController();
  final _confirmation = TextEditingController();
  String? _passwordError;
  String? _confirmationError;

  @override
  void dispose() {
    _password.dispose();
    _confirmation.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final passwordError = _password.text.isEmpty ? 'Password is required' : null;
    final confirmationError = _confirmation.text.trim().toUpperCase() == 'DELETE'
        ? null
        : 'Type DELETE to confirm';
    setState(() {
      _passwordError = passwordError;
      _confirmationError = confirmationError;
    });
    if (passwordError != null || confirmationError != null) return;

    final auth = Provider.of<AuthProvider>(context, listen: false);
    final ok = await auth.deleteAccount(_password.text);
    if (!mounted) return;
    if (!ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(auth.errorMessage ?? 'Could not delete this account.'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (_) => false,
    );
  }

  Future<void> _openWebPage() async {
    final uri = Uri.parse(AppUrls.deleteAccountUrl);
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final colors = context.appColors;

    return Scaffold(
      appBar: AppBar(title: const Text('Delete account')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            'This closes your BlinksMed Vendor login. Your name, email, phone, and business contact details are removed.',
            style: TextStyle(color: colors.textSecondary, height: 1.4),
          ),
          const SizedBox(height: 12),
          Text(
            'Finish or decline any open order before you continue. Past orders stay on record. You can also do this in a browser if you no longer have the app.',
            style: TextStyle(color: colors.textMuted, height: 1.4, fontSize: 13),
          ),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton(
              onPressed: _openWebPage,
              child: const Text(AppUrls.deleteAccountUrl),
            ),
          ),
          CustomTextField(
            label: 'Password',
            icon: Icons.lock_outline,
            isPassword: true,
            required: true,
            errorText: _passwordError,
            controller: _password,
            onChanged: (_) {
              if (_passwordError != null) setState(() => _passwordError = null);
            },
          ),
          const SizedBox(height: 12),
          CustomTextField(
            label: 'Type DELETE to confirm',
            icon: Icons.warning_amber_outlined,
            required: true,
            errorText: _confirmationError,
            controller: _confirmation,
            onChanged: (_) {
              if (_confirmationError != null) setState(() => _confirmationError = null);
            },
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.redAccent,
              foregroundColor: Colors.white,
              minimumSize: const Size.fromHeight(52),
            ),
            onPressed: auth.isLoading ? null : _submit,
            child: auth.isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Text('Delete account', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }
}
