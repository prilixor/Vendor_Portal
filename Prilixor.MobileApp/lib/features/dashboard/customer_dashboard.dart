import 'dart:async';
import 'package:flutter/material.dart';
import 'home_screen.dart';

import '../orders/orders_screen.dart';
import '../notifications/notifications_screen.dart';
import '../profile/profile_screen.dart';
import '../cart/cart_screen.dart';
import '../../core/providers/cart_provider.dart';
import '../../core/providers/notification_provider.dart';
import '../../core/providers/order_provider.dart';
import 'package:provider/provider.dart';

class CustomerDashboard extends StatefulWidget {
  const CustomerDashboard({super.key});

  @override
  State<CustomerDashboard> createState() => _CustomerDashboardState();
}

class _CustomerDashboardState extends State<CustomerDashboard> {
  int _currentIndex = 0;
  Timer? _notificationTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<NotificationProvider>(context, listen: false).fetchNotifications();
      Provider.of<OrderProvider>(context, listen: false).fetchOrders();
    });

    _notificationTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) {
        Provider.of<NotificationProvider>(context, listen: false).fetchNotifications();
      }
    });
  }

  @override
  void dispose() {
    _notificationTimer?.cancel();
    super.dispose();
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
        onTap: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
        backgroundColor: const Color(0xFF1E293B),
        selectedItemColor: const Color(0xFF6C63FF),
        unselectedItemColor: Colors.white54,
        type: BottomNavigationBarType.fixed,
        items: [
          const BottomNavigationBarItem(icon: Icon(Icons.search), label: 'Discover'),
          BottomNavigationBarItem(
            icon: Consumer<CartProvider>(
              builder: (context, cart, child) {
                if (cart.lines.isEmpty) {
                  return const Icon(Icons.shopping_cart_outlined);
                }
                return Badge(
                  label: Text(cart.lines.length.toString()),
                  backgroundColor: const Color(0xFF6C63FF),
                  child: const Icon(Icons.shopping_cart_outlined),
                );
              },
            ),
            label: 'Cart',
          ),
          const BottomNavigationBarItem(icon: Icon(Icons.shopping_bag_outlined), label: 'Rentals'),
          BottomNavigationBarItem(
            icon: Consumer<NotificationProvider>(
              builder: (context, notif, child) {
                final unread = notif.notifications.where((n) => n.readAt == null).length;
                if (unread == 0) {
                  return const Icon(Icons.notifications_none);
                }
                return Badge(
                  label: Text(unread.toString()),
                  backgroundColor: Colors.redAccent,
                  child: const Icon(Icons.notifications_none),
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
