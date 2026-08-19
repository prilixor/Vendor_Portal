import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/providers/vendor_onboarding_provider.dart';
import '../../core/providers/vendor_profile_provider.dart';
import '../../core/theme.dart';
import '../../features/onboarding/onboarding_screen.dart';

const _requiredDocTypes = [
  'GST Certificate',
  'PAN Card',
  'Trade License',
  'Address Proof',
  'Cancelled Cheque',
];

enum _BannerVariant {
  missingDocs,
  pendingReview,
  rejected,
  accountRejected,
  accountSuspended,
}

/// Mirrors Vendor Web VendorVerificationBanner states.
class PendingApprovalBanner extends StatefulWidget {
  const PendingApprovalBanner({super.key});

  /// Used by Home to hide the duplicate in-body verification banner.
  static bool isVisible(
    VendorProfileProvider profile,
    VendorOnboardingProvider onboarding,
  ) =>
      _resolveBannerVariant(profile, onboarding) != null;

  @override
  State<PendingApprovalBanner> createState() => _PendingApprovalBannerState();
}

_BannerVariant? _resolveBannerVariant(
  VendorProfileProvider profile,
  VendorOnboardingProvider onboarding,
) {
  final status = (profile.status?.accountStatus ?? '').trim().toLowerCase();
  final docs = onboarding.documents;
  final uploadedTypes = docs.map((d) => d.documentType).toSet();
  final missing = _requiredDocTypes.where((t) => !uploadedTypes.contains(t)).toList();
  final hasRejected = onboarding.hasRejectedVerificationItems;

  if (status == 'rejected') return _BannerVariant.accountRejected;
  if (status == 'suspended' || status == 'banned') {
    return _BannerVariant.accountSuspended;
  }
  if (hasRejected) return _BannerVariant.rejected;
  if (missing.isNotEmpty) return _BannerVariant.missingDocs;
  if (status == 'pending') return _BannerVariant.pendingReview;
  return null;
}

class _PendingApprovalBannerState extends State<PendingApprovalBanner> {
  bool _dismissedPending = false;

  _BannerVariant? _resolveVariant(
    VendorProfileProvider profile,
    VendorOnboardingProvider onboarding,
  ) =>
      _resolveBannerVariant(profile, onboarding);

  @override
  Widget build(BuildContext context) {
    final profile = Provider.of<VendorProfileProvider>(context);
    final onboarding = Provider.of<VendorOnboardingProvider>(context);
    final variant = _resolveVariant(profile, onboarding);
    if (variant == null) return const SizedBox.shrink();
    if (variant == _BannerVariant.pendingReview && _dismissedPending) {
      return const SizedBox.shrink();
    }

    final docs = onboarding.documents;
    final uploadedTypes = docs.map((d) => d.documentType).toSet();
    final missing = _requiredDocTypes.where((t) => !uploadedTypes.contains(t)).toList();
    final approvedCount =
        docs.where((d) => d.verificationStatus.toLowerCase() == 'approved').length;

    late String title;
    late String body;
    late Color accent;
    late IconData icon;
    String? cta;
    bool dismissible = false;

    switch (variant) {
      case _BannerVariant.accountRejected:
        title = 'Your vendor application was rejected';
        body = 'Review feedback in Onboarding and resubmit your details.';
        accent = Colors.redAccent;
        icon = Icons.block;
        cta = 'Open onboarding';
        break;
      case _BannerVariant.accountSuspended:
        title = 'Your account is temporarily restricted';
        body = 'Contact support if you believe this is a mistake.';
        accent = Colors.orangeAccent;
        icon = Icons.lock_outline;
        break;
      case _BannerVariant.rejected:
        title = 'Verification needs your attention';
        body = 'One or more documents or bank details were rejected. Fix and resubmit.';
        accent = Colors.amber;
        icon = Icons.warning_amber_rounded;
        cta = 'Fix in onboarding';
        break;
      case _BannerVariant.missingDocs:
        title = 'Complete your document verification';
        body =
            'Upload required documents to unlock operations. Progress: $approvedCount / ${_requiredDocTypes.length}. Missing: ${missing.join(', ')}.';
        accent = Colors.lightBlueAccent;
        icon = Icons.upload_file_outlined;
        cta = 'Upload documents';
        break;
      case _BannerVariant.pendingReview:
        title = 'Your account is pending approval';
        body =
            'Some features are limited while under review. Estimated review: 1–2 business days.';
        accent = Colors.amber;
        icon = Icons.schedule;
        dismissible = true;
        break;
    }

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(12, 0, 12, 8),
      padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: accent.withValues(alpha: 0.35)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: accent.withValues(alpha: 0.2),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: accent, size: 18),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    color: context.appColors.textPrimary,
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  body,
                  style: TextStyle(
                    color: context.appColors.textSecondary,
                    fontSize: 11,
                    height: 1.35,
                  ),
                ),
                if (cta != null) ...[
                  const SizedBox(height: 8),
                  TextButton(
                    style: TextButton.styleFrom(
                      foregroundColor: accent,
                      padding: EdgeInsets.zero,
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const OnboardingScreen()),
                      );
                    },
                    child: Text(cta, style: const TextStyle(fontWeight: FontWeight.w700)),
                  ),
                ],
              ],
            ),
          ),
          if (dismissible)
            IconButton(
              visualDensity: VisualDensity.compact,
              onPressed: () => setState(() => _dismissedPending = true),
              icon: Icon(Icons.close, color: context.appColors.textMuted, size: 18),
            ),
        ],
      ),
    );
  }
}
