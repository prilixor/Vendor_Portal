import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api/api_client.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/config/app_urls.dart';
import '../../shared/widgets/required_field_ux.dart';
import 'login_screen.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _fullNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  bool _agreedToTerms = false;
  String? _nameError;
  String? _emailError;
  String? _passwordError;
  String? _confirmPasswordError;

  @override
  void dispose() {
    _fullNameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  bool _validate() {
    final nameErr = requiredMessage(_fullNameController.text, message: 'Full name is required');
    final emailErr = requiredMessage(_emailController.text, message: 'Email is required');
    String? passwordErr = requiredMessage(_passwordController.text, message: 'Password is required');
    if (passwordErr == null && _passwordController.text.length < 8) {
      passwordErr = 'Password must be at least 8 characters';
    }
    String? confirmErr = requiredMessage(
      _confirmPasswordController.text,
      message: 'Confirm password is required',
    );
    if (confirmErr == null && _confirmPasswordController.text != _passwordController.text) {
      confirmErr = "Passwords don't match";
    }
    setState(() {
      _nameError = nameErr;
      _emailError = emailErr;
      _passwordError = passwordErr;
      _confirmPasswordError = confirmErr;
    });
    if (nameErr != null || emailErr != null || passwordErr != null || confirmErr != null) return false;
    if (!_agreedToTerms) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please agree to the Terms & Conditions and Privacy Policy.'),
        ),
      );
      return false;
    }
    return true;
  }

  Future<void> _openPortalPage(String path) async {
    final uri = Uri.parse('${ApiClient().portalWebBaseUrl}$path');
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not open $uri')),
      );
    }
  }

  void _register() async {
    if (!_validate()) {
      if (_nameError != null ||
          _emailError != null ||
          _passwordError != null ||
          _confirmPasswordError != null) {
        showRequiredFieldsBlocked(context);
      }
      return;
    }

    final provider = Provider.of<AuthProvider>(context, listen: false);
    final success = await provider.registerCustomer(
      _emailController.text.trim(),
      _passwordController.text,
      _fullNameController.text.trim(),
      _phoneController.text.trim(),
    );

    if (!mounted) return;

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Registration successful. Please login.')),
      );
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (context) => const LoginScreen()),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(provider.errorMessage ?? 'Registration failed')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<AuthProvider>(context);

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 20),
              Center(
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF6C63FF).withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.person_add_alt_1, size: 64, color: Color(0xFF6C63FF)),
                ),
              ),
              const SizedBox(height: 32),
              const Text(
                'Create Account',
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Colors.white),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              const Text(
                'Join BlinksMed to start renting equipment',
                style: TextStyle(color: Colors.white60, fontSize: 16),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              const RequiredFieldsNote(),
              TextField(
                controller: _fullNameController,
                style: const TextStyle(color: Colors.white),
                onChanged: (_) {
                  if (_nameError != null) setState(() => _nameError = null);
                },
                decoration: requiredInputDecoration(
                  context,
                  label: 'Full Name',
                  required: true,
                  errorText: _nameError,
                  prefixIcon: Icons.person_outline,
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _emailController,
                style: const TextStyle(color: Colors.white),
                keyboardType: TextInputType.emailAddress,
                onChanged: (_) {
                  if (_emailError != null) setState(() => _emailError = null);
                },
                decoration: requiredInputDecoration(
                  context,
                  label: 'Email',
                  required: true,
                  errorText: _emailError,
                  prefixIcon: Icons.email_outlined,
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _phoneController,
                style: const TextStyle(color: Colors.white),
                keyboardType: TextInputType.phone,
                decoration: requiredInputDecoration(
                  context,
                  label: 'Phone Number (Optional)',
                  prefixIcon: Icons.phone_outlined,
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _passwordController,
                style: const TextStyle(color: Colors.white),
                obscureText: _obscurePassword,
                onChanged: (_) {
                  if (_passwordError != null) setState(() => _passwordError = null);
                },
                decoration: requiredInputDecoration(
                  context,
                  label: 'Password',
                  required: true,
                  errorText: _passwordError,
                  prefixIcon: Icons.lock_outline,
                  suffixIcon: IconButton(
                    icon: Icon(
                      _obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                      color: Colors.white54,
                    ),
                    onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _confirmPasswordController,
                style: const TextStyle(color: Colors.white),
                obscureText: _obscureConfirmPassword,
                onChanged: (_) {
                  if (_confirmPasswordError != null) {
                    setState(() => _confirmPasswordError = null);
                  }
                },
                decoration: requiredInputDecoration(
                  context,
                  label: 'Confirm Password',
                  required: true,
                  errorText: _confirmPasswordError,
                  prefixIcon: Icons.lock_clock_outlined,
                  suffixIcon: IconButton(
                    icon: Icon(
                      _obscureConfirmPassword
                          ? Icons.visibility_outlined
                          : Icons.visibility_off_outlined,
                      color: Colors.white54,
                    ),
                    onPressed: () =>
                        setState(() => _obscureConfirmPassword = !_obscureConfirmPassword),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Checkbox(
                    value: _agreedToTerms,
                    activeColor: const Color(0xFF6C63FF),
                    onChanged: (value) {
                      setState(() => _agreedToTerms = value == true);
                    },
                  ),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 10),
                      child: Text.rich(
                        TextSpan(
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.55),
                            fontSize: 12,
                            height: 1.45,
                          ),
                          children: [
                            const TextSpan(text: 'By creating an account, you agree to our '),
                            TextSpan(
                              text: 'Terms & Conditions',
                              style: const TextStyle(
                                color: Color(0xFF6C63FF),
                                fontWeight: FontWeight.w600,
                              ),
                              recognizer: TapGestureRecognizer()
                                ..onTap = () => _openPortalPage(AppUrls.termsPath),
                            ),
                            const TextSpan(text: ' and '),
                            TextSpan(
                              text: 'Privacy Policy',
                              style: const TextStyle(
                                color: Color(0xFF6C63FF),
                                fontWeight: FontWeight.w600,
                              ),
                              recognizer: TapGestureRecognizer()
                                ..onTap = () => _openPortalPage(AppUrls.privacyPath),
                            ),
                            const TextSpan(text: '.'),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: provider.isLoading || !_agreedToTerms ? null : _register,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF6C63FF),
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: provider.isLoading
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Text('Create Account', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
              ),
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text("Already have an account? ", style: TextStyle(color: Colors.white54)),
                  GestureDetector(
                    onTap: () {
                      Navigator.pushReplacement(context, MaterialPageRoute(builder: (context) => const LoginScreen()));
                    },
                    child: const Text('Log In', style: TextStyle(color: Color(0xFF6C63FF), fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
