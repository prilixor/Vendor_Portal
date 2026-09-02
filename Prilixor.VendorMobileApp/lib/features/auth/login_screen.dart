import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/theme.dart';
import '../../core/utils/indian_mobile_phone.dart';
import '../../shared/widgets/custom_text_field.dart';
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
  final TextEditingController _identifierController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final FocusNode _identifierFocusNode = FocusNode();
  final FocusNode _passwordFocusNode = FocusNode();
  String? _identifierError;
  String? _passwordError;

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    _identifierFocusNode.dispose();
    _passwordFocusNode.dispose();
    super.dispose();
  }

  bool _validate() {
    final identifierErr =
        IndianMobilePhone.loginIdentifierError(_identifierController.text);
    final password = _passwordController.text.trim();
    String? passwordErr;
    if (password.isEmpty) {
      passwordErr = 'Password is required.';
    } else if (password.length < 8) {
      passwordErr = 'Password must be at least 8 characters.';
    }

    setState(() {
      _identifierError = identifierErr;
      _passwordError = passwordErr;
    });
    return identifierErr == null && passwordErr == null;
  }

  Future<void> _handleLogin() async {
    if (!_validate()) {
      showRequiredFieldsBlocked(context);
      if (_identifierError != null) {
        _identifierFocusNode.requestFocus();
      } else {
        _passwordFocusNode.requestFocus();
      }
      return;
    }

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final identifier = IndianMobilePhone.normalizeLoginIdentifier(
      _identifierController.text,
    );
    final success = await authProvider.login(
      identifier,
      _passwordController.text.trim(),
    );

    if (!mounted) return;

    if (success) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const VendorDashboard()),
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

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);

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
                'Vendor sign in',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: context.appColors.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Access your workspace and manage your listings.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 16,
                  color: context.appColors.textSecondary,
                  height: 1.35,
                ),
              ),
              const SizedBox(height: 32),
              const RequiredFieldsNote(),
              CustomTextField(
                label: 'Email or phone number',
                hintText: 'Enter email or 10-digit mobile number',
                icon: Icons.alternate_email_rounded,
                required: true,
                errorText: _identifierError,
                controller: _identifierController,
                focusNode: _identifierFocusNode,
                keyboardType: TextInputType.text,
                textInputAction: TextInputAction.next,
                onChanged: (_) {
                  if (_identifierError != null) {
                    setState(() => _identifierError = null);
                  }
                },
                onSubmitted: (_) {
                  final err = IndianMobilePhone.loginIdentifierError(
                    _identifierController.text,
                  );
                  if (err != null) {
                    setState(() => _identifierError = err);
                    _identifierFocusNode.requestFocus();
                    showRequiredFieldsBlocked(context);
                  } else {
                    _passwordFocusNode.requestFocus();
                  }
                },
              ),
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  'Example email: vendor@example.com · Mobile: 10 digits starting with 6–9',
                  style: TextStyle(
                    color: context.appColors.textMuted,
                    fontSize: 12,
                    height: 1.35,
                  ),
                ),
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
                  if (!authProvider.isLoading) _handleLogin();
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
                        builder: (_) => const ForgotPasswordScreen(),
                      ),
                    );
                  },
                  child: const Text(
                    'Forgot?',
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
                  onPressed: authProvider.isLoading ? null : _handleLogin,
                  child: authProvider.isLoading
                      ? const SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        )
                      : const Text(
                          'Sign in',
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
                    'New to the platform? ',
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
