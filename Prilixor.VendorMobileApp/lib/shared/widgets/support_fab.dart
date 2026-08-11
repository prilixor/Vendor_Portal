import 'package:flutter/material.dart';

import '../../features/support/support_chat_screen.dart';

/// Floating support button — mirrors Vendor Web SupportChat launcher.
///
/// Shown only on the Home tab (see [VendorDashboard]) so list screens
/// (Alerts, Orders, Requests) stay unobstructed. Full access remains under
/// Profile → BlinksMed Support.
class SupportFab extends StatelessWidget {
  final int unreadCount;

  const SupportFab({super.key, this.unreadCount = 0});

  @override
  Widget build(BuildContext context) {
    final showBadge = unreadCount > 0;
    final badgeLabel = unreadCount > 9 ? '9+' : '$unreadCount';

    return Padding(
      padding: const EdgeInsets.only(bottom: 8, right: 4),
      child: FloatingActionButton(
        onPressed: () {
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => SupportChatScreen(
                openTicketsInitially: showBadge,
              ),
            ),
          );
        },
        backgroundColor: const Color(0xFF6C63FF),
        tooltip: showBadge
            ? '$unreadCount support ${unreadCount == 1 ? 'reply' : 'replies'}'
            : 'BlinksMed Support',
        child: Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.center,
          children: [
            const Icon(Icons.support_agent_rounded, size: 28),
            if (showBadge)
              Positioned(
                top: -2,
                right: -2,
                child: Container(
                  constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE53935),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFF6C63FF), width: 1.5),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    badgeLabel,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      height: 1,
                    ),
                  ),
                ),
              )
            else
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
