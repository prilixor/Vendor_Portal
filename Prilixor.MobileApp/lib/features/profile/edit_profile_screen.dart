import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/providers/profile_provider.dart';
import '../../core/theme.dart';
import '../../core/utils/indian_mobile_phone.dart';
import '../../shared/widgets/brand_page_loader.dart';
import '../../shared/widgets/indian_mobile_field.dart';
import '../../shared/widgets/required_field_ux.dart';

class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  String? _nameError;
  String? _phoneError;
  bool _initialized = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_initialized) return;
    final profile = Provider.of<ProfileProvider>(context, listen: false).profile;
    if (profile != null) {
      _nameController.text = profile.name;
      _phoneController.text = IndianMobilePhone.normalizeDigits(profile.phoneNumber);
      _initialized = true;
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  bool _validate() {
    final name = _nameController.text.trim();
    String? nameErr;
    if (name.isEmpty) {
      nameErr = 'Full name is required';
    } else if (name.length < 2) {
      nameErr = 'Please enter your full name.';
    }
    final phoneErr = IndianMobilePhone.optionalError(_phoneController.text);
    setState(() {
      _nameError = nameErr;
      _phoneError = phoneErr;
    });
    return nameErr == null && phoneErr == null;
  }

  Future<void> _save() async {
    if (!_validate()) {
      showRequiredFieldsBlocked(context);
      return;
    }

    final phoneRaw = _phoneController.text.trim();
    final phone = phoneRaw.isEmpty ? '' : IndianMobilePhone.normalizeDigits(phoneRaw);
    final provider = Provider.of<ProfileProvider>(context, listen: false);
    final success = await provider.updateProfile(
      _nameController.text.trim(),
      phone,
    );

    if (!mounted) return;

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profile updated.'), backgroundColor: Colors.green),
      );
      Navigator.pop(context);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(provider.errorMessage ?? 'Failed to update profile.'),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<ProfileProvider>(context);
    final profile = provider.profile;
    final colors = context.appColors;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        title: Text('Edit Profile', style: TextStyle(color: colors.textPrimary)),
        backgroundColor: colors.background,
        elevation: 0,
        iconTheme: IconThemeData(color: colors.textPrimary),
      ),
      body: profile == null
          ? const BrandPageLoader()
          : SafeArea(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const RequiredFieldsNote(),
                    TextField(
                      controller: _nameController,
                      style: TextStyle(color: colors.textPrimary),
                      textCapitalization: TextCapitalization.words,
                      onChanged: (_) {
                        if (_nameError != null) setState(() => _nameError = null);
                      },
                      decoration: requiredInputDecoration(
                        context,
                        label: 'Full name',
                        required: true,
                        errorText: _nameError,
                        prefixIcon: Icons.person_outline,
                      ),
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      initialValue: profile.email,
                      readOnly: true,
                      style: TextStyle(color: colors.textSecondary),
                      decoration: requiredInputDecoration(
                        context,
                        label: 'Email',
                        prefixIcon: Icons.email_outlined,
                        fillColor: colors.background,
                      ).copyWith(
                        helperText: 'Email cannot be changed',
                        helperStyle: TextStyle(color: colors.textMuted, fontSize: 11),
                      ),
                    ),
                    const SizedBox(height: 16),
                    IndianMobileField(
                      controller: _phoneController,
                      label: 'Phone',
                      errorText: _phoneError,
                      onChanged: (_) {
                        if (_phoneError != null) setState(() => _phoneError = null);
                      },
                    ),
                    const SizedBox(height: 32),
                    SizedBox(
                      height: 56,
                      child: ElevatedButton(
                        onPressed: provider.isLoading ? null : _save,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF6C63FF),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        ),
                        child: provider.isLoading
                            ? const SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                              )
                            : const Text(
                                'Save changes',
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
