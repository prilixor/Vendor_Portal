import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/providers/vendor_notification_provider.dart';
import '../../core/providers/vendor_onboarding_provider.dart';
import '../../core/providers/vendor_order_provider.dart';
import '../../core/providers/vendor_profile_provider.dart';
import '../../core/providers/vendor_support_provider.dart';
import '../../shared/widgets/pending_approval_banner.dart';
import '../../shared/widgets/support_fab.dart';
import '../../shared/widgets/vendor_app_bar_badge.dart';
import '../../shared/widgets/vendor_doctor_lookup_sheet.dart';
import '../home/home_screen.dart';
import '../notifications/notifications_screen.dart';
import '../orders/order_requests_screen.dart';
import '../orders/orders_screen.dart';
import '../profile/profile_screen.dart';

class VendorDashboard extends StatefulWidget {
  const VendorDashboard({super.key});

  @override
  State<VendorDashboard> createState() => _VendorDashboardState();
}

class _VendorDashboardState extends State<VendorDashboard>
    with WidgetsBindingObserver {
  int _index = 0;
  Timer? _pollTimer;
  String? _ordersStatusFilter;
  bool _homeSupportFabVisible = true;
  bool _refreshInFlight = false;
  bool _paused = false;

  static const _titles = [
    'Dashboard',
    'Order Requests',
    'Orders',
    'Alerts',
    'Profile',
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _refreshAll(silent: true);
      _startPolling();
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
    switch (state) {
      case AppLifecycleState.resumed:
        _paused = false;
        _startPolling();
        // Light silent refresh after returning from another app — avoid stampede.
        _refreshAll(silent: true);
        break;
      case AppLifecycleState.inactive:
      case AppLifecycleState.paused:
      case AppLifecycleState.hidden:
      case AppLifecycleState.detached:
        _paused = true;
        _pollTimer?.cancel();
        _pollTimer = null;
        break;
    }
  }

  void _startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (!mounted || _paused) return;
      _refreshAll(silent: true);
    });
  }

  Future<void> _refreshAll({bool silent = true}) async {
    if (_refreshInFlight || !mounted) return;
    _refreshInFlight = true;
    try {
      final vendorId =
          Provider.of<AuthProvider>(context, listen: false).vendorId;
      if (vendorId == null || vendorId.isEmpty) return;

      final orders = Provider.of<VendorOrderProvider>(context, listen: false);
      final alerts =
          Provider.of<VendorNotificationProvider>(context, listen: false);
      final profile =
          Provider.of<VendorProfileProvider>(context, listen: false);
      final support =
          Provider.of<VendorSupportProvider>(context, listen: false);
      final onboarding =
          Provider.of<VendorOnboardingProvider>(context, listen: false);

      await Future.wait([
        orders.fetchOffers(vendorId, silent: silent),
        orders.fetchOrders(vendorId, silent: silent),
        alerts.fetchNotifications(vendorId, silent: silent),
        profile.fetchStatus(vendorId, silent: silent),
        support.refreshUnreadAdminReplyCount(vendorId),
        onboarding.loadAll(vendorId),
      ]);
    } catch (_) {
      // Never crash the shell on background poll / resume refresh failures.
    } finally {
      _refreshInFlight = false;
    }
  }

  void _goToTab(int index, {String? ordersStatusFilter}) {
    if (index < 0 || index > 4) return;
    setState(() {
      _index = index;
      _ordersStatusFilter = index == 2 ? ordersStatusFilter : null;
      if (index == 0) _homeSupportFabVisible = true;
    });
  }

  void _onHomeSupportFabVisibility(bool visible) {
    if (_index != 0 || _homeSupportFabVisible == visible) return;
    setState(() => _homeSupportFabVisible = visible);
  }

  @override
  Widget build(BuildContext context) {
    final pendingCount =
        Provider.of<VendorOrderProvider>(context).pendingOffers.length;
    final unread =
        Provider.of<VendorNotificationProvider>(context).unreadCount;
    final supportUnread =
        Provider.of<VendorSupportProvider>(context).unreadAdminReplyCount;

    return Scaffold(
      appBar: AppBar(
        centerTitle: true,
        title: Text(_titles[_index]),
        actions: [
          IconButton(
            tooltip: 'Find doctor by Unique ID',
            icon: const Icon(Icons.medical_services_outlined),
            onPressed: () => showVendorDoctorLookupSheet(context),
          ),
          const VendorAppBarBadge(),
        ],
      ),
      floatingActionButton: _index == 0
          ? AnimatedSlide(
              duration: const Duration(milliseconds: 220),
              curve: Curves.easeOutCubic,
              offset: _homeSupportFabVisible ? Offset.zero : const Offset(0, 1.4),
              child: IgnorePointer(
                ignoring: !_homeSupportFabVisible,
                child: AnimatedOpacity(
                  duration: const Duration(milliseconds: 220),
                  opacity: _homeSupportFabVisible ? 1 : 0,
                  child: const Padding(
                    padding: EdgeInsets.only(bottom: 64),
                    child: SupportFab(),
                  ),
                ),
              ),
            )
          : null,
      floatingActionButtonLocation: FloatingActionButtonLocation.endFloat,
      body: Column(
        children: [
          const PendingApprovalBanner(),
          Expanded(
            child: IndexedStack(
              index: _index,
              children: [
                HomeScreen(
                  onNavigateTab: _goToTab,
                  onSupportFabVisibilityChanged: _onHomeSupportFabVisibility,
                ),
                const OrderRequestsScreen(),
                OrdersScreen(
                  key: ValueKey('orders-${_ordersStatusFilter ?? 'all'}'),
                  initialStatusFilter: _ordersStatusFilter,
                ),
                const NotificationsScreen(),
                const ProfileScreen(),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() {
          _index = i;
          _ordersStatusFilter = null;
          if (i == 0) _homeSupportFabVisible = true;
        }),
        destinations: [
          const NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: pendingCount > 0,
              label: Text('$pendingCount'),
              child: const Icon(Icons.assignment_outlined),
            ),
            selectedIcon: Badge(
              isLabelVisible: pendingCount > 0,
              label: Text('$pendingCount'),
              child: const Icon(Icons.assignment_turned_in),
            ),
            label: 'Requests',
          ),
          const NavigationDestination(
            icon: Icon(Icons.shopping_bag_outlined),
            selectedIcon: Icon(Icons.shopping_bag),
            label: 'Orders',
          ),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: unread > 0,
              label: Text('$unread'),
              child: const Icon(Icons.notifications_none),
            ),
            selectedIcon: Badge(
              isLabelVisible: unread > 0,
              label: Text('$unread'),
              child: const Icon(Icons.notifications),
            ),
            label: 'Alerts',
          ),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: supportUnread > 0,
              label: Text('$supportUnread'),
              child: const Icon(Icons.person_outline),
            ),
            selectedIcon: Badge(
              isLabelVisible: supportUnread > 0,
              label: Text('$supportUnread'),
              child: const Icon(Icons.person),
            ),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}
