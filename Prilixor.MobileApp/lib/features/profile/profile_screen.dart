import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/providers/profile_provider.dart';
import '../../core/auth/auth_provider.dart';
import '../../shared/utils/require_auth.dart';
import '../auth/login_screen.dart';
import 'addresses_screen.dart';
import '../chat/chat_sessions_screen.dart';
import '../orders/expirations_screen.dart';
import 'edit_profile_screen.dart';
import 'notification_preferences_screen.dart';
import 'support_screen.dart';
import 'update_password_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      if (auth.isAuthenticated) {
        Provider.of<ProfileProvider>(context, listen: false).fetchProfile();
      }
    });
  }

  Future<void> _requireAuth(VoidCallback action) async {
    final ok = await ensureAuthenticated(context);
    if (!ok || !mounted) return;
    action();
  }

  Future<void> _openEditProfile() async {
    await _requireAuth(() async {
      await Navigator.push(context, MaterialPageRoute(builder: (_) => const EditProfileScreen()));
    });
  }

  @override
  Widget build(BuildContext context) {
    final profileProvider = Provider.of<ProfileProvider>(context);
    final authProvider = Provider.of<AuthProvider>(context);

    if (!authProvider.isAuthenticated) {
      return Scaffold(
        backgroundColor: const Color(0xFF0F172A),
        appBar: AppBar(
          title: const Text('My Profile', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          backgroundColor: const Color(0xFF0F172A),
          elevation: 0,
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.person_outline, size: 64, color: Colors.white24),
                const SizedBox(height: 16),
                const Text('Sign in to manage your account', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                const Text('Addresses, messages, and settings require login.', style: TextStyle(color: Colors.white54), textAlign: TextAlign.center),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const LoginScreen(popOnSuccess: true)),
                  ),
                  child: const Text('Sign in', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        title: const Text('My Profile', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF0F172A),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.edit_outlined, color: Colors.white),
            tooltip: 'Edit profile',
            onPressed: profileProvider.profile == null ? null : _openEditProfile,
          ),
        ],
      ),
      body: profileProvider.isLoading && profileProvider.profile == null
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF6C63FF)))
          : profileProvider.profile == null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.lock_outline, size: 48, color: Colors.white24),
                        const SizedBox(height: 16),
                        Text(
                          profileProvider.errorMessage == 'session_expired'
                              ? 'Your session expired'
                              : (profileProvider.errorMessage ?? 'Failed to load profile'),
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'Please sign in again to continue.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Colors.white54),
                        ),
                        const SizedBox(height: 24),
                        ElevatedButton(
                          onPressed: () async {
                            final profile = Provider.of<ProfileProvider>(context, listen: false);
                            profile.clearProfile();
                            await authProvider.logout();
                            if (!context.mounted) return;
                            Navigator.of(context).pushAndRemoveUntil(
                              MaterialPageRoute(builder: (_) => const LoginScreen()),
                              (_) => false,
                            );
                          },
                          child: const Text('Sign in again', style: TextStyle(fontWeight: FontWeight.bold)),
                        ),
                        const SizedBox(height: 12),
                        TextButton(
                          onPressed: () => profileProvider.fetchProfile(),
                          child: const Text('Retry', style: TextStyle(color: Colors.white70)),
                        ),
                      ],
                    ),
                  ),
                )
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    children: [
                      Container(
                        width: 100,
                        height: 100,
                        decoration: BoxDecoration(
                          color: const Color(0xFF6C63FF).withValues(alpha: 0.2),
                          shape: BoxShape.circle,
                          border: Border.all(color: const Color(0xFF6C63FF), width: 2),
                        ),
                        child: Center(
                          child: Text(
                            profileProvider.profile!.name.isNotEmpty ? profileProvider.profile!.name[0].toUpperCase() : '?',
                            style: const TextStyle(color: Color(0xFF6C63FF), fontSize: 40, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        profileProvider.profile!.name,
                        style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        profileProvider.profile!.email,
                        style: const TextStyle(color: Colors.white70, fontSize: 16),
                      ),
                      if (profileProvider.profile!.phoneNumber.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          profileProvider.profile!.phoneNumber,
                          style: const TextStyle(color: Colors.white54, fontSize: 14),
                        ),
                      ],
                      const SizedBox(height: 32),
                      Container(
                        decoration: BoxDecoration(
                          color: const Color(0xFF1E293B),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Column(
                          children: [
                            _buildMenuItem(icon: Icons.person_outline, title: 'Edit Profile', onTap: _openEditProfile),
                            const Divider(color: Colors.white10, height: 1),
                            _buildMenuItem(
                              icon: Icons.location_on_outlined,
                              title: 'Delivery Addresses',
                              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AddressesScreen())),
                            ),
                            const Divider(color: Colors.white10, height: 1),
                            _buildMenuItem(
                              icon: Icons.event_busy_outlined,
                              title: 'Item expirations',
                              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ExpirationsScreen())),
                            ),
                            const Divider(color: Colors.white10, height: 1),
                            _buildMenuItem(
                              icon: Icons.chat_bubble_outline,
                              title: 'Messages',
                              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ChatSessionsScreen())),
                            ),
                            const Divider(color: Colors.white10, height: 1),
                            _buildMenuItem(
                              icon: Icons.support_agent,
                              title: 'Support',
                              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SupportScreen())),
                            ),
                            const Divider(color: Colors.white10, height: 1),
                            _buildMenuItem(
                              icon: Icons.notifications_active_outlined,
                              title: 'Notification preferences',
                              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const NotificationPreferencesScreen())),
                            ),
                            const Divider(color: Colors.white10, height: 1),
                            _buildMenuItem(
                              icon: Icons.shield_outlined,
                              title: 'Privacy & Security',
                              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const UpdatePasswordScreen())),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),
                      SizedBox(
                        width: double.infinity,
                        height: 56,
                        child: OutlinedButton.icon(
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Colors.redAccent,
                            side: const BorderSide(color: Colors.redAccent),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          icon: const Icon(Icons.logout),
                          label: const Text('Log Out', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                          onPressed: () async {
                            await authProvider.logout();
                            if (context.mounted) {
                              Navigator.of(context).pushAndRemoveUntil(
                                MaterialPageRoute(builder: (_) => const LoginScreen()),
                                (route) => false,
                              );
                            }
                          },
                        ),
                      ),
                    ],
                  ),
                ),
    );
  }

  Widget _buildMenuItem({required IconData icon, required String title, required VoidCallback onTap}) {
    return ListTile(
      leading: Icon(icon, color: const Color(0xFF6C63FF)),
      title: Text(title, style: const TextStyle(color: Colors.white, fontSize: 16)),
      trailing: const Icon(Icons.chevron_right, color: Colors.white54),
      onTap: onTap,
    );
  }
}
