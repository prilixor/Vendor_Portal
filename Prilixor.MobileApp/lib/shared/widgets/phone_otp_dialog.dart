import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/theme.dart';


class PhoneOtpDialog extends StatefulWidget {
  final String phone;
  final String role; // 'customer' | 'vendor'
  final bool required;
  final String? title;
  final String? description;
  final String? successMessage;
  final VoidCallback? onVerified;

  const PhoneOtpDialog({
    super.key,
    required this.phone,
    required this.role,
    this.required = false,
    this.title,
    this.description,
    this.successMessage,
    this.onVerified,
  });

  static Future<bool?> show(
    BuildContext context, {
    required String phone,
    required String role,
    bool required = false,
    String? title,
    String? description,
    String? successMessage,
    VoidCallback? onVerified,
  }) {
    return showDialog<bool>(
      context: context,
      barrierDismissible: !required,
      builder: (ctx) => PopScope(canPop: !required,
        
        child: PhoneOtpDialog(
          phone: phone,
          role: role,
          required: required,
          title: title,
          description: description,
          successMessage: successMessage,
          onVerified: onVerified,
        ),
      ),
    );
  }

  @override
  State<PhoneOtpDialog> createState() => _PhoneOtpDialogState();
}

class _PhoneOtpDialogState extends State<PhoneOtpDialog> {
  final List<TextEditingController> _controllers = List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _focusNodes = List.generate(6, (_) => FocusNode());
  int _cooldown = 0;
  Timer? _cooldownTimer;
  bool _isSending = false;
  bool _isVerifying = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _sendCode();
  }

  @override
  void dispose() {
    _cooldownTimer?.cancel();
    for (var c in _controllers) {
      c.dispose();
    }
    for (var f in _focusNodes) {
      f.dispose();
    }
    super.dispose();
  }

  void _startCooldown() {
    setState(() => _cooldown = 45);
    _cooldownTimer?.cancel();
    _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_cooldown <= 1) {
        timer.cancel();
        setState(() => _cooldown = 0);
      } else {
        setState(() => _cooldown--);
      }
    });
  }

  Future<void> _sendCode() async {
    if (widget.phone.trim().isEmpty) return;
    setState(() {
      _isSending = true;
      _errorMessage = null;
    });

    final provider = context.read<AuthProvider>();
    final success = await provider.sendPhoneOtp(widget.phone, widget.role);

    if (!mounted) return;
    setState(() => _isSending = false);

    if (success) {
      _startCooldown();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Verification code sent to +91 ${widget.phone}')),
      );
    } else {
      setState(() => _errorMessage = provider.errorMessage ?? 'Failed to send verification code.');
    }
  }

  String get _code => _controllers.map((c) => c.text).join();

  Future<void> _verify() async {
    final code = _code;
    if (code.length < 6) {
      setState(() => _errorMessage = 'Please enter the full 6-digit code.');
      return;
    }

    setState(() {
      _isVerifying = true;
      _errorMessage = null;
    });

    final provider = context.read<AuthProvider>();
    final success = await provider.verifyPhoneOtp(widget.phone, code, widget.role);

    if (!mounted) return;
    setState(() => _isVerifying = false);

    if (success) {
      final msg = widget.successMessage ?? 'Phone number verified successfully.';
      if (msg.isNotEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
      }
      widget.onVerified?.call();
      Navigator.of(context).pop(true);
    } else {
      setState(() => _errorMessage = provider.errorMessage ?? 'Invalid verification code.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final titleText = widget.title ?? 'Verify phone number';
    final descText = widget.description ??
        'Enter the 6-digit code sent to +91 ${widget.phone}.${widget.required ? ' Verification is required to continue.' : ''}';

    return Dialog(
      backgroundColor: const Color(0xFF1E293B),
      insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 400),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 22.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(
                    child: Text(
                      titleText,
                      style: const TextStyle(
                        fontSize: 19,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                  ),
                  if (!widget.required)
                    IconButton(
                      icon: const Icon(Icons.close, color: Colors.white54),
                      onPressed: () => Navigator.of(context).pop(false),
                      splashRadius: 20,
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                descText,
                style: const TextStyle(
                  fontSize: 13.5,
                  color: Colors.white70,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: List.generate(6, (index) {
                  return Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 3.0),
                      child: SizedBox(
                        height: 50,
                        child: TextField(
                          controller: _controllers[index],
                          focusNode: _focusNodes[index],
                          keyboardType: TextInputType.number,
                          textAlign: TextAlign.center,
                          maxLength: 1,
                          cursorColor: const Color(0xFF6C63FF),
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                          decoration: InputDecoration(
                            counterText: '',
                            filled: true,
                            fillColor: const Color(0xFF0F172A),
                            contentPadding: EdgeInsets.zero,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),
                              borderSide: const BorderSide(color: Color(0xFF475569), width: 1.2),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),
                              borderSide: const BorderSide(color: Color(0xFF475569), width: 1.2),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),
                              borderSide: const BorderSide(color: Color(0xFF6C63FF), width: 2),
                            ),
                          ),
                          onChanged: (val) {
                            if (val.isNotEmpty && index < 5) {
                              _focusNodes[index + 1].requestFocus();
                            } else if (val.isEmpty && index > 0) {
                              _focusNodes[index - 1].requestFocus();
                            }
                            if (_code.length == 6) {
                              _verify();
                            }
                          },
                        ),
                      ),
                    ),
                  );
                }),
              ),
              if (_errorMessage != null) ...[
                const SizedBox(height: 12),
                Text(
                  _errorMessage!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Color(0xFFF87171), fontSize: 12.5),
                ),
              ],
              const SizedBox(height: 16),
              Center(
                child: TextButton(
                  onPressed: _isSending || _cooldown > 0 ? null : _sendCode,
                  child: _isSending
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF6C63FF)),
                        )
                      : Text(
                          _cooldown > 0
                              ? 'Resend in ${_cooldown}s'
                              : "Resend code",
                          style: TextStyle(
                            fontSize: 13,
                            color: _cooldown > 0 ? colors.textMuted : const Color(0xFF6C63FF),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                height: 48,
                child: ElevatedButton(
                  onPressed: _isVerifying || _code.length < 6 ? null : _verify,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF6C63FF),
                    disabledBackgroundColor: const Color(0xFF6C63FF).withValues(alpha: 0.4),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: _isVerifying
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : const Text(
                          'Verify',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
