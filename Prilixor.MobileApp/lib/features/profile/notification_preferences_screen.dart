import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/providers/notification_provider.dart';
import '../../core/models/notification_preferences_model.dart';

class NotificationPreferencesScreen extends StatefulWidget {
  const NotificationPreferencesScreen({super.key});

  @override
  State<NotificationPreferencesScreen> createState() => _NotificationPreferencesScreenState();
}

class _NotificationPreferencesScreenState extends State<NotificationPreferencesScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<NotificationProvider>(context, listen: false).fetchPreferences();
    });
  }

  Future<void> _toggle(
    NotificationPreferencesModel current,
    NotificationPreferencesModel Function(NotificationPreferencesModel) update,
  ) async {
    final provider = Provider.of<NotificationProvider>(context, listen: false);
    final next = update(current);
    final ok = await provider.updatePreferences(next);
    if (!ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to update preference'), backgroundColor: Colors.redAccent),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<NotificationProvider>(context);
    final prefs = provider.preferences;

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        title: const Text('Notification preferences', style: TextStyle(color: Colors.white)),
        backgroundColor: const Color(0xFF0F172A),
        iconTheme: const IconThemeData(color: Colors.white),
        elevation: 0,
      ),
      body: provider.isLoadingPrefs && prefs == null
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF6C63FF)))
          : prefs == null
              ? const Center(child: Text('Could not load preferences.', style: TextStyle(color: Colors.white70)))
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    _prefTile(
                      title: 'Order Status Updates',
                      desc: 'Get real-time updates on your orders, deliveries, and returns.',
                      value: prefs.orderStatusUpdatesEnabled,
                      onChanged: (v) => _toggle(prefs, (p) => p.copyWith(orderStatusUpdatesEnabled: v)),
                    ),
                    _prefTile(
                      title: 'Expiration Reminders',
                      desc: 'Receive alerts when your rental period is about to end.',
                      value: prefs.expirationRemindersEnabled,
                      onChanged: (v) => _toggle(prefs, (p) => p.copyWith(expirationRemindersEnabled: v)),
                    ),
                    _prefTile(
                      title: 'Deposit & Refund Alerts',
                      desc: 'Get notified when your security deposits are refunded.',
                      value: prefs.depositRefundsEnabled,
                      onChanged: (v) => _toggle(prefs, (p) => p.copyWith(depositRefundsEnabled: v)),
                    ),
                    _prefTile(
                      title: 'Direct Messages',
                      desc: 'Allow vendors to contact you directly regarding your rentals.',
                      value: prefs.directMessagesEnabled,
                      onChanged: (v) => _toggle(prefs, (p) => p.copyWith(directMessagesEnabled: v)),
                    ),
                    _prefTile(
                      title: 'Marketing Emails',
                      desc: 'Receive occasional newsletters and promotional offers.',
                      value: prefs.marketingEmailsEnabled,
                      onChanged: (v) => _toggle(prefs, (p) => p.copyWith(marketingEmailsEnabled: v)),
                    ),
                  ],
                ),
    );
  }

  Widget _prefTile({
    required String title,
    required String desc,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white10),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                Text(desc, style: const TextStyle(color: Colors.white54, fontSize: 12)),
              ],
            ),
          ),
          Switch(
            value: value,
            onChanged: onChanged,
            activeThumbColor: const Color(0xFF6C63FF),
          ),
        ],
      ),
    );
  }
}
