import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_provider.dart';
import '../../shared/widgets/custom_text_field.dart';
import '../dashboard/customer_dashboard.dart';
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

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _emailFocusNode.dispose();
    _passwordFocusNode.dispose();
    super.dispose();
  }

  void _handleLogin() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text.trim();

    if (email.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enter your email address'), backgroundColor: Colors.redAccent));
      _emailFocusNode.requestFocus();
      return;
    }

    if (password.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enter your password'), backgroundColor: Colors.redAccent));
      _passwordFocusNode.requestFocus();
      return;
    }

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    
    // Attempt Login
    final success = await authProvider.login(email, password);

    if (!mounted) return;

    if (success) {
      if (context.mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const CustomerDashboard()),
        );
      }
    } else {
      // Show Error
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
                const SizedBox(height: 48),
                CustomTextField(
                  label: 'Email Address',
                  icon: Icons.email_rounded,
                  controller: _emailController,
                  focusNode: _emailFocusNode,
                  textInputAction: TextInputAction.next,
                  onSubmitted: (_) {
                    if (_emailController.text.trim().isEmpty) {
                      _emailFocusNode.requestFocus();
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enter your email address'), backgroundColor: Colors.redAccent));
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
                  controller: _passwordController,
                  focusNode: _passwordFocusNode,
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) {
                    if (_passwordController.text.trim().isEmpty) {
                      _passwordFocusNode.requestFocus();
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enter your password'), backgroundColor: Colors.redAccent));
                    } else if (!authProvider.isLoading) {
                      _handleLogin();
                    }
                  },
                ),
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
                            'Sign In',
                            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                          ),
                  ),
                ),
                const SizedBox(height: 32),
                
                // New customer? Create an account
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
