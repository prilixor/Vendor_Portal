import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api/api_client.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/theme.dart';

/// Equipment emergency for one order, matching Vendor Web `VendorOrderEmergencyCard`.
///
/// Shown only when admin chose to alert vendors. The API returns the reason, note, status and
/// times only. Customer name, phone and address are never included.
class VendorOrderEmergencyCard extends StatefulWidget {
  const VendorOrderEmergencyCard({super.key, required this.orderId});

  final String orderId;

  @override
  State<VendorOrderEmergencyCard> createState() => _VendorOrderEmergencyCardState();
}

class _VendorOrderEmergencyCardState extends State<VendorOrderEmergencyCard> {
  Map<String, dynamic>? _emergency;
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    _load();
    _poll = Timer.periodic(const Duration(seconds: 15), (_) => _load());
  }

  @override
  void didUpdateWidget(covariant VendorOrderEmergencyCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.orderId != widget.orderId) {
      setState(() => _emergency = null);
      _load();
    }
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    final vendorId = Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null || widget.orderId.isEmpty) return;
    try {
      final response = await ApiClient().dio.get('/vendors/$vendorId/orders/${widget.orderId}/emergency');
      final data = response.data;
      final emergency = data is Map ? data['emergency'] : null;
      if (!mounted) return;
      setState(() => _emergency = emergency is Map ? Map<String, dynamic>.from(emergency) : null);
    } catch (_) {
      // Keep whatever was shown; the next poll will retry.
    }
  }

  String _when(dynamic value) {
    final parsed = DateTime.tryParse(value?.toString() ?? '')?.toLocal();
    if (parsed == null) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    final hour = parsed.hour.toString().padLeft(2, '0');
    final minute = parsed.minute.toString().padLeft(2, '0');
    return '${parsed.day.toString().padLeft(2, '0')} ${months[parsed.month - 1]}, $hour:$minute';
  }

  @override
  Widget build(BuildContext context) {
    final emergency = _emergency;
    if (emergency == null) return const SizedBox.shrink();

    final status = emergency['status']?.toString() ?? '';
    final live = status == 'open' || status == 'acknowledged';
    final reason = emergency['reasonLabel']?.toString() ?? 'Equipment emergency';
    final note = emergency['note']?.toString().trim() ?? '';
    final statusText = status == 'open'
        ? 'Waiting for BlinksMed to respond'
        : status == 'acknowledged'
            ? 'BlinksMed is handling this'
            : 'Resolved';
    final statusTime = status == 'resolved'
        ? _when(emergency['resolvedAt'])
        : status == 'acknowledged'
            ? _when(emergency['acknowledgedAt'])
            : '';

    final colors = context.appColors;
    final accent = live ? Colors.red.shade700 : colors.textSecondary;

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: live ? Colors.red.withValues(alpha: 0.08) : colors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: live ? Colors.red.shade300 : colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.emergency_outlined, size: 18, color: accent),
              const SizedBox(width: 6),
              Text(
                'Equipment emergency',
                style: TextStyle(color: accent, fontWeight: FontWeight.w700, fontSize: 13),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            note.isEmpty ? reason : '$reason — $note',
            style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w600, fontSize: 13),
          ),
          const SizedBox(height: 4),
          Text(
            'Raised ${_when(emergency['createdAt'])} · $statusText${statusTime.isEmpty ? '' : ' · $statusTime'}',
            style: TextStyle(color: colors.textSecondary, fontSize: 11),
          ),
        ],
      ),
    );
  }
}
