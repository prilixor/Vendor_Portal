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
        title: const Text('Verify Email', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF0F172A),
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_verifying) ...[
                const SizedBox(height: 60),
                const Center(child: CircularProgressIndicator(color: Color(0xFF6C63FF))),
                const SizedBox(height: 20),
                const Text(
                  'Verifying your email token...',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.white70, fontSize: 16),
                ),
              ] else if (_success != null) ...[
                const SizedBox(height: 20),
                Center(
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: (_success! ? const Color(0xFF10B981) : Colors.redAccent).withValues(alpha: 0.15),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      _success! ? Icons.check_circle_outline_rounded : Icons.error_outline_rounded,
                      size: 64,
                      color: _success! ? const Color(0xFF10B981) : Colors.redAccent,
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: (_success! ? const Color(0xFF10B981) : Colors.redAccent).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: (_success! ? const Color(0xFF10B981) : Colors.redAccent).withValues(alpha: 0.4),
                    ),
                  ),
                  child: Text(
                    _message ?? '',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: _success! ? const Color(0xFF10B981) : Colors.redAccent,
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                  ),
                ),
                if (_success == true) ...[
                  const SizedBox(height: 24),
                  SizedBox(
                    height: 52,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF6C63FF),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                      onPressed: () {
                        Navigator.of(context).pushAndRemoveUntil(
                          MaterialPageRoute(builder: (_) => const LoginScreen()),
                          (_) => false,
                        );
                      },
                      child: const Text('Go to sign in', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
                    ),
                  ),
                ],
              ] else ...[
                const SizedBox(height: 10),
                Center(
                  child: Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: const Color(0xFF6C63FF).withValues(alpha: 0.15),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.mark_email_read_outlined,
                      size: 64,
                      color: Color(0xFF6C63FF),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                const Text(
                  'Check your email',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  _emailController.text.trim().isNotEmpty
                      ? 'A verification link has been sent to ${_emailController.text.trim()}. Please verify your email before logging in.'
                      : 'A verification link has been sent to your email. You must verify it before signing in.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Colors.white70,
                    fontSize: 14,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 24),
                SizedBox(
                  height: 52,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF6C63FF),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    onPressed: () {
                      Navigator.of(context).pushAndRemoveUntil(
                        MaterialPageRoute(builder: (_) => const LoginScreen()),
                        (_) => false,
                      );
                    },
                    child: const Text('Go to sign in', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
                  ),
                ),
                const SizedBox(height: 32),
                const Divider(color: Colors.white12),
                const SizedBox(height: 16),
                const Text(
                  'Didn’t get the email? Enter your address to resend.',
                  style: TextStyle(color: Colors.white54, fontSize: 13),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  style: const TextStyle(color: Colors.white),
                  decoration: InputDecoration(
                    labelText: 'Email',
                    labelStyle: const TextStyle(color: Colors.white54),
                    prefixIcon: const Icon(Icons.email_outlined, color: Colors.white54),
                    filled: true,
                    fillColor: const Color(0xFF1E293B),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Colors.white12),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Colors.white12),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  height: 48,
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF6C63FF),
                      side: const BorderSide(color: Color(0xFF6C63FF)),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: auth.isLoading ? null : _resend,
                    child: auth.isLoading
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF6C63FF)),
                          )
                        : const Text('Resend verification email', style: TextStyle(fontWeight: FontWeight.w600)),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
