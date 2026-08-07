import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'package:flutter/services.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/providers/vendor_profile_provider.dart';
import '../../core/theme.dart';
import '../../core/utils/indian_mobile_phone.dart';
import '../../shared/widgets/custom_text_field.dart';
import '../../shared/widgets/required_field_ux.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  String? _nameError;
  String? _phoneError;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final vendorId =
          Provider.of<AuthProvider>(context, listen: false).vendorId;
      if (vendorId == null) return;
      final provider =
          Provider.of<VendorProfileProvider>(context, listen: false);
      await provider.fetchProfile(vendorId);
      if (!mounted) return;
      final profile = provider.profile;
      final auth = Provider.of<AuthProvider>(context, listen: false);
      _nameController.text =
          profile?.ownerName.isNotEmpty == true
              ? profile!.ownerName
              : (auth.displayName ?? '');
      _phoneController.text = profile?.supportPhone ?? '';
      setState(() {});
    });
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final nameErr = requiredMessage(
      _nameController.text,
      message: 'Full name is required',
    );
    String? nameTooShort;
    if (nameErr == null && _nameController.text.trim().length < 2) {
      nameTooShort = 'Please enter your full name (at least 2 characters).';
    }
    final phoneErr = IndianMobilePhone.requiredError(_phoneController.text);
    setState(() {
      _nameError = nameErr ?? nameTooShort;
      _phoneError = phoneErr;
    });
    if (_nameError != null || _phoneError != null) {
      showRequiredFieldsBlocked(context);
      return;
    }

    final vendorId =
        Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    final provider =
        Provider.of<VendorProfileProvider>(context, listen: false);
    final ok = await provider.saveProfile(
      vendorId: vendorId,
      ownerName: _nameController.text,
      supportPhone: IndianMobilePhone.normalizeDigits(_phoneController.text),
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          ok ? 'Profile saved.' : (provider.error ?? 'Failed to save'),
        ),
        backgroundColor: ok ? null : Colors.redAccent,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<VendorProfileProvider>(context);
    final auth = Provider.of<AuthProvider>(context);
    final colors = context.appColors;

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: provider.loading && provider.profile == null
          ? Center(
              child: CircularProgressIndicator(color: colors.accent),
            )
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Text(
                  'Account',
                  style: TextStyle(
                    color: colors.textSecondary,
                    fontWeight: FontWeight.w700,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  auth.email ?? '',
                  style: TextStyle(color: colors.textMuted, fontSize: 13),
                ),
                const SizedBox(height: 20),
                if (provider.profile == null) ...[
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Colors.amber.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: Colors.amber.withValues(alpha: 0.35),
                      ),
                    ),
                    child: Text(
                      provider.error ??
                          'Complete onboarding profile on the web first to update settings here.',
                      style: const TextStyle(color: Colors.amber, height: 1.4),
                    ),
                  ),
                ] else ...[
                  const RequiredFieldsNote(),
                  CustomTextField(
                    label: 'Full name',
                    icon: Icons.person_outline,
                    required: true,
                    errorText: _nameError,
                    controller: _nameController,
                    onChanged: (_) {
                      if (_nameError != null) {
                        setState(() => _nameError = null);
                      }
                    },
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _phoneController,
                    keyboardType: TextInputType.phone,
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                      LengthLimitingTextInputFormatter(10),
                    ],
                    style: TextStyle(color: colors.textPrimary),
                    onChanged: (_) {
                      if (_phoneError != null) {
                        setState(() => _phoneError = null);
                      }
                    },
                    decoration: requiredInputDecoration(
                      context,
                      label: 'Support phone',
                      required: true,
                      errorText: _phoneError,
                      prefixIcon: Icons.phone_outlined,
                    ).copyWith(
                      prefixIcon: Icon(
                        Icons.phone_outlined,
                        color: AppTheme.accent,
                      ),
                      hintText: '9876543210',
                      helperText: 'Indian mobile: 10 digits starting with 6–9',
                    ),
                  ),
                  if (provider.profile!.businessName.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    Text(
                      'Business: ${provider.profile!.businessName}',
                      style: TextStyle(color: colors.textMuted, fontSize: 12),
                    ),
                  ],
                  const SizedBox(height: 20),
                  ElevatedButton(
                    onPressed: provider.saving ? null : _save,
                    child: provider.saving
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text('Save profile'),
                  ),
                ],
                const SizedBox(height: 28),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(
                    Icons.lock_outline,
                    color: colors.accent,
                  ),
                  title: Text(
                    'Change password',
                    style: TextStyle(color: colors.textPrimary),
                  ),
                  trailing: Icon(
                    Icons.chevron_right,
                    color: colors.textMuted,
                  ),
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const UpdatePasswordScreen(),
                      ),
                    );
                  },
                ),
              ],
            ),
    );
  }
}

class UpdatePasswordScreen extends StatefulWidget {
  const UpdatePasswordScreen({super.key});

  @override
  State<UpdatePasswordScreen> createState() => _UpdatePasswordScreenState();
}

class _UpdatePasswordScreenState extends State<UpdatePasswordScreen> {
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  String? _currentErr;
  String? _newErr;
  String? _confirmErr;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _confirm.dispose();
    super.dispose();
  }

  bool _validate() {
    final currentErr =
        requiredMessage(_current.text, message: 'Current password is required');
    String? newErr =
        requiredMessage(_next.text, message: 'New password is required');
    if (newErr == null && _next.text.length < 8) {
      newErr = 'New password must be at least 8 characters.';
    }
    String? confirmErr = requiredMessage(
      _confirm.text,
      message: 'Confirm password is required',
    );
    if (confirmErr == null && _confirm.text != _next.text) {
      confirmErr = 'New password and confirm password must match.';
    }
    setState(() {
      _currentErr = currentErr;
      _newErr = newErr;
      _confirmErr = confirmErr;
    });
    return currentErr == null && newErr == null && confirmErr == null;
  }

  Future<void> _submit() async {
    if (!_validate()) {
      showRequiredFieldsBlocked(context);
      return;
    }
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final email = auth.email ?? '';
    if (email.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Missing account email. Please sign in again.'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }
    final ok = await auth.changePassword(email, _current.text, _next.text);
    if (!mounted) return;
    if (ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Password updated successfully.')),
      );
      Navigator.pop(context);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(auth.errorMessage ?? 'Failed to update password'),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Change password')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const RequiredFieldsNote(),
          CustomTextField(
            label: 'Current password',
            icon: Icons.lock_outline,
            isPassword: true,
            required: true,
            errorText: _currentErr,
            controller: _current,
          ),
          const SizedBox(height: 12),
          CustomTextField(
            label: 'New password',
            icon: Icons.lock_rounded,
            isPassword: true,
            required: true,
            errorText: _newErr,
            controller: _next,
          ),
          const SizedBox(height: 12),
          CustomTextField(
            label: 'Confirm new password',
            icon: Icons.lock_rounded,
            isPassword: true,
            required: true,
            errorText: _confirmErr,
            controller: _confirm,
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: auth.isLoading ? null : _submit,
            child: auth.isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Text('Update password'),
          ),
        ],
      ),
    );
  }
}
