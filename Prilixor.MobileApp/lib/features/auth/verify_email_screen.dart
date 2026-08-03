import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_provider.dart';
import 'login_screen.dart';

class VerifyEmailScreen extends StatefulWidget {
  final String? token;
  final String? initialEmail;

  const VerifyEmailScreen({super.key, this.token, this.initialEmail});

  @override
  State<VerifyEmailScreen> createState() => _VerifyEmailScreenState();
}

class _VerifyEmailScreenState extends State<VerifyEmailScreen> {
  final _emailController = TextEditingController();
  bool _verifying = false;
  bool? _success;
  String? _message;

  @override
  void initState() {
    super.initState();
    _emailController.text = widget.initialEmail ?? '';
    final token = widget.token?.trim();
    if (token != null && token.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _verify(token));
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _verify(String token) async {
    setState(() {
      _verifying = true;
      _success = null;
      _message = null;
    });
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final ok = await auth.verifyEmail(token);
    if (!mounted) return;
    setState(() {
      _verifying = false;
      _success = ok;
      _message = ok
          ? 'Your email is verified. You can sign in now.'
          : (auth.errorMessage ?? 'Verification failed.');
    });
  }

  Future<void> _resend() async {
    final email = _emailController.text.trim();
    if (email.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter your email to resend verification.')),
      );
      return;
    }
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final ok = await auth.resendVerification(email);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          ok
              ? 'Verification email sent if the account exists.'
              : (auth.errorMessage ?? 'Could not resend verification.'),
        ),
        backgroundColor: ok ? Colors.green : Colors.redAccent,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        title: const Text('Verify email'),
        backgroundColor: const Color(0xFF0F172A),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          if (_verifying)
            const Padding(
              padding: EdgeInsets.only(top: 40),
              child: Center(child: CircularProgressIndicator(color: Color(0xFF6C63FF))),
            )
          else if (_success != null)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: (_success! ? Colors.green : Colors.amber).withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: (_success! ? Colors.green : Colors.amber).withValues(alpha: 0.4),
                ),
              ),
              child: Text(
                _message ?? '',
                style: TextStyle(
                  color: _success! ? Colors.greenAccent : Colors.amber,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          if (_success == true) ...[
            const SizedBox(height: 20),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF6C63FF),
                minimumSize: const Size.fromHeight(48),
              ),
              onPressed: () {
                Navigator.of(context).pushAndRemoveUntil(
                  MaterialPageRoute(builder: (_) => const LoginScreen()),
                  (_) => false,
                );
              },
              child: const Text('Go to sign in'),
            ),
          ],
          if (_success != true) ...[
            const SizedBox(height: 24),
            const Text(
              'Didn’t get the email? Enter your address to resend.',
              style: TextStyle(color: Colors.white54),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _emailController,
              keyboardType: TextInputType.emailAddress,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                labelText: 'Email',
                labelStyle: const TextStyle(color: Colors.white54),
                filled: true,
                fillColor: const Color(0xFF1E293B),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
            const SizedBox(height: 12),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF6C63FF),
                minimumSize: const Size.fromHeight(48),
              ),
              onPressed: auth.isLoading ? null : _resend,
              child: auth.isLoading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Resend verification email'),
            ),
          ],
        ],
      ),
    );
  }
}
