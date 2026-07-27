import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/providers/vendor_profile_provider.dart';
import '../../core/providers/vendor_support_provider.dart';
import '../products/products_screen.dart';
import '../inventory/inventory_screen.dart';
import '../auth/login_screen.dart';
import '../onboarding/onboarding_screen.dart';
import '../service_areas/service_areas_screen.dart';
import '../support/support_chat_screen.dart';
import '../chat/chat_sessions_screen.dart';
import 'settings_screen.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  Future<void> _logout(BuildContext context) async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    await auth.logout();
    if (!context.mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (_) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final profile = Provider.of<VendorProfileProvider>(context).profile;
    final status = Provider.of<VendorProfileProvider>(context).status;
    final name = (profile?.ownerName.trim().isNotEmpty == true)
        ? profile!.ownerName.trim()
        : ((auth.displayName?.trim().isNotEmpty == true)
            ? auth.displayName!.trim()
            : 'Vendor');
    final email = auth.email ?? '—';
    final accountStatus = _formatAccountStatus(status?.accountStatus);
    final businessName = profile?.businessName.trim();
    final phone = profile?.supportPhone.trim();
    final supportUnread =
        Provider.of<VendorSupportProvider>(context).unreadAdminReplyCount;

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          const SizedBox(height: 8),
          Center(
            child: Container(
              width: 88,
              height: 88,
              decoration: BoxDecoration(
                color: const Color(0xFF6C63FF).withValues(alpha: 0.15),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.storefront_rounded,
                size: 44,
                color: Color(0xFF6C63FF),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            name,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            email,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white60, fontSize: 14),
          ),
          const SizedBox(height: 24),
          _InfoCard(
            children: [
              if (businessName != null && businessName.isNotEmpty)
                _InfoRow(label: 'Business', value: businessName),
              if (businessName != null && businessName.isNotEmpty)
                const Divider(color: Colors.white12, height: 24),
              if (phone != null && phone.isNotEmpty) ...[
                _InfoRow(label: 'Phone', value: phone),
                const Divider(color: Colors.white12, height: 24),
              ],
              _InfoRow(label: 'Account status', value: accountStatus),
            ],
          ),
          const SizedBox(height: 16),
          _MenuTile(
            icon: Icons.verified_user_outlined,
            title: 'Onboarding',
            subtitle: 'Profile, documents & bank',
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const OnboardingScreen()),
              );
            },
          ),
          _MenuTile(
            icon: Icons.map_outlined,
            title: 'Service Areas',
            subtitle: 'Delivery & service radius',
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const ServiceAreasScreen()),
              );
            },
          ),
          _MenuTile(
            icon: Icons.inventory_2_outlined,
            title: 'Products',
            subtitle: 'Equipment & chemical listings',
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const ProductsScreen()),
              );
            },
          ),
          _MenuTile(
            icon: Icons.warehouse_outlined,
            title: 'Inventory',
            subtitle: 'Stock levels & movements',
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const InventoryScreen()),
              );
            },
          ),
          _MenuTile(
            icon: Icons.settings_outlined,
            title: 'Settings',
            subtitle: 'Profile & password',
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const SettingsScreen()),
              );
            },
          ),
          _MenuTile(
            icon: Icons.support_agent_rounded,
            title: 'BlinksMed Support',
            subtitle: supportUnread > 0
                ? '$supportUnread new support ${supportUnread == 1 ? 'reply' : 'replies'}'
                : 'AI help & admin tickets',
            badgeCount: supportUnread,
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const SupportChatScreen()),
              );
            },
          ),
          _MenuTile(
            icon: Icons.chat_bubble_outline,
            title: 'Chats',
            subtitle: 'Customer order conversations',
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const ChatSessionsScreen()),
              );
            },
          ),
          const SizedBox(height: 28),
          ElevatedButton.icon(
            onPressed: () => _logout(context),
            icon: const Icon(Icons.logout_rounded),
            label: const Text(
              'Sign out',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.redAccent.withValues(alpha: 0.9),
              minimumSize: const Size.fromHeight(52),
            ),
          ),
        ],
      ),
    );
  }
}

String _formatAccountStatus(String? raw) {
  final value = raw?.trim();
  if (value == null || value.isEmpty) return '—';
  return value
      .split(RegExp(r'[\s_]+'))
      .where((part) => part.isNotEmpty)
      .map((part) => part[0].toUpperCase() + part.substring(1).toLowerCase())
      .join(' ');
}

class _MenuTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final int badgeCount;
  final VoidCallback onTap;

  const _MenuTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.badgeCount = 0,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white12),
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: const Color(0xFF1E293B),
        child: ListTile(
          leading: Badge(
            isLabelVisible: badgeCount > 0,
            label: Text('$badgeCount'),
            child: Icon(icon, color: const Color(0xFF6C63FF)),
          ),
          title: Text(title, style: const TextStyle(color: Colors.white)),
          subtitle: Text(subtitle, style: const TextStyle(color: Colors.white54)),
          trailing: const Icon(Icons.chevron_right, color: Colors.white38),
          onTap: onTap,
        ),
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  final List<Widget> children;

  const _InfoCard({required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white12),
      ),
      child: Column(children: children),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;

  const _InfoRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 100,
          child: Text(
            label,
            style: const TextStyle(color: Colors.white54, fontSize: 13),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}
