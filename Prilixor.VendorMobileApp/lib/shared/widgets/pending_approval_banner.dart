import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/providers/vendor_profile_provider.dart';

/// Mirrors Vendor Web PendingApprovalBanner — dismissible per session.
class PendingApprovalBanner extends StatefulWidget {
  const PendingApprovalBanner({super.key});

  @override
  State<PendingApprovalBanner> createState() => _PendingApprovalBannerState();
}

class _PendingApprovalBannerState extends State<PendingApprovalBanner> {
  bool _dismissed = false;

  @override
  Widget build(BuildContext context) {
    final isPending =
        Provider.of<VendorProfileProvider>(context).isPending;
    if (!isPending || _dismissed) return const SizedBox.shrink();

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(12, 0, 12, 8),
      padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
      decoration: BoxDecoration(
        color: Colors.amber.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.amber.withValues(alpha: 0.35)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: Colors.amber.withValues(alpha: 0.2),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.schedule, color: Colors.amber, size: 18),
          ),
          const SizedBox(width: 10),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Your account is pending approval',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
                SizedBox(height: 4),
                Text(
                  'Some features are limited while under review. You can explore, but product listing and receiving orders may be restricted until approved.',
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 11,
                    height: 1.35,
                  ),
                ),
                SizedBox(height: 6),
                Text(
                  'Estimated review: 1–2 business days',
                  style: TextStyle(color: Colors.white38, fontSize: 10),
                ),
              ],
            ),
          ),
          IconButton(
            visualDensity: VisualDensity.compact,
            onPressed: () => setState(() => _dismissed = true),
            icon: const Icon(Icons.close, color: Colors.white54, size: 18),
          ),
        ],
      ),
    );
  }
}
