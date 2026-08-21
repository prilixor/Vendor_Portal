import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/models/vendor_onboarding_model.dart';
import '../../core/theme.dart';
import '../../shared/widgets/admin_comment_hint.dart';
import '../../shared/widgets/required_field_ux.dart';

class OnboardingStatusBanner extends StatelessWidget {
  final String accountStatus;
  final String? verificationStatus;
  final bool isVerified;
  final int documentsUploaded;
  final int documentsRequired;
  final bool hasBank;

  const OnboardingStatusBanner({
    super.key,
    required this.accountStatus,
    this.verificationStatus,
    required this.isVerified,
    required this.documentsUploaded,
    this.documentsRequired = 5,
    required this.hasBank,
  });

  @override
  Widget build(BuildContext context) {
    final progress = documentsRequired == 0
        ? 0.0
        : (documentsUploaded / documentsRequired).clamp(0.0, 1.0);

    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppTheme.accent.withValues(alpha: 0.18),
            AppTheme.card(context),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.accent.withValues(alpha: 0.22)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: AppTheme.accent.withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.verified_user_outlined, color: AppTheme.accent),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isVerified ? 'Verification complete' : 'Complete your onboarding',
                      style: TextStyle(
                        color: context.appColors.textPrimary,
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Account ┬╖ ${accountStatus.trim().isEmpty ? 'unknown' : accountStatus}',
                      style: TextStyle(
                        color: context.appColors.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              if (verificationStatus != null)
                VerificationStatusChip(status: verificationStatus!),
            ],
          ),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: isVerified ? 1 : progress,
              minHeight: 6,
              backgroundColor: context.appColors.border,
              color: isVerified ? const Color(0xFF34D399) : AppTheme.accent,
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: [
              _ChecklistChip(
                done: documentsUploaded >= documentsRequired,
                label: 'Documents $documentsUploaded/$documentsRequired',
              ),
              _ChecklistChip(done: hasBank, label: 'Bank details'),
              _ChecklistChip(
                done: verificationStatus?.toLowerCase() == 'approved',
                label: 'Admin approval',
              ),
            ],
          ),
          if (!isVerified) ...[
            const SizedBox(height: 10),
            Text(
              'Upload all required documents, save bank details, then tap Submit.',
              style: TextStyle(
                color: Colors.amber.withValues(alpha: 0.95),
                fontSize: 12,
                height: 1.35,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ChecklistChip extends StatelessWidget {
  final bool done;
  final String label;

  const _ChecklistChip({required this.done, required this.label});

  @override
  Widget build(BuildContext context) {
    final isDark = context.isDarkMode;
    final bgColor = done
        ? (isDark ? const Color(0xFF34D399).withValues(alpha: 0.14) : const Color(0xFFDCFCE7))
        : (isDark ? context.appColors.textMuted.withValues(alpha: 0.08) : const Color(0xFFF1F5F9));
    final borderColor = done
        ? (isDark ? const Color(0xFF34D399).withValues(alpha: 0.35) : const Color(0xFF86EFAC))
        : context.appColors.border;
    final textColor = done
        ? (isDark ? const Color(0xFF34D399) : const Color(0xFF15803D))
        : context.appColors.textSecondary;
    final iconColor = done
        ? (isDark ? const Color(0xFF34D399) : const Color(0xFF16A34A))
        : context.appColors.textMuted;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: borderColor),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            done ? Icons.check_circle : Icons.radio_button_unchecked,
            size: 14,
            color: iconColor,
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              color: textColor,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
class VerificationStatusChip extends StatelessWidget {
  final String status;

  const VerificationStatusChip({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    final isDark = context.isDarkMode;
    final style = verificationStatusStyle(status, isDark);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: style.bgColor,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: style.borderColor),
      ),
      child: Text(
        style.label,
        style: TextStyle(
          color: style.textColor,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class VerificationStatusStyle {
  final String label;
  final Color textColor;
  final Color bgColor;
  final Color borderColor;

  const VerificationStatusStyle(this.label, this.textColor, this.bgColor, this.borderColor);
}

VerificationStatusStyle verificationStatusStyle(String raw, bool isDark) {
  final s = raw.toLowerCase();
  if (s == 'approved') {
    return VerificationStatusStyle(
      'Approved',
      isDark ? const Color(0xFF34D399) : const Color(0xFF15803D),
      isDark ? const Color(0xFF34D399).withValues(alpha: 0.14) : const Color(0xFFDCFCE7),
      isDark ? const Color(0xFF34D399).withValues(alpha: 0.35) : const Color(0xFF86EFAC),
    );
  }
  if (s == 'rejected') {
    return VerificationStatusStyle(
      'Rejected',
      isDark ? const Color(0xFFFB7185) : const Color(0xFFB91C1C),
      isDark ? const Color(0xFFFB7185).withValues(alpha: 0.14) : const Color(0xFFFEE2E2),
      isDark ? const Color(0xFFFB7185).withValues(alpha: 0.35) : const Color(0xFFFCA5A5),
    );
  }
  if (s == 'under_review' || s == 'submitted') {
    return VerificationStatusStyle(
      'Under review',
      isDark ? const Color(0xFF60A5FA) : const Color(0xFF1D4ED8),
      isDark ? const Color(0xFF60A5FA).withValues(alpha: 0.14) : const Color(0xFFDBEAFE),
      isDark ? const Color(0xFF60A5FA).withValues(alpha: 0.35) : const Color(0xFF93C5FD),
    );
  }
  return VerificationStatusStyle(
    'Pending',
    isDark ? const Color(0xFFFBBF24) : const Color(0xFFB45309),
    isDark ? const Color(0xFFFBBF24).withValues(alpha: 0.14) : const Color(0xFFFEF3C7),
    isDark ? const Color(0xFFFBBF24).withValues(alpha: 0.35) : const Color(0xFFFCD34D),
  );
}
class SavedBankAccountCard extends StatelessWidget {
  final String bankName;
  final String accountHolderName;
  final String maskedAccountNumber;
  final String ifscCode;
  final String branchName;
  final String verificationStatus;

  const SavedBankAccountCard({
    super.key,
    required this.bankName,
    required this.accountHolderName,
    required this.maskedAccountNumber,
    required this.ifscCode,
    required this.branchName,
    required this.verificationStatus,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            const Color(0xFF34D399).withValues(alpha: 0.12),
            AppTheme.card(context),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF34D399).withValues(alpha: 0.22)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: const Color(0xFF34D399).withValues(alpha: 0.16),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(Icons.account_balance_rounded, color: Color(0xFF34D399)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Saved bank account',
                        style: TextStyle(
                          color: context.appColors.textMuted,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.4,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        bankName,
                        style: TextStyle(
                          color: context.appColors.textPrimary,
                          fontWeight: FontWeight.w800,
                          fontSize: 16,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        accountHolderName,
                        style: TextStyle(
                          color: context.appColors.textSecondary,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                VerificationStatusChip(status: verificationStatus),
              ],
            ),
            const SizedBox(height: 14),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _BankMetaChip(label: 'Account', value: maskedAccountNumber),
                _BankMetaChip(label: 'IFSC', value: ifscCode),
                _BankMetaChip(label: 'Branch', value: branchName),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _BankMetaChip extends StatelessWidget {
  final String label;
  final String value;

  const _BankMetaChip({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: AppTheme.bg(context).withValues(alpha: 0.65),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: context.appColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: TextStyle(
              color: context.appColors.textMuted,
              fontSize: 9,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: TextStyle(
              color: context.appColors.textPrimary,
              fontSize: 12,
              fontWeight: FontWeight.w700,
              fontFamily: 'monospace',
            ),
          ),
        ],
      ),
    );
  }
}

class OnboardingFormSection extends StatelessWidget {
  final String title;
  final String? subtitle;
  final IconData? icon;
  final Widget child;

  const OnboardingFormSection({
    super.key,
    required this.title,
    this.subtitle,
    this.icon,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.card(context),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: context.appColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (icon != null) ...[
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: AppTheme.accent.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(icon, color: AppTheme.accent, size: 20),
                ),
                const SizedBox(width: 10),
              ],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        color: context.appColors.textPrimary,
                        fontWeight: FontWeight.w800,
                        fontSize: 16,
                      ),
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        subtitle!,
                        style: TextStyle(
                          color: context.appColors.textMuted,
                          fontSize: 12,
                          height: 1.35,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          child,
        ],
      ),
    );
  }
}

class OnboardingSubsectionTitle extends StatelessWidget {
  final String title;
  final IconData icon;

  const OnboardingSubsectionTitle({
    super.key,
    required this.title,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10, top: 4),
      child: Row(
        children: [
          Icon(icon, size: 16, color: context.appColors.textMuted),
          const SizedBox(width: 8),
          Text(
            title,
            style: TextStyle(
              color: context.appColors.textSecondary,
              fontSize: 12,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }
}

class OnboardingHintBanner extends StatelessWidget {
  final IconData icon;
  final String message;

  const OnboardingHintBanner({
    super.key,
    required this.icon,
    required this.message,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppTheme.accent.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.accent.withValues(alpha: 0.18)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: AppTheme.accent.withValues(alpha: 0.95)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: TextStyle(
                color: context.appColors.textSecondary,
                fontSize: 12,
                height: 1.35,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class OnboardingTextField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final String? hint;
  final String? helperText;
  final TextInputType? keyboardType;
  final ValueChanged<String>? onChanged;
  final bool enabled;
  final bool obscureText;
  final bool required;
  final int? maxLength;
  final TextCapitalization textCapitalization;
  final Widget? suffix;
  final List<TextInputFormatter>? inputFormatters;
  final String? prefixText;

  const OnboardingTextField({
    super.key,
    required this.controller,
    required this.label,
    this.hint,
    this.helperText,
    this.keyboardType,
    this.onChanged,
    this.enabled = true,
    this.obscureText = false,
    this.required = true,
    this.maxLength,
    this.textCapitalization = TextCapitalization.none,
    this.suffix,
    this.inputFormatters,
    this.prefixText,
  });

  /// Strip legacy trailing `*` from call sites; star is rendered in red via [RequiredLabel].
  String get _cleanLabel {
    var trimmed = label.trim();
    if (trimmed.endsWith('*')) {
      trimmed = trimmed.substring(0, trimmed.length - 1).trimRight();
    }
    return trimmed;
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          RequiredLabel(
            _cleanLabel,
            required: required,
            style: TextStyle(
              color: context.appColors.textSecondary,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 6),
          TextField(
            controller: controller,
            enabled: enabled,
            obscureText: obscureText,
            keyboardType: keyboardType,
            onChanged: onChanged,
            maxLength: maxLength,
            inputFormatters: inputFormatters,
            textCapitalization: textCapitalization,
            style: TextStyle(color: context.appColors.textPrimary, fontSize: 15),
            decoration: InputDecoration(
              hintText: hint,
              counterText: '',
              hintStyle: TextStyle(color: context.appColors.textMuted),
              filled: true,
              fillColor: AppTheme.bg(context),
              suffixIcon: suffix,
              prefixText: prefixText,
              prefixStyle: TextStyle(
                color: context.appColors.textPrimary,
                fontSize: 15,
                fontWeight: FontWeight.w600,
              ),
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: context.appColors.border),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: context.appColors.border),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: AppTheme.accent, width: 1.5),
              ),
              disabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: context.appColors.border.withValues(alpha: 0.5)),
              ),
            ),
          ),
          if (helperText != null) ...[
            const SizedBox(height: 4),
            Text(
              helperText!,
              style: TextStyle(
                color: context.appColors.textMuted,
                fontSize: 11,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

IconData documentTypeIcon(String type) {
  switch (type) {
    case 'GST Certificate':
      return Icons.receipt_long_outlined;
    case 'PAN Card':
      return Icons.badge_outlined;
    case 'Trade License':
      return Icons.storefront_outlined;
    case 'Address Proof':
      return Icons.home_work_outlined;
    case 'Cancelled Cheque':
      return Icons.account_balance_outlined;
    default:
      return Icons.description_outlined;
  }
}

class OnboardingRejectedHelpBanner extends StatelessWidget {
  final List<VendorDocument> rejectedDocuments;
  final bool rejectedBank;
  final VoidCallback onGetHelp;

  const OnboardingRejectedHelpBanner({
    super.key,
    required this.rejectedDocuments,
    required this.rejectedBank,
    required this.onGetHelp,
  });

  @override
  Widget build(BuildContext context) {
    final parts = <String>[
      ...rejectedDocuments.map((d) => d.documentType),
      if (rejectedBank) 'Bank account',
    ];
    final summary = parts.isEmpty
        ? 'Some verification items were rejected.'
        : 'Rejected: ${parts.join(', ')}.';
    final documentsWithComments = rejectedDocuments
        .where((d) => d.displayRejectionReason != null)
        .toList();

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.redAccent.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.redAccent.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.error_outline, color: Colors.redAccent, size: 20),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Verification needs attention',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '$summary Upload corrected files or contact support if you need help.',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.78),
              fontSize: 13,
              height: 1.35,
            ),
          ),
          if (documentsWithComments.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              'Admin comments on rejected documents:',
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.72),
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            ...documentsWithComments.map(
              (document) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: AdminCommentHint(
                  itemLabel: document.documentType,
                  comment: document.displayRejectionReason,
                  margin: EdgeInsets.zero,
                ),
              ),
            ),
          ],
          if (rejectedBank) ...[
            const SizedBox(height: 4),
            Text(
              'Bank rejection notes appear in Alerts if the admin left a comment.',
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.55),
                fontSize: 11,
                height: 1.35,
              ),
            ),
          ],
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: onGetHelp,
              icon: const Icon(Icons.support_agent_rounded, size: 18),
              label: const Text('Get help'),
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.white,
                side: BorderSide(color: Colors.white.withValues(alpha: 0.24)),
                minimumSize: const Size.fromHeight(42),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
