import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/providers/vendor_profile_provider.dart';
import '../../core/theme.dart';
import '../../core/utils/indian_mobile_phone.dart';
import '../../shared/widgets/custom_text_field.dart';
import '../../shared/widgets/phone_otp_dialog.dart';
import '../../shared/widgets/required_field_ux.dart';
import '../dashboard/vendor_dashboard.dart';
import 'forgot_password_screen.dart';
import 'register_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final FocusNode _emailFocusNode = FocusNode();
  final FocusNode _passwordFocusNode = FocusNode();
  String? _emailError;
  String? _passwordError;
  bool _isProcessing = false;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _emailFocusNode.dispose();
    _passwordFocusNode.dispose();
    super.dispose();
  }

  bool _validate() {
    final emailErr =
        requiredMessage(_emailController.text, message: 'Email or phone number is required');
    final passwordErr = requiredMessage(
      _passwordController.text,
      message: 'Password is required',
    );
    setState(() {
      _emailError = emailErr;
      _passwordError = passwordErr;
    });
    return emailErr == null && passwordErr == null;
  }

  Future<void> _handleLogin() async {
    if (!_validate()) {
      showRequiredFieldsBlocked(context);
      if (_emailError != null) {
        _emailFocusNode.requestFocus();
      } else {
        _passwordFocusNode.requestFocus();
      }
      return;
    }

    setState(() => _isProcessing = true);
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final success = await authProvider.login(
      _emailController.text.trim(),
      _passwordController.text.trim(),
    );

    if (!mounted) return;

    if (success) {
      final vendorId = authProvider.vendorId;
      if (vendorId != null && vendorId.isNotEmpty) {
        final profileProvider = Provider.of<VendorProfileProvider>(context, listen: false);
        await profileProvider.fetchProfile(vendorId);
        if (!mounted) return;
        final profile = profileProvider.profile;
        final rawPhone = profile?.supportPhone.trim() ?? '';
        if (rawPhone.isNotEmpty && !(profile?.isPhoneVerified ?? false)) {
          setState(() => _isProcessing = false);
          final normalizedPhone = IndianMobilePhone.normalizeDigits(rawPhone);
          final verified = await PhoneOtpDialog.show(
            context,
            phone: normalizedPhone,
            role: 'vendor',
            required: true,
            title: 'Verify phone number',
            description:
                'Enter the 6-digit code sent to +91 $normalizedPhone. Verification is required to continue.',
          );
          if (verified != true) return;
          if (!mounted) return;
          setState(() => _isProcessing = true);
          await profileProvider.fetchProfile(vendorId);
        }
      }

      if (!mounted) return;
      setState(() => _isProcessing = false);
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const VendorDashboard()),
      );
    } else {
      setState(() => _isProcessing = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(authProvider.errorMessage ?? 'Login failed'),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final isLoading = authProvider.isLoading || _isProcessing;

    return Scaffold(
      backgroundColor: AppTheme.bg(context),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(
                Icons.storefront_rounded,
                size: 80,
                color: Color(0xFF6C63FF),
              ),
              const SizedBox(height: 32),
              Text(
                'Vendor Sign In',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: context.appColors.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Sign in to manage orders, inventory, and your store.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 16, color: context.appColors.textSecondary),
              ),
              const SizedBox(height: 32),
              const RequiredFieldsNote(),
              CustomTextField(
                label: 'Email or Phone Number',
                icon: Icons.person_outline,
                required: true,
                errorText: _emailError,
                controller: _emailController,
                focusNode: _emailFocusNode,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                onChanged: (_) {
                  if (_emailError != null) setState(() => _emailError = null);
                },
                onSubmitted: (_) {
                  if (_emailController.text.trim().isEmpty) {
                    setState(() => _emailError = 'Email or phone number is required');
                    _emailFocusNode.requestFocus();
                    showRequiredFieldsBlocked(context);
                  } else {
                    _passwordFocusNode.requestFocus();
                  }
                },
              ),
              const SizedBox(height: 16),
              CustomTextField(
                label: 'Password',
                icon: Icons.lock_rounded,
                isPassword: true,
                required: true,
                errorText: _passwordError,
                controller: _passwordController,
                focusNode: _passwordFocusNode,
                textInputAction: TextInputAction.done,
                onChanged: (_) {
                  if (_passwordError != null) {
                    setState(() => _passwordError = null);
                  }
                },
                onSubmitted: (_) {
                  if (!isLoading) _handleLogin();
                },
              ),
              const SizedBox(height: 16),
              Align(
                alignment: Alignment.centerRight,
                child: GestureDetector(
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const ForgotPasswordScreen(role: 'vendor'),
                      ),
                    );
                  },
                  child: const Text(
                    'Forgot Password?',
                    style: TextStyle(
                      color: Color(0xFF6C63FF),
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              SizedBox(
                height: 56,
                child: ElevatedButton(
                  onPressed: isLoading ? null : _handleLogin,
                  child: isLoading
                      ? const SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        )
                      : const Text(
                          'Sign In',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                ),
              ),
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    'New vendor? ',
                    style: TextStyle(color: context.appColors.textMuted),
                  ),
                    GestureDetector(
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => const RegisterScreen(),
                          ),
                        );
                      },
                      child: const Text(
                        'Create an account',
                        style: TextStyle(
                          color: Color(0xFF6C63FF),
                          fontWeight: FontWeight.bold,
                        ),
                      ),
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
