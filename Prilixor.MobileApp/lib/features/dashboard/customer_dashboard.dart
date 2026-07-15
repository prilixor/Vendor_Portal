import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'home_screen.dart';

import '../orders/orders_screen.dart';
import '../notifications/notifications_screen.dart';
import '../profile/profile_screen.dart';
import '../cart/cart_screen.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/providers/cart_provider.dart';
import '../../core/providers/notification_provider.dart';
import '../../core/providers/order_provider.dart';

class CustomerDashboard extends StatefulWidget {
  const CustomerDashboard({super.key});

  @override
  State<CustomerDashboard> createState() => _CustomerDashboardState();
}

class _CustomerDashboardState extends State<CustomerDashboard> with WidgetsBindingObserver {
  int _currentIndex = 0;
  Timer? _pollTimer;

  static const _ordersTab = 2;
  static const _alertsTab = 3;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _refreshLiveData(silent: false);
    });

    // Keep order statuses + alert badge in sync while the app is open.
    _pollTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      if (mounted) _refreshLiveData(silent: true);
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _pollTimer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && mounted) {
      _refreshLiveData(silent: true);
    }
  }

  bool get _isLoggedIn =>
      Provider.of<AuthProvider>(context, listen: false).isAuthenticated;

  Future<void> _refreshLiveData({required bool silent}) async {
    // Guest "Browse catalog" has no JWT — skip auth-only APIs to avoid 401 noise.
    if (!_isLoggedIn) return;
    final orders = Provider.of<OrderProvider>(context, listen: false);
    final notifs = Provider.of<NotificationProvider>(context, listen: false);
    await Future.wait([
      orders.fetchOrders(silent: silent),
      notifs.fetchNotifications(silent: silent),
    ]);
  }

  void _onTabTapped(int index) {
    setState(() => _currentIndex = index);
    if (!_isLoggedIn) return;
    // IndexedStack keeps tabs alive — re-fetch when opening Orders / Alerts.
    if (index == _ordersTab) {
      Provider.of<OrderProvider>(context, listen: false).fetchOrders(silent: true);
      Provider.of<NotificationProvider>(context, listen: false).fetchNotifications(silent: true);
    } else if (index == _alertsTab) {
      Provider.of<NotificationProvider>(context, listen: false).fetchNotifications(silent: true);
      Provider.of<OrderProvider>(context, listen: false).fetchOrders(silent: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final List<Widget> screens = [
      const HomeScreen(),
      CartScreen(onContinueShopping: () {
        setState(() {
          _currentIndex = 0;
        });
      }),
      const OrdersScreen(),
      const NotificationsScreen(),
      const ProfileScreen(),
    ];

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: IndexedStack(
        index: _currentIndex,
        children: screens,
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: _onTabTapped,
        backgroundColor: const Color(0xFF1E293B),
        selectedItemColor: const Color(0xFF6C63FF),
        unselectedItemColor: Colors.white54,
        type: BottomNavigationBarType.fixed,
        items: [
          const BottomNavigationBarItem(icon: Icon(Icons.search), label: 'Discover'),
          BottomNavigationBarItem(
            icon: Consumer<CartProvider>(
              builder: (context, cart, child) {
                return _NavBadgeIcon(
                  icon: Icons.shopping_cart_outlined,
                  count: cart.lines.length,
                  badgeColor: const Color(0xFF6C63FF),
                );
              },
            ),
            label: 'Cart',
          ),
          const BottomNavigationBarItem(icon: Icon(Icons.shopping_bag_outlined), label: 'Orders'),
          BottomNavigationBarItem(
            icon: Consumer<NotificationProvider>(
              builder: (context, notif, child) {
                return _NavBadgeIcon(
                  icon: Icons.notifications_none,
                  count: notif.unreadCount,
                  badgeColor: Colors.redAccent,
                );
              },
            ),
            label: 'Alerts',
          ),
          const BottomNavigationBarItem(icon: Icon(Icons.person_outline), label: 'Profile'),
        ],
      ),
    );
  }
}

/// Stable badge overlay for bottom-nav icons (Material Badge floats too high on web).
class _NavBadgeIcon extends StatelessWidget {
  final IconData icon;
  final int count;
  final Color badgeColor;

  const _NavBadgeIcon({
    required this.icon,
    required this.count,
    required this.badgeColor,
  });

  @override
  Widget build(BuildContext context) {
    final label = count > 99 ? '99+' : '$count';
    return SizedBox(
      width: 28,
      height: 28,
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.center,
        children: [
          Icon(icon),
          if (count > 0)
            Positioned(
              right: -10,
              top: -4,
              child: Container(
                constraints: const BoxConstraints(minWidth: 18, minHeight: 16),
                padding: EdgeInsets.symmetric(horizontal: count > 9 ? 4 : 5, vertical: 1),
                decoration: BoxDecoration(
                  color: badgeColor,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: const Color(0xFF1E293B), width: 1.5),
                ),
                alignment: Alignment.center,
                child: Text(
                  label,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    height: 1.1,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
