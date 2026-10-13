import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/auth/phone_otp_setting.dart';
import '../../core/theme.dart';
import '../../core/utils/indian_mobile_phone.dart';
import '../../shared/widgets/indian_mobile_field.dart';
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
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final FocusNode _phoneFocusNode = FocusNode();
  String? _phoneError;
  String? _passwordError;
  bool _showPassword = false;
  bool _isProcessing = false;
  bool? _phoneOtpEnabled;
  int _cooldown = 0;
  Timer? _cooldownTimer;

  @override
  void initState() {
    super.initState();
    PhoneOtpSetting.isEnabled().then((enabled) {
      if (mounted) setState(() => _phoneOtpEnabled = enabled);
    });
  }

  @override
  void dispose() {
    _cooldownTimer?.cancel();
    _phoneController.dispose();
    _passwordController.dispose();
    _phoneFocusNode.dispose();
    super.dispose();
  }

  void _startCooldown([int seconds = 45]) {
    setState(() => _cooldown = seconds);
    _cooldownTimer?.cancel();
    _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_cooldown <= 1) {
        timer.cancel();
        if (mounted) setState(() => _cooldown = 0);
      } else {
        if (mounted) setState(() => _cooldown--);
      }
    });
  }

  bool _validate() {
    final phoneErr = IndianMobilePhone.requiredError(_phoneController.text);
    setState(() => _phoneError = phoneErr);
    return phoneErr == null;
  }

  Future<void> _handleSendOtp() async {
    if (!_validate()) {
      showRequiredFieldsBlocked(context);
      _phoneFocusNode.requestFocus();
      return;
    }
    if (_cooldown > 0) return;

    final national = IndianMobilePhone.normalizeDigits(_phoneController.text);
    setState(() {
      _isProcessing = true;
      _phoneError = null;
    });

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final success = await authProvider.sendCustomerLoginOtp(national);
    if (!mounted) return;
    setState(() => _isProcessing = false);

    if (!success) {
      final err = authProvider.errorMessage ?? 'No customer account found for this mobile number.';
      setState(() => _phoneError = err);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(err), backgroundColor: Colors.redAccent),
      );
      return;
    }

    _startCooldown(45);

    final verified = await PhoneOtpDialog.show(
      context,
      phone: national,
      role: 'customer',
      skipAutoSend: true,
      title: 'Enter verification code',
      description: 'Enter the 6-digit code sent to +91 $national.',
      successMessage: 'Welcome!',
      onSendOtp: (p) => authProvider.sendCustomerLoginOtp(p),
      onVerifyOtp: (p, code) => authProvider.loginWithCustomerPhoneOtp(p, code),
    );

    if (verified == true && mounted) {
      if (widget.popOnSuccess) {
        Navigator.of(context).pop(true);
      } else {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(
            builder: (_) => CustomerDashboard(key: CustomerDashboard.navigationKey),
          ),
        );
      }
    }
  }

  Future<void> _handlePasswordLogin() async {
    final identifier = _phoneController.text.trim();
    final isEmail = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(identifier);
    final phoneErr = IndianMobilePhone.requiredError(identifier);
    String? idError;
    if (!isEmail && phoneErr != null) {
      idError = 'Enter a valid email address or 10-digit Indian mobile number';
    }
    final password = _passwordController.text;
    final passwordError = password.length < 8 ? 'Password must be at least 8 characters' : null;
    setState(() {
      _phoneError = idError;
      _passwordError = passwordError;
    });
    if (idError != null || passwordError != null) {
      showRequiredFieldsBlocked(context);
      return;
    }

    setState(() => _isProcessing = true);
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final success = await authProvider.login(identifier, password);
    if (!mounted) return;
    setState(() => _isProcessing = false);
    if (!success) {
      final err = authProvider.errorMessage ?? 'Invalid email/phone or password.';
      setState(() => _phoneError = err);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(err), backgroundColor: Colors.redAccent),
      );
      return;
    }
    if (widget.popOnSuccess) {
      Navigator.of(context).pop(true);
    } else {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => CustomerDashboard(key: CustomerDashboard.navigationKey),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final isLoading = authProvider.isLoading || _isProcessing;
    final colors = context.appColors;

    return Scaffold(
      backgroundColor: colors.background,
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [colors.background, colors.surface],
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
                Text(
                  'Customer sign in',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                    color: colors.textPrimary,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  _phoneOtpEnabled == false
                      ? 'Sign in with your email or mobile number and password.'
                      : 'Enter your mobile number to receive a one-time code.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 16,
                    color: colors.textSecondary,
                  ),
                ),
                const SizedBox(height: 32),
                if (_phoneOtpEnabled == null)
                  const Center(child: CircularProgressIndicator(color: Color(0xFF6C63FF)))
                else if (_phoneOtpEnabled == false) ...[
                  TextField(
                    controller: _phoneController,
                    focusNode: _phoneFocusNode,
                    keyboardType: TextInputType.emailAddress,
                    style: TextStyle(color: colors.textPrimary),
                    decoration: InputDecoration(
                      labelText: 'Email or mobile number *',
                      errorText: _phoneError,
                      helperText: 'Use the email or mobile number on your account.',
                    ),
                    onChanged: (_) {
                      if (_phoneError != null) setState(() => _phoneError = null);
                    },
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _passwordController,
                    obscureText: !_showPassword,
                    style: TextStyle(color: colors.textPrimary),
                    decoration: InputDecoration(
                      labelText: 'Password *',
                      errorText: _passwordError,
                      suffixIcon: IconButton(
                        onPressed: () => setState(() => _showPassword = !_showPassword),
                        icon: Icon(_showPassword ? Icons.visibility_off : Icons.visibility),
                      ),
                    ),
                    onChanged: (_) {
                      if (_passwordError != null) setState(() => _passwordError = null);
                    },
                  ),
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      onPressed: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const ForgotPasswordScreen()),
                        );
                      },
                      child: const Text('Forgot password?'),
                    ),
                  ),
                  const SizedBox(height: 8),
                  SizedBox(
                    height: 56,
                    child: ElevatedButton(
                      onPressed: isLoading ? null : _handlePasswordLogin,
                      child: isLoading
                          ? const SizedBox(
                              width: 24,
                              height: 24,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                            )
                          : const Text('Sign in', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                    ),
                  ),
                ] else ...[
                const RequiredFieldsNote(),
                IndianMobileField(
                  controller: _phoneController,
                  focusNode: _phoneFocusNode,
                  label: 'Mobile number',
                  required: true,
                  errorText: _phoneError,
                  helperText: 'We’ll send a 6-digit OTP to this registered mobile number.',
                  onChanged: (_) {
                    if (_phoneError != null) setState(() => _phoneError = null);
                  },
                ),
                const SizedBox(height: 24),
                SizedBox(
                  height: 56,
                  child: ElevatedButton(
                    onPressed: (isLoading || _cooldown > 0) ? null : _handleSendOtp,
                    child: isLoading
                        ? const SizedBox(
                            width: 24,
                            height: 24,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2,
                            ),
                          )
                        : Text(
                            _cooldown > 0 ? 'Send OTP in ${_cooldown}s' : 'Send OTP',
                            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                          ),
                  ),
                ),
                ],
                const SizedBox(height: 32),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text('New customer? ', style: TextStyle(color: colors.textSecondary, fontSize: 14)),
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
