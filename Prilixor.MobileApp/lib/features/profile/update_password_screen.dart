import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/providers/profile_provider.dart';
import '../../shared/widgets/required_field_ux.dart';

class UpdatePasswordScreen extends StatefulWidget {
  const UpdatePasswordScreen({super.key});

  @override
  State<UpdatePasswordScreen> createState() => _UpdatePasswordScreenState();
}

class _UpdatePasswordScreenState extends State<UpdatePasswordScreen> {
  final _currentPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _obscureCurrent = true;
  bool _obscureNew = true;
  bool _obscureConfirm = true;
  String? _currentError;
  String? _newError;
  String? _confirmError;

  @override
  void dispose() {
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  bool _validate() {
    final currentErr = requiredMessage(_currentPasswordController.text, message: 'Current password is required');
    String? newErr = requiredMessage(_newPasswordController.text, message: 'New password is required');
    if (newErr == null && _newPasswordController.text.length < 6) {
      newErr = 'Password must be at least 6 characters';
    }
    String? confirmErr = requiredMessage(_confirmPasswordController.text, message: 'Confirm password is required');
    if (confirmErr == null && _confirmPasswordController.text != _newPasswordController.text) {
      confirmErr = 'Passwords do not match';
    }
    setState(() {
      _currentError = currentErr;
      _newError = newErr;
      _confirmError = confirmErr;
    });
    return currentErr == null && newErr == null && confirmErr == null;
  }

  void _submit() async {
    if (!_validate()) {
      showRequiredFieldsBlocked(context);
      return;
    }

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final profileProvider = Provider.of<ProfileProvider>(context, listen: false);

    final email = profileProvider.profile?.email ?? '';
    if (email.isEmpty) return;

    final success = await authProvider.changePassword(
      email,
      _currentPasswordController.text,
      _newPasswordController.text,
    );

    if (!mounted) return;

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Password updated successfully!')),
      );
      Navigator.pop(context);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(authProvider.errorMessage ?? 'Failed to update password')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = Provider.of<AuthProvider>(context).isLoading;

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        title: const Text('Update Password', style: TextStyle(color: Colors.white)),
        backgroundColor: const Color(0xFF0F172A),
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const RequiredFieldsNote(),
              TextField(
                controller: _currentPasswordController,
                style: const TextStyle(color: Colors.white),
                obscureText: _obscureCurrent,
                onChanged: (_) {
                  if (_currentError != null) setState(() => _currentError = null);
                },
                decoration: requiredInputDecoration(
                  context,
                  label: 'Current Password',
                  required: true,
                  errorText: _currentError,
                  prefixIcon: Icons.lock_outline,
                ).copyWith(
                  suffixIcon: IconButton(
                    tooltip: _obscureCurrent ? 'Show password' : 'Hide password',
                    onPressed: () => setState(() => _obscureCurrent = !_obscureCurrent),
                    icon: Icon(
                      _obscureCurrent ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                      color: Colors.white54,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _newPasswordController,
                style: const TextStyle(color: Colors.white),
                obscureText: _obscureNew,
                onChanged: (_) {
                  if (_newError != null) setState(() => _newError = null);
                },
                decoration: requiredInputDecoration(
                  context,
                  label: 'New Password',
                  required: true,
                  errorText: _newError,
                  prefixIcon: Icons.lock,
                ).copyWith(
                  suffixIcon: IconButton(
                    tooltip: _obscureNew ? 'Show password' : 'Hide password',
                    onPressed: () => setState(() => _obscureNew = !_obscureNew),
                    icon: Icon(
                      _obscureNew ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                      color: Colors.white54,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _confirmPasswordController,
                style: const TextStyle(color: Colors.white),
                obscureText: _obscureConfirm,
                onChanged: (_) {
                  if (_confirmError != null) setState(() => _confirmError = null);
                },
                decoration: requiredInputDecoration(
                  context,
                  label: 'Confirm New Password',
                  required: true,
                  errorText: _confirmError,
                  prefixIcon: Icons.lock_clock,
                ).copyWith(
                  suffixIcon: IconButton(
                    tooltip: _obscureConfirm ? 'Show password' : 'Hide password',
                    onPressed: () => setState(() => _obscureConfirm = !_obscureConfirm),
                    icon: Icon(
                      _obscureConfirm ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                      color: Colors.white54,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 32),
              SizedBox(
                height: 56,
                child: ElevatedButton(
                  onPressed: isLoading ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF6C63FF),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  child: isLoading
                      ? const CircularProgressIndicator(color: Colors.white)
                      : const Text('Update Password', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
