import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/providers/profile_provider.dart';
import '../../core/utils/indian_mobile_phone.dart';
import '../../shared/widgets/custom_text_field.dart';
import '../../shared/widgets/phone_otp_dialog.dart';
import '../../shared/widgets/required_field_ux.dart';
import '../dashboard/customer_dashboard.dart';
import 'forgot_password_screen.dart';
import 'register_screen.dart';

class LoginScreen extends StatefulWidget {
  /// When true, successful login pops with `true` so the caller can continue
  /// (e.g. guest → checkout). Default replaces the stack with the dashboard.
  final bool popOnSuccess;

  const LoginScreen({super.key, this.popOnSuccess = false});

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
  bool _needsEmailVerification = false;
  bool _isResendingEmail = false;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _emailFocusNode.dispose();
    _passwordFocusNode.dispose();
    super.dispose();
  }

  bool _validate() {
    final emailErr = requiredMessage(_emailController.text, message: 'Email or phone number is required');
    final passwordErr = requiredMessage(_passwordController.text, message: 'Password is required');
    setState(() {
      _emailError = emailErr;
      _passwordError = passwordErr;
    });
    return emailErr == null && passwordErr == null;
  }

  Future<void> _resendVerificationEmail() async {
    final candidate = _emailController.text.trim();
    if (candidate.isEmpty || !candidate.contains('@')) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Enter your email address to resend the verification link.'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    setState(() => _isResendingEmail = true);
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final ok = await authProvider.resendVerification(candidate);
    if (!mounted) return;
    setState(() => _isResendingEmail = false);

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          ok
              ? 'Verification link has been resent.'
              : (authProvider.errorMessage ?? 'Failed to resend verification link.'),
        ),
        backgroundColor: ok ? Colors.green : Colors.redAccent,
      ),
    );
  }

  void _handleLogin() async {
    if (!_validate()) {
      showRequiredFieldsBlocked(context);
      if (_emailError != null) {
        _emailFocusNode.requestFocus();
      } else {
        _passwordFocusNode.requestFocus();
      }
      return;
    }

    setState(() {
      _isProcessing = true;
      _needsEmailVerification = false;
    });
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final success = await authProvider.login(
      _emailController.text.trim(),
      _passwordController.text.trim(),
    );

    if (!mounted) return;

    if (success) {
      final profileProvider = Provider.of<ProfileProvider>(context, listen: false);
      await profileProvider.fetchProfile();
      if (!mounted) return;

      final profile = profileProvider.profile;
      final rawPhone = profile?.phoneNumber.trim() ?? '';
      if (rawPhone.isNotEmpty && !(profile?.isPhoneVerified ?? false)) {
        setState(() => _isProcessing = false);
        final normalizedPhone = IndianMobilePhone.normalizeDigits(rawPhone);
        final verified = await PhoneOtpDialog.show(
          context,
          phone: normalizedPhone,
          role: 'customer',
          required: true,
          title: 'Verify phone number',
          description:
              'Enter the 6-digit code sent to +91 $normalizedPhone. Verification is required to continue.',
        );
        if (verified != true) {
          return;
        }
        if (!mounted) return;
        setState(() => _isProcessing = true);
        await profileProvider.fetchProfile();
      }

      if (!mounted) return;
      setState(() => _isProcessing = false);

      if (widget.popOnSuccess) {
        Navigator.of(context).pop(true);
      } else {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const CustomerDashboard()),
        );
      }
    } else {
      setState(() => _isProcessing = false);
      if (authProvider.isEmailNotVerified) {
        setState(() => _needsEmailVerification = true);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Please verify your email before logging in.'),
            backgroundColor: Colors.redAccent,
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(authProvider.errorMessage ?? 'Login failed'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final isLoading = authProvider.isLoading || _isProcessing;

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
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Icon(
                  Icons.lock_person_rounded,
                  size: 80,
                  color: Color(0xFF6C63FF),
                ),
                const SizedBox(height: 32),
                const Text(
                  'Welcome Back',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Sign in to access your customer portal.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 16,
                    color: Colors.grey,
                  ),
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
                    if (_passwordError != null) setState(() => _passwordError = null);
                  },
                  onSubmitted: (_) {
                    if (!isLoading) _handleLogin();
                  },
                ),
                if (_needsEmailVerification) ...[
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFFBEB),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFFDE68A)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text(
                          'Your email is not verified yet. Resend the link, then try signing in again.',
                          style: TextStyle(
                            color: Color(0xFF78350F),
                            fontSize: 13,
                            height: 1.4,
                          ),
                        ),
                        const SizedBox(height: 10),
                        OutlinedButton(
                          onPressed: _isResendingEmail ? null : _resendVerificationEmail,
                          style: OutlinedButton.styleFrom(
                            foregroundColor: const Color(0xFF78350F),
                            side: const BorderSide(color: Color(0xFFD97706)),
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                          ),
                          child: _isResendingEmail
                              ? const SizedBox(
                                  height: 16,
                                  width: 16,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Color(0xFF78350F),
                                  ),
                                )
                              : const Text(
                                  'Resend verification email',
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                Align(
                  alignment: Alignment.centerRight,
                  child: GestureDetector(
                    onTap: () {
                      Navigator.push(context, MaterialPageRoute(builder: (_) => const ForgotPasswordScreen()));
                    },
                    child: const Text('Forgot Password?', style: TextStyle(color: Color(0xFF6C63FF), fontWeight: FontWeight.bold)),
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
                            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                          ),
                  ),
                ),
                const SizedBox(height: 32),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text('New customer? ', style: TextStyle(color: Colors.white70, fontSize: 14)),
                    GestureDetector(
                      onTap: () {
                        Navigator.push(context, MaterialPageRoute(builder: (_) => const RegisterScreen()));
                      },
                      child: const Text(
                        'Create an account',
                        style: TextStyle(color: Color(0xFF6C63FF), fontSize: 14, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
