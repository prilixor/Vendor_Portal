import 'package:flutter/material.dart';

import '../../features/support/support_chat_screen.dart';

/// Floating support button — mirrors Vendor Web SupportChat launcher.
///
/// Shown only on the Home tab (see [VendorDashboard]) so list screens
/// (Alerts, Orders, Requests) stay unobstructed. Full access remains under
/// Profile → Prilixor Support.
class SupportFab extends StatelessWidget {
  const SupportFab({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8, right: 4),
      child: FloatingActionButton(
        onPressed: () {
          Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const SupportChatScreen()),
          );
        },
        backgroundColor: const Color(0xFF6C63FF),
        tooltip: 'Prilixor Support',
        child: Stack(
          alignment: Alignment.center,
          children: [
            const Icon(Icons.support_agent_rounded, size: 28),
            Positioned(
              top: 10,
              right: 10,
              child: Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                  border: Border.all(color: const Color(0xFF6C63FF), width: 1.5),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
