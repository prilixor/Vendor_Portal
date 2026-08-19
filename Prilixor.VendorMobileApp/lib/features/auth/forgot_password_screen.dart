import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/theme.dart';
import '../../core/utils/indian_mobile_phone.dart';
import '../../shared/widgets/indian_mobile_field.dart';
import '../../shared/widgets/required_field_ux.dart';

class ForgotPasswordScreen extends StatefulWidget {
  final String role; // 'customer' | 'vendor'
  const ForgotPasswordScreen({super.key, this.role = 'customer'});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  int _tabIndex = 0; // 0 = Email, 1 = SMS OTP

  // Email form
  final _emailController = TextEditingController();
  String? _emailError;

  // SMS OTP form
  final _phoneController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  String? _phoneError;
  String? _newPasswordError;
  String? _confirmPasswordError;

  int _smsStep = 0; // 0 = enter phone, 1 = verified token ready, set password
  String? _resetToken;
  String? _normalizedPhone;

  @override
  void dispose() {
    _emailController.dispose();
    _phoneController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  void _switchTab(int newIndex) {
    if (_tabIndex == newIndex) return;
    setState(() {
      _tabIndex = newIndex;
      // Clear ALL state for a fresh form on tab switch (matches Web behavior)
      _emailError = null;
      _phoneError = null;
      _newPasswordError = null;
      _confirmPasswordError = null;
      _smsStep = 0;
      _resetToken = null;
      _normalizedPhone = null;
      // Clear field values so the user starts fresh
      _emailController.clear();
      _phoneController.clear();
      _newPasswordController.clear();
      _confirmPasswordController.clear();
    });
  }

  void _submitEmail() async {
    final emailErr = requiredMessage(_emailController.text, message: 'Email is required');
    setState(() => _emailError = emailErr);
    if (emailErr != null) {
      showRequiredFieldsBlocked(context);
      return;
    }

    final provider = Provider.of<AuthProvider>(context, listen: false);
    final success = await provider.forgotPassword(_emailController.text.trim());

    if (!mounted) return;

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'If an account exists, a reset link was sent. Open the link on this device to set a new password.',
          ),
        ),
      );
      Navigator.pop(context);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(provider.errorMessage ?? 'Failed to request reset')),
      );
    }
  }

  void _startSmsOtp() async {
    final phoneErr = IndianMobilePhone.requiredError(_phoneController.text);
    setState(() => _phoneError = phoneErr);
    if (phoneErr != null) {
      showRequiredFieldsBlocked(context);
      return;
    }

    final normalized = IndianMobilePhone.normalizeDigits(_phoneController.text);
    _normalizedPhone = normalized;

    final provider = Provider.of<AuthProvider>(context, listen: false);
    final sent = await provider.sendForgotPasswordSmsOtp(normalized, widget.role);

    if (!mounted) return;

    if (!sent) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(provider.errorMessage ?? 'Failed to send SMS code.')),
      );
      return;
    }

    // Prompt 6-digit OTP entry dialog
    final otpResult = await showDialog<String>(
      context: context,
      barrierDismissible: true,
      builder: (ctx) => _SmsOtpInputDialog(
        phone: normalized,
        role: widget.role,
      ),
    );

    if (!mounted || otpResult == null || otpResult.isEmpty) return;

    setState(() {
      _resetToken = otpResult;
      _smsStep = 1;
    });
  }

  void _onPasswordChanged(String value) {
    setState(() {
      final pwd = value;
      final confirm = _confirmPasswordController.text;
      if (pwd.isEmpty) {
        _newPasswordError = _newPasswordError != null ? 'Password must be at least 8 characters' : null;
      } else if (pwd.length < 8) {
        _newPasswordError = 'Password must be at least 8 characters';
      } else {
        _newPasswordError = null;
      }

      if (confirm.isNotEmpty || _confirmPasswordError != null) {
        if (confirm != pwd) {
          _confirmPasswordError = "Passwords don't match";
        } else {
          _confirmPasswordError = null;
        }
      }
    });
  }

  void _onConfirmPasswordChanged(String value) {
    setState(() {
      final confirm = value;
      final pwd = _newPasswordController.text;
      if (confirm.isEmpty) {
        _confirmPasswordError = _confirmPasswordError != null ? "Please confirm your password" : null;
      } else if (confirm != pwd) {
        _confirmPasswordError = "Passwords don't match";
      } else {
        _confirmPasswordError = null;
      }
    });
  }

  void _resetPasswordWithSms() async {
    final pwd = _newPasswordController.text;
    final confirm = _confirmPasswordController.text;

    String? pwdErr;
    String? confirmErr;

    if (pwd.length < 8) {
      pwdErr = 'Password must be at least 8 characters';
    }
    if (confirm.isEmpty) {
      confirmErr = 'Please confirm your password';
    } else if (confirm != pwd) {
      confirmErr = "Passwords don't match";
    }

    setState(() {
      _newPasswordError = pwdErr;
      _confirmPasswordError = confirmErr;
    });

    if (pwdErr != null || confirmErr != null) return;

    final provider = Provider.of<AuthProvider>(context, listen: false);
    final ok = await provider.resetPasswordWithSmsOtp(
      phone: _normalizedPhone!,
      resetToken: _resetToken!,
      newPassword: pwd,
      confirmPassword: confirm,
      role: widget.role,
    );

    if (!mounted) return;

    if (ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Password reset successfully. Please sign in with your new password.')),
      );
      Navigator.pop(context);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(provider.errorMessage ?? 'Failed to reset password.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<AuthProvider>(context);

    return Scaffold(
      backgroundColor: AppTheme.bg(context),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: IconThemeData(color: context.appColors.textPrimary),
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
                  child: const Icon(Icons.lock_reset, size: 56, color: Color(0xFF6C63FF)),
                ),
              ),
              const SizedBox(height: 24),
              Text(
                'Forgot Password?',
                style: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.bold,
                  color: context.appColors.textPrimary,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                _tabIndex == 0
                    ? 'Enter your email to receive a password reset link.'
                    : 'Enter your registered mobile number to reset via SMS OTP.',
                style: TextStyle(color: context.appColors.textSecondary, fontSize: 14),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              // Segmented Choice: Email vs SMS
              Container(
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(12),
                ),
                padding: const EdgeInsets.all(4),
                child: Row(
                  children: [
                    Expanded(
                      child: GestureDetector(
                        onTap: () => _switchTab(0),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          decoration: BoxDecoration(
                            color: _tabIndex == 0 ? const Color(0xFF6C63FF) : Colors.transparent,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            'Email Link',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: _tabIndex == 0 ? Colors.white : Colors.white60,
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                        ),
                      ),
                    ),
                    Expanded(
                      child: GestureDetector(
                        onTap: () => _switchTab(1),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          decoration: BoxDecoration(
                            color: _tabIndex == 1 ? const Color(0xFF6C63FF) : Colors.transparent,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            'SMS OTP',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: _tabIndex == 1 ? Colors.white : Colors.white60,
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              if (_tabIndex == 0) ...[
                const RequiredFieldsNote(),
                TextField(
                  controller: _emailController,
                  style: const TextStyle(color: Colors.white),
                  keyboardType: TextInputType.emailAddress,
                  onChanged: (_) {
                    if (_emailError != null) setState(() => _emailError = null);
                  },
                  decoration: requiredInputDecoration(
                    context,
                    label: 'Email Address',
                    required: true,
                    errorText: _emailError,
                    prefixIcon: Icons.email_outlined,
                  ),
                ),
                const SizedBox(height: 32),
                ElevatedButton(
                  onPressed: provider.isLoading ? null : _submitEmail,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF6C63FF),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: provider.isLoading
                      ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Text('Send Reset Link', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
                ),
              ] else ...[
                if (_smsStep == 0) ...[
                  const RequiredFieldsNote(),
                  IndianMobileField(
                    controller: _phoneController,
                    label: 'Registered Mobile Number',
                    required: true,
                    errorText: _phoneError,
                    onChanged: (_) {
                      if (_phoneError != null) setState(() => _phoneError = null);
                    },
                  ),
                  const SizedBox(height: 32),
                  ElevatedButton(
                    onPressed: provider.isLoading ? null : _startSmsOtp,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF6C63FF),
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: provider.isLoading
                        ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : const Text('Send Verification Code', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
                  ),
                ] else ...[
                  Text(
                    'Set new password for +91 $_normalizedPhone',
                    style: const TextStyle(color: Colors.white70, fontSize: 14, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _newPasswordController,
                    obscureText: true,
                    style: const TextStyle(color: Colors.white),
                    onChanged: _onPasswordChanged,
                    decoration: requiredInputDecoration(
                      context,
                      label: 'New Password',
                      required: true,
                      errorText: _newPasswordError,
                      prefixIcon: Icons.lock_outline,
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _confirmPasswordController,
                    obscureText: true,
                    style: const TextStyle(color: Colors.white),
                    onChanged: _onConfirmPasswordChanged,
                    decoration: requiredInputDecoration(
                      context,
                      label: 'Confirm New Password',
                      required: true,
                      errorText: _confirmPasswordError,
                      prefixIcon: Icons.lock_clock_outlined,
                    ),
                  ),
                  const SizedBox(height: 32),
                  ElevatedButton(
                    onPressed: provider.isLoading ? null : _resetPasswordWithSms,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF6C63FF),
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: provider.isLoading
                        ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : const Text('Reset Password', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
                  ),
                ],
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _SmsOtpInputDialog extends StatefulWidget {
  final String phone;
  final String role;

  const _SmsOtpInputDialog({required this.phone, required this.role});

  @override
  State<_SmsOtpInputDialog> createState() => _SmsOtpInputDialogState();
}

class _SmsOtpInputDialogState extends State<_SmsOtpInputDialog> {
  final List<TextEditingController> _controllers = List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _focusNodes = List.generate(6, (_) => FocusNode());
  bool _verifying = false;
  String? _error;

  @override
  void dispose() {
    for (var c in _controllers) {
      c.dispose();
    }
    for (var f in _focusNodes) {
      f.dispose();
    }
    super.dispose();
  }

  String get _code => _controllers.map((c) => c.text).join();

  Future<void> _verify() async {
    final code = _code;
    if (code.length < 6) {
      setState(() => _error = 'Enter full 6-digit code');
      return;
    }
    setState(() {
      _verifying = true;
      _error = null;
    });

    final provider = context.read<AuthProvider>();
    final resetToken = await provider.verifyForgotPasswordSmsOtp(widget.phone, code, widget.role);

    if (!mounted) return;
    setState(() => _verifying = false);

    if (resetToken != null && resetToken.isNotEmpty) {
      Navigator.of(context).pop(resetToken);
    } else {
      setState(() => _error = provider.errorMessage ?? 'Invalid verification code');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: const Color(0xFF1E293B),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Enter SMS Verification Code',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            const SizedBox(height: 8),
            Text(
              'Enter the 6-digit code sent to +91 ${widget.phone}.',
              style: const TextStyle(fontSize: 13, color: Colors.white60),
            ),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: List.generate(6, (index) {
                return SizedBox(
                  width: 38,
                  height: 46,
                  child: TextField(
                    controller: _controllers[index],
                    focusNode: _focusNodes[index],
                    keyboardType: TextInputType.number,
                    textAlign: TextAlign.center,
                    maxLength: 1,
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                    decoration: InputDecoration(
                      counterText: '',
                      filled: true,
                      fillColor: const Color(0xFF0F172A),
                      contentPadding: EdgeInsets.zero,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    onChanged: (val) {
                      if (val.isNotEmpty && index < 5) {
                        _focusNodes[index + 1].requestFocus();
                      } else if (val.isEmpty && index > 0) {
                        _focusNodes[index - 1].requestFocus();
                      }
                      if (_code.length == 6) _verify();
                    },
                  ),
                );
              }),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(
                _error!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Color(0xFFF87171), fontSize: 12),
              ),
            ],
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _verifying || _code.length < 6 ? null : _verify,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF6C63FF),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: _verifying
                  ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Text('Verify & Continue', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }
}
