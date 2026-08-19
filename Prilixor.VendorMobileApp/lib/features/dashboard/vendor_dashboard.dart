import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/providers/vendor_notification_provider.dart';
import '../../core/providers/vendor_onboarding_provider.dart';
import '../../core/providers/vendor_order_provider.dart';
import '../../core/providers/vendor_profile_provider.dart';
import '../../core/providers/vendor_home_provider.dart';
import '../../core/providers/vendor_support_provider.dart';
import '../../core/utils/indian_mobile_phone.dart';
import '../../shared/widgets/pending_approval_banner.dart';
import '../../shared/widgets/phone_otp_dialog.dart';
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
  bool _secondaryPrimed = false;
  bool _isCheckingPhone = false;

  /// Lazy-mount tabs so Requests/Orders/Alerts don't fetch until first open.
  final Set<int> _builtTabs = {0};

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
      _refreshShell(silent: true, includeSecondary: true);
      _startPolling();
      _checkPhoneVerification();
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
        _refreshShell(silent: true, includeSecondary: true);
        _checkPhoneVerification();
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

  Future<void> _checkPhoneVerification() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (!auth.isAuthenticated || _isCheckingPhone) return;
    final vendorId = auth.vendorId;
    if (vendorId == null || vendorId.isEmpty) return;

    _isCheckingPhone = true;
    try {
      final profileProvider = Provider.of<VendorProfileProvider>(context, listen: false);
      if (profileProvider.profile == null) {
        await profileProvider.fetchProfile(vendorId);
      }
      if (!mounted) return;
      final profile = profileProvider.profile;
      final rawPhone = profile?.supportPhone.trim() ?? '';
      if (rawPhone.isNotEmpty && !(profile?.isPhoneVerified ?? false)) {
        final normalizedPhone = IndianMobilePhone.normalizeDigits(rawPhone);
        await PhoneOtpDialog.show(
          context,
          phone: normalizedPhone,
          role: 'vendor',
          required: true,
          title: 'Verify phone number',
          description:
              'Enter the 6-digit code sent to +91 $normalizedPhone. Verification is required to continue.',
        );
        if (mounted) {
          await profileProvider.fetchProfile(vendorId);
        }
      }
    } finally {
      _isCheckingPhone = false;
    }
  }

  void _startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (!mounted || _paused) return;
      // Poll badges only — never re-pull onboarding/orders on the timer.
      _refreshShell(silent: true, includeSecondary: false);
    });
  }

  /// Badge-critical shell refresh. Heavy work (support + onboarding) is deferred.
  Future<void> _refreshShell({
    required bool silent,
    required bool includeSecondary,
  }) async {
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

      // Critical path for nav badges + pending banner status (3 calls).
      await Future.wait([
        orders.fetchOffers(vendorId, silent: silent),
        alerts.fetchNotifications(vendorId, silent: silent),
        profile.fetchStatus(vendorId, silent: silent),
      ]);

      if (!mounted) return;
      final shouldLoadSecondary =
          includeSecondary || !_secondaryPrimed;
      if (shouldLoadSecondary) {
        _secondaryPrimed = true;
        // Don't block Home — run after badges land.
        unawaited(_refreshSecondary(vendorId));
      }
    } catch (_) {
      // Never crash the shell on background poll / resume refresh failures.
    } finally {
      _refreshInFlight = false;
    }
  }

  Future<void> _refreshSecondary(String vendorId) async {
    if (!mounted) return;
    final support =
        Provider.of<VendorSupportProvider>(context, listen: false);
    final onboarding =
        Provider.of<VendorOnboardingProvider>(context, listen: false);
    try {
      await Future.wait([
        support.refreshUnreadAdminReplyCount(
          vendorId,
          allowMessageFallback: false,
        ),
        onboarding.loadAll(vendorId, silent: true),
      ]);
    } catch (_) {}
  }

  void _goToTab(int index, {String? ordersStatusFilter}) {
    if (index < 0 || index > 4) return;
    setState(() {
      _builtTabs.add(index);
      _index = index;
      _ordersStatusFilter = index == 2 ? ordersStatusFilter : null;
      if (index == 0) _homeSupportFabVisible = true;
    });
  }

  void _onHomeSupportFabVisibility(bool visible) {
    if (_index != 0 || _homeSupportFabVisible == visible) return;
    setState(() => _homeSupportFabVisible = visible);
  }

  Widget _tabChild(int index) {
    if (!_builtTabs.contains(index)) {
      return const SizedBox.shrink();
    }
    switch (index) {
      case 0:
        return HomeScreen(
          onNavigateTab: _goToTab,
          onSupportFabVisibilityChanged: _onHomeSupportFabVisibility,
        );
      case 1:
        return OrderRequestsScreen(isActive: _index == 1);
      case 2:
        return OrdersScreen(
          key: ValueKey('orders-${_ordersStatusFilter ?? 'all'}'),
          initialStatusFilter: _ordersStatusFilter,
        );
      case 3:
        return const NotificationsScreen();
      case 4:
        return const ProfileScreen();
      default:
        return const SizedBox.shrink();
    }
  }

  @override
  Widget build(BuildContext context) {
    final pendingCount =
        Provider.of<VendorOrderProvider>(context).pendingOffers.length;
    final unread =
        Provider.of<VendorNotificationProvider>(context).unreadCount;
    final supportUnread =
        Provider.of<VendorSupportProvider>(context).unreadAdminReplyCount;
    final homeLoading =
        Provider.of<VendorHomeProvider>(context).showInitialSkeleton;
    final showHomeFab =
        _index == 0 && _homeSupportFabVisible && !homeLoading;

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
              offset: showHomeFab ? Offset.zero : const Offset(0, 1.4),
              child: IgnorePointer(
                ignoring: !showHomeFab,
                child: AnimatedOpacity(
                  duration: const Duration(milliseconds: 220),
                  opacity: showHomeFab ? 1 : 0,
                  child: SupportFab(unreadCount: supportUnread),
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
                _tabChild(0),
                _tabChild(1),
                _tabChild(2),
                _tabChild(3),
                _tabChild(4),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => _goToTab(i),
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
