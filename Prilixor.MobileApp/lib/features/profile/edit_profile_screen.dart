import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/providers/profile_provider.dart';
import '../../core/theme.dart';
import '../../core/utils/indian_mobile_phone.dart';
import '../../shared/widgets/brand_page_loader.dart';
import '../../shared/widgets/indian_mobile_field.dart';
import '../../shared/widgets/phone_otp_dialog.dart';
import '../../shared/widgets/required_field_ux.dart';

class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  String? _nameError;
  String? _emailError;
  String? _phoneError;
  bool _phoneVerified = false;
  bool _isResendingEmail = false;
  bool _initialized = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<ProfileProvider>(context, listen: false).fetchProfile();
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final profile = Provider.of<ProfileProvider>(context).profile;
    if (profile != null) {
      if (!_initialized) {
        _nameController.text = profile.name;
        _emailController.text = profile.email.trim();
        _phoneController.text = IndianMobilePhone.normalizeDigits(profile.phoneNumber);
        _initialized = true;
      }
      _phoneVerified = profile.isPhoneVerified;
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
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

    final profile = Provider.of<ProfileProvider>(context, listen: false).profile;
    final hasStoredEmail = profile?.email.trim().isNotEmpty ?? false;
    final emailText = _emailController.text.trim();
    String? emailErr;
    if (!hasStoredEmail && emailText.isNotEmpty) {
      if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(emailText)) {
        emailErr = 'Enter a valid email address.';
      }
    }

    final phoneErr = IndianMobilePhone.optionalError(_phoneController.text);
    setState(() {
      _nameError = nameErr;
      _emailError = emailErr;
      _phoneError = phoneErr;
    });
    return nameErr == null && emailErr == null && phoneErr == null;
  }

  Future<void> _verifyPhoneSms() async {
    final normalized = IndianMobilePhone.normalizeDigits(_phoneController.text);
    if (!IndianMobilePhone.isValid(normalized)) return;

    final verified = await PhoneOtpDialog.show(
      context,
      phone: normalized,
      role: 'customer',
      title: 'Verify phone number',
    );

    if (verified == true && mounted) {
      setState(() => _phoneVerified = true);
      await Provider.of<ProfileProvider>(context, listen: false).fetchProfile();
    }
  }

  Future<void> _resendVerificationEmail(String email) async {
    setState(() => _isResendingEmail = true);
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final ok = await auth.resendVerification(email);
    if (!mounted) return;
    setState(() => _isResendingEmail = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          ok
              ? 'Verification link has been resent.'
              : (auth.errorMessage ?? 'Failed to resend verification link.'),
        ),
        backgroundColor: ok ? Colors.green : Colors.redAccent,
      ),
    );
  }

  Future<void> _save() async {
    if (!_validate()) {
      showRequiredFieldsBlocked(context);
      return;
    }

    final phoneRaw = _phoneController.text.trim();
    final phone = phoneRaw.isEmpty ? '' : IndianMobilePhone.normalizeDigits(phoneRaw);
    final provider = Provider.of<ProfileProvider>(context, listen: false);
    final currentProfile = provider.profile;
    final hasStoredEmail = currentProfile?.email.trim().isNotEmpty ?? false;
    final emailToAdd = !hasStoredEmail && _emailController.text.trim().isNotEmpty
        ? _emailController.text.trim()
        : null;

    final success = await provider.updateProfile(
      _nameController.text.trim(),
      phone,
      email: emailToAdd,
    );

    if (!mounted) return;

    if (success) {
      final updatedProfile = provider.profile;
      final isVerified = updatedProfile?.isPhoneVerified ?? false;
      final hasPhone = phone.isNotEmpty;
      final addedEmail = !hasStoredEmail && (emailToAdd != null);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            addedEmail
                ? 'Profile updated. Check your inbox to verify the new email.'
                : (hasPhone && !isVerified
                    ? 'Profile updated. Verify your phone to enable SMS alerts.'
                    : 'Profile updated.'),
          ),
          backgroundColor: Colors.green,
        ),
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
    final normalizedPhone = IndianMobilePhone.normalizeDigits(_phoneController.text);
    final isValidPhone = IndianMobilePhone.isValid(normalizedPhone);
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
                    Builder(
                      builder: (_) {
                        final hasStoredEmail = profile.email.trim().isNotEmpty;
                        final emailLocked = hasStoredEmail;
                        final emailVerified = profile.isEmailVerified;

                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (!emailLocked)
                              TextField(
                                controller: _emailController,
                                keyboardType: TextInputType.emailAddress,
                                style: TextStyle(color: colors.textPrimary),
                                onChanged: (_) {
                                  if (_emailError != null) setState(() => _emailError = null);
                                },
                                decoration: requiredInputDecoration(
                                  context,
                                  label: 'Email',
                                  errorText: _emailError,
                                  prefixIcon: Icons.email_outlined,
                                  hintText: 'you@example.com',
                                ),
                              )
                            else
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Expanded(
                                    child: TextFormField(
                                      initialValue: profile.email,
                                      readOnly: true,
                                      style: TextStyle(color: colors.textSecondary),
                                      decoration: requiredInputDecoration(
                                        context,
                                        label: 'Email',
                                        prefixIcon: Icons.email_outlined,
                                        fillColor: colors.background,
                                      ),
                                    ),
                                  ),
                                  if (!emailVerified) ...[
                                    const SizedBox(width: 8),
                                    SizedBox(
                                      height: 52,
                                      child: OutlinedButton(
                                        onPressed: _isResendingEmail
                                            ? null
                                            : () => _resendVerificationEmail(profile.email),
                                        style: OutlinedButton.styleFrom(
                                          foregroundColor: const Color(0xFF6C63FF),
                                          side: const BorderSide(color: Color(0xFF6C63FF)),
                                          shape: RoundedRectangleBorder(
                                            borderRadius: BorderRadius.circular(12),
                                          ),
                                        ),
                                        child: _isResendingEmail
                                            ? const SizedBox(
                                                height: 18,
                                                width: 18,
                                                child: CircularProgressIndicator(
                                                  strokeWidth: 2,
                                                  color: Color(0xFF6C63FF),
                                                ),
                                              )
                                            : const Text(
                                                'Resend verify',
                                                style: TextStyle(
                                                  fontSize: 12.5,
                                                  fontWeight: FontWeight.w600,
                                                ),
                                              ),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            if (_emailError == null)
                              Padding(
                                padding: const EdgeInsets.only(top: 4, left: 4),
                                child: Text(
                                  !emailLocked
                                      ? "Optional. Add an email to sign in with email/password and receive email alerts. We'll send a verification link."
                                      : (emailVerified
                                          ? 'Verified email on this account.'
                                          : 'Email added but not verified yet — open the link we sent, or resend.'),
                                  style: TextStyle(
                                    color: emailVerified
                                        ? const Color(0xFF10B981)
                                        : colors.textMuted,
                                    fontSize: 11,
                                    height: 1.35,
                                  ),
                                ),
                              ),
                          ],
                        );
                      },
                    ),
                    const SizedBox(height: 16),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: IndianMobileField(
                                controller: _phoneController,
                                label: 'Phone',
                                errorText: _phoneError,
                                onChanged: (_) {
                                  setState(() {
                                    _phoneVerified = false;
                                    if (_phoneError != null) _phoneError = null;
                                  });
                                },
                              ),
                            ),
                            const SizedBox(width: 8),
                            Padding(
                              padding: const EdgeInsets.only(top: 28),
                              child: SizedBox(
                                height: 52,
                                child: OutlinedButton(
                                  onPressed: (!isValidPhone || _phoneVerified)
                                      ? null
                                      : _verifyPhoneSms,
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: _phoneVerified
                                        ? const Color(0xFF10B981)
                                        : const Color(0xFF6C63FF),
                                    side: BorderSide(
                                      color: _phoneVerified
                                          ? const Color(0xFF10B981)
                                          : const Color(0xFF6C63FF),
                                    ),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                  ),
                                  child: Text(
                                    _phoneVerified ? 'Verified' : 'Verify SMS',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 13,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                        if (_phoneError == null)
                          Padding(
                            padding: const EdgeInsets.only(top: 4, left: 4),
                            child: Text(
                              _phoneVerified
                                  ? 'Verified - SMS order updates can be delivered.'
                                  : '10-digit Indian mobile starting with 6-9. Verify to enable SMS alerts.',
                              style: const TextStyle(color: Colors.white38, fontSize: 11),
                            ),
                          ),
                      ],
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