import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api/api_client.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/config/app_urls.dart';
import '../../core/utils/indian_mobile_phone.dart';
import '../../shared/widgets/custom_text_field.dart';
import '../../shared/widgets/indian_mobile_field.dart';
import '../../shared/widgets/phone_otp_dialog.dart';
import '../../shared/widgets/required_field_ux.dart';
import 'login_screen.dart';
import 'verify_email_sent_screen.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();

  String? _nameError;
  String? _emailError;
  String? _phoneError;
  String? _passwordError;
  String? _confirmError;
  bool _agreedToTerms = false;

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  bool _isValidEmail(String value) {
    return RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(value.trim());
  }

  bool _validate() {
    final name = _nameController.text.trim();
    final email = _emailController.text.trim();
    final phone = _phoneController.text.trim();
    final password = _passwordController.text;
    final confirm = _confirmController.text;

    String? nameErr;
    String? emailErr;
    String? phoneErr;
    String? passwordErr;
    String? confirmErr;

    if (name.length < 2) {
      nameErr = 'Please enter your full name';
    }
    if (!_isValidEmail(email)) {
      emailErr = 'Enter a valid email';
    }
    phoneErr = IndianMobilePhone.requiredError(phone);
    if (password.length < 8) {
      passwordErr = 'Use at least 8 characters';
    }
    if (confirm != password) {
      confirmErr = "Passwords don't match";
    }

    setState(() {
      _nameError = nameErr;
      _emailError = emailErr;
      _phoneError = phoneErr;
      _passwordError = passwordErr;
      _confirmError = confirmErr;
    });

    if (nameErr != null ||
        emailErr != null ||
        phoneErr != null ||
        passwordErr != null ||
        confirmErr != null) {
      showRequiredFieldsBlocked(context);
      return false;
    }
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

  Future<void> _submit() async {
    if (!_validate()) return;

    final provider = Provider.of<AuthProvider>(context, listen: false);
    final email = _emailController.text.trim();
    final normalizedPhone = IndianMobilePhone.normalizeDigits(_phoneController.text);

    final success = await provider.registerVendor(
      email: email,
      password: _passwordController.text,
      supportPhone: normalizedPhone,
    );

    if (!mounted) return;

    if (success) {
      final otpOk = await PhoneOtpDialog.show(
        context,
        phone: normalizedPhone,
        role: 'vendor',
        required: true,
        title: 'Verify your phone',
        description: 'Enter the 6-digit code we sent to +91 $normalizedPhone. After this, we will ask you to verify your email.',
      );

      if (!mounted || otpOk != true) return;

      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => VerifyEmailSentScreen(initialEmail: email),
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(provider.errorMessage ?? 'Registration failed'),
          backgroundColor: Colors.redAccent,
        ),
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
              const SizedBox(height: 8),
              Center(
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF6C63FF).withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.storefront_outlined,
                    size: 64,
                    color: Color(0xFF6C63FF),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                'Create your vendor account',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Start onboarding in less than 5 minutes.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white60, fontSize: 15),
              ),
              const SizedBox(height: 24),
              const RequiredFieldsNote(),
              CustomTextField(
                label: 'Full name',
                icon: Icons.person_outline,
                required: true,
                errorText: _nameError,
                controller: _nameController,
                textInputAction: TextInputAction.next,
                onChanged: (_) {
                  if (_nameError != null) setState(() => _nameError = null);
                },
              ),
              const SizedBox(height: 16),
              CustomTextField(
                label: 'Work email',
                icon: Icons.email_outlined,
                required: true,
                errorText: _emailError,
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                onChanged: (_) {
                  if (_emailError != null) setState(() => _emailError = null);
                },
              ),
              const SizedBox(height: 16),
              IndianMobileField(
                controller: _phoneController,
                label: 'Phone number',
                required: true,
                errorText: _phoneError,
                textInputAction: TextInputAction.next,
                onChanged: (_) {
                  if (_phoneError != null) setState(() => _phoneError = null);
                },
              ),
              const SizedBox(height: 16),
              CustomTextField(
                label: 'Password',
                icon: Icons.lock_outline,
                isPassword: true,
                required: true,
                errorText: _passwordError,
                controller: _passwordController,
                textInputAction: TextInputAction.next,
                onChanged: (_) {
                  if (_passwordError != null) {
                    setState(() => _passwordError = null);
                  }
                },
              ),
              const SizedBox(height: 16),
              CustomTextField(
                label: 'Confirm password',
                icon: Icons.lock_outline,
                isPassword: true,
                required: true,
                errorText: _confirmError,
                controller: _confirmController,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) {
                  if (!provider.isLoading) _submit();
                },
                onChanged: (_) {
                  if (_confirmError != null) setState(() => _confirmError = null);
                },
              ),
              const SizedBox(height: 16),
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
              const SizedBox(height: 8),
              SizedBox(
                height: 56,
                child: ElevatedButton(
                  onPressed: provider.isLoading || !_agreedToTerms ? null : _submit,
                  child: provider.isLoading
                      ? const SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        )
                      : const Text(
                          'Create account',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                ),
              ),
              const SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text(
                    'Already have an account? ',
                    style: TextStyle(color: Colors.white54),
                  ),
                  GestureDetector(
                    onTap: () {
                      Navigator.pushReplacement(
                        context,
                        MaterialPageRoute(builder: (_) => const LoginScreen()),
                      );
                    },
                    child: const Text(
                      'Sign in',
                      style: TextStyle(
                        color: Color(0xFF6C63FF),
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
  }
}
