import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/models/vendor_notification_model.dart';
import '../../core/providers/vendor_home_provider.dart';
import '../../core/providers/vendor_profile_provider.dart';
import '../../core/theme.dart';
import '../../core/utils/vendor_notification_utils.dart';
import '../../core/utils/vendor_notification_route.dart';
import '../inventory/inventory_screen.dart';
import '../onboarding/onboarding_screen.dart';
import '../orders/expirations_screen.dart';
import '../products/listing_type_picker_screen.dart';
import '../products/products_screen.dart';
import '../service_areas/service_areas_screen.dart';

typedef HomeTabNavigate = void Function(
  int tabIndex, {
  String? ordersStatusFilter,
});

class HomeScreen extends StatefulWidget {
  final HomeTabNavigate? onNavigateTab;
  final ValueChanged<bool>? onSupportFabVisibilityChanged;

  const HomeScreen({
    super.key,
    this.onNavigateTab,
    this.onSupportFabVisibilityChanged,
  });

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final ScrollController _scrollController = ScrollController();
  bool _supportFabVisible = true;
  double _lastScrollOffset = 0;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_handleScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _scrollController.removeListener(_handleScroll);
    _scrollController.dispose();
    super.dispose();
  }

  void _handleScroll() {
    if (!_scrollController.hasClients) return;
    final offset = _scrollController.offset;
    if (offset <= 0) {
      _setSupportFabVisible(true);
      _lastScrollOffset = offset;
      return;
    }
    final delta = offset - _lastScrollOffset;
    if (delta > 8) {
      _setSupportFabVisible(false);
    } else if (delta < -8) {
      _setSupportFabVisible(true);
    }
    _lastScrollOffset = offset;
  }

  void _setSupportFabVisible(bool visible) {
    if (_supportFabVisible == visible) return;
    _supportFabVisible = visible;
    widget.onSupportFabVisibilityChanged?.call(visible);
  }

  Future<void> _load() async {
    final vendorId =
        Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    await Provider.of<VendorHomeProvider>(context, listen: false)
        .loadDashboard(vendorId);
  }

  void _push(Widget screen) {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));
  }

  Future<void> _openAddListing() async {
    final result = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const ListingTypePickerScreen()),
    );
    if (!mounted) return;
    if (result != null) {
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Listing saved')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final home = Provider.of<VendorHomeProvider>(context);
    final pending = Provider.of<VendorProfileProvider>(context).isPending;
    final name = home.businessName.isNotEmpty ? home.businessName : 'Vendor';
    final isInitialLoad =
        home.loading && home.totalListings == 0 && home.recentActivity.isEmpty;

    return RefreshIndicator(
      color: AppTheme.accent,
      onRefresh: _load,
      child: isInitialLoad
          ? const _DashboardSkeleton()
          : ListView(
              controller: _scrollController,
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 108),
              children: [
                _HeroHeader(
                  businessName: name,
                  isPending: pending,
                  onAddListing: pending ? null : _openAddListing,
                  onViewInventory: () => _push(const InventoryScreen()),
                ),
                const SizedBox(height: 16),
                _VerificationBanner(
                  isVerified: home.isVerified,
                  message: home.verificationMessage,
                  onManage: () => _push(const OnboardingScreen()),
                ),
                const SizedBox(height: 20),
                _SectionHeader(
                  title: 'Catalog overview',
                  actionLabel: 'All products',
                  onAction: () => _push(const ProductsScreen()),
                ),
                const SizedBox(height: 10),
                _StatGrid(
                  children: [
                    _StatTile(
                      label: 'Total listings',
                      value: home.totalListings,
                      icon: Icons.inventory_2_outlined,
                      accent: AppTheme.accent,
                      onTap: () => _push(const ProductsScreen()),
                    ),
                    _StatTile(
                      label: 'Active listings',
                      value: home.activeListings,
                      icon: Icons.check_circle_outline,
                      accent: const Color(0xFF34D399),
                      onTap: () => _push(
                        const ProductsScreen(initialStatusFilter: 'active'),
                      ),
                    ),
                    _StatTile(
                      label: 'Inventory units',
                      value: home.inventoryUnits,
                      icon: Icons.warehouse_outlined,
                      accent: const Color(0xFF38BDF8),
                      onTap: () => _push(const InventoryScreen()),
                    ),
                    _StatTile(
                      label: 'Unread alerts',
                      value: home.unreadNotifications,
                      icon: Icons.notifications_active_outlined,
                      accent: const Color(0xFFFBBF24),
                      onTap: () => widget.onNavigateTab?.call(3),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                _SectionHeader(
                  title: 'Order operations',
                  actionLabel: 'View orders',
                  onAction: () => widget.onNavigateTab?.call(2),
                ),
                const SizedBox(height: 10),
                _StatGrid(
                  children: [
                    _StatTile(
                      label: 'Pending requests',
                      value: home.pendingRequests,
                      icon: Icons.assignment_outlined,
                      accent: const Color(0xFFF59E0B),
                      onTap: () => widget.onNavigateTab?.call(1),
                    ),
                    _StatTile(
                      label: 'Confirmed',
                      value: home.confirmedOrders,
                      icon: Icons.shopping_bag_outlined,
                      accent: const Color(0xFF34D399),
                      onTap: () => widget.onNavigateTab?.call(
                        2,
                        ordersStatusFilter: 'confirmed',
                      ),
                    ),
                    _StatTile(
                      label: 'In transit',
                      value: home.inTransitOrders,
                      icon: Icons.local_shipping_outlined,
                      accent: const Color(0xFF60A5FA),
                      onTap: () => widget.onNavigateTab?.call(
                        2,
                        ordersStatusFilter: 'in_transit',
                      ),
                    ),
                    _StatTile(
                      label: 'Due in 7 days',
                      value: home.dueReturns,
                      icon: Icons.timer_outlined,
                      accent: const Color(0xFFFB7185),
                      onTap: () => _push(const ExpirationsScreen()),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                _SectionHeader(
                  title: 'Quick actions',
                  actionLabel: pending ? null : 'Add listing',
                  onAction: pending ? null : _openAddListing,
                ),
                const SizedBox(height: 10),
                _QuickActionsPanel(
                  actions: [
                    _QuickAction(
                      label: 'Products',
                      subtitle: 'Manage listings',
                      icon: Icons.storefront_outlined,
                      color: AppTheme.accent,
                      onTap: () => _push(const ProductsScreen()),
                    ),
                    _QuickAction(
                      label: 'Inventory',
                      subtitle: 'Stock & serials',
                      icon: Icons.qr_code_2_outlined,
                      color: const Color(0xFF38BDF8),
                      onTap: () => _push(const InventoryScreen()),
                    ),
                    _QuickAction(
                      label: 'Service areas',
                      subtitle: 'Coverage zones',
                      icon: Icons.map_outlined,
                      color: const Color(0xFF34D399),
                      onTap: () => _push(const ServiceAreasScreen()),
                    ),
                    _QuickAction(
                      label: 'Onboarding',
                      subtitle: 'Verify account',
                      icon: Icons.verified_user_outlined,
                      color: const Color(0xFFFBBF24),
                      onTap: () => _push(const OnboardingScreen()),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                _SectionHeader(
                  title: 'Recent activity',
                  actionLabel: 'View all',
                  onAction: () => widget.onNavigateTab?.call(3),
                ),
                const SizedBox(height: 10),
                _RecentActivityCard(
                  items: home.recentActivity,
                  onItemTap: (notification) =>
                      navigateForVendorNotification(context, notification),
                  onViewAll: () => widget.onNavigateTab?.call(3),
                ),
                const SizedBox(height: 24),
                _SectionHeader(
                  title: 'Top listings',
                  actionLabel: 'See all',
                  onAction: () => _push(const ProductsScreen()),
                ),
                const SizedBox(height: 10),
                _TopListingsCard(
                  listings: home.topListings,
                  onTapListing: () => _push(const ProductsScreen()),
                ),
                if (home.error != null) ...[
                  const SizedBox(height: 16),
                  Text(
                    home.error!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.redAccent, fontSize: 13),
                  ),
                ],
              ],
            ),
    );
  }
}

class _HeroHeader extends StatelessWidget {
  final String businessName;
  final bool isPending;
  final VoidCallback? onAddListing;
  final VoidCallback onViewInventory;

  const _HeroHeader({
    required this.businessName,
    required this.isPending,
    required this.onAddListing,
    required this.onViewInventory,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            colors.primarySoft,
            colors.surface,
            colors.surfaceElevated.withValues(alpha: 0.65),
          ],
        ),
        border: Border.all(color: colors.accent.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: colors.accent.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(Icons.store_rounded, color: colors.accent, size: 24),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Welcome back',
                      style: TextStyle(
                        color: colors.textMuted,
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      businessName,
                      style: TextStyle(
                        color: colors.textPrimary,
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        height: 1.15,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      isPending
                          ? 'Your account is under review — explore while we verify.'
                          : "Here's what's happening with your rentals today.",
                      style: TextStyle(
                        color: colors.textSecondary,
                        fontSize: 13,
                        height: 1.35,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: onViewInventory,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: colors.textPrimary,
                    side: BorderSide(color: colors.border),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text('View inventory'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: onAddListing,
                  icon: const Icon(Icons.add, size: 18),
                  label: const Text('Add listing'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: colors.accent,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: colors.surfaceElevated,
                    disabledForegroundColor: colors.textMuted,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _VerificationBanner extends StatelessWidget {
  final bool isVerified;
  final String message;
  final VoidCallback onManage;

  const _VerificationBanner({
    required this.isVerified,
    required this.message,
    required this.onManage,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final color = isVerified ? const Color(0xFF34D399) : const Color(0xFFFBBF24);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.28)),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              isVerified ? Icons.verified_rounded : Icons.info_outline_rounded,
              color: color,
              size: 22,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isVerified ? 'Account verified' : 'Verification in progress',
                  style: TextStyle(
                    color: color,
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  message,
                  style: TextStyle(
                    color: colors.textSecondary,
                    fontSize: 12,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
          TextButton(
            onPressed: onManage,
            style: TextButton.styleFrom(
              foregroundColor: color,
              padding: const EdgeInsets.symmetric(horizontal: 10),
            ),
            child: const Text('Manage'),
          ),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  const _SectionHeader({
    required this.title,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: TextStyle(
              color: colors.textPrimary,
              fontWeight: FontWeight.w700,
              fontSize: 17,
              letterSpacing: -0.2,
            ),
          ),
        ),
        if (actionLabel != null && onAction != null)
          TextButton(
            onPressed: onAction,
            style: TextButton.styleFrom(
              foregroundColor: AppTheme.accent,
              padding: const EdgeInsets.symmetric(horizontal: 8),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: Text(actionLabel!),
          ),
      ],
    );
  }
}

class _StatGrid extends StatelessWidget {
  final List<_StatTile> children;

  const _StatGrid({required this.children});

  double _tileHeight(double maxWidth) {
    final cellWidth = (maxWidth - 10) / 2;
    // Fixed row height — include buffer for web font metrics on narrow widths.
    if (cellWidth < 150) return 126;
    if (cellWidth < 170) return 118;
    return 112;
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        return GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio:
              (constraints.maxWidth - 10) / 2 / _tileHeight(constraints.maxWidth),
          children: children,
        );
      },
    );
  }
}

class _StatTile extends StatelessWidget {
  final String label;
  final int value;
  final IconData icon;
  final Color accent;
  final VoidCallback onTap;

  const _StatTile({
    required this.label,
    required this.value,
    required this.icon,
    required this.accent,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Material(
      color: AppTheme.card(context),
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Ink(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: colors.border.withValues(alpha: 0.7)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: accent.withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(icon, color: accent, size: 19),
                  ),
                  const Spacer(),
                  Icon(
                    Icons.arrow_outward_rounded,
                    size: 15,
                    color: colors.textMuted,
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                '$value',
                style: TextStyle(
                  color: colors.textPrimary,
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  height: 1,
                ),
              ),
              const SizedBox(height: 2),
              Flexible(
                child: Text(
                  label,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: colors.textSecondary,
                    fontSize: 11,
                    height: 1.15,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _QuickAction {
  final String label;
  final String subtitle;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  const _QuickAction({
    required this.label,
    required this.subtitle,
    required this.icon,
    required this.color,
    required this.onTap,
  });
}

class _QuickActionsPanel extends StatelessWidget {
  final List<_QuickAction> actions;

  const _QuickActionsPanel({required this.actions});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final cellWidth = (constraints.maxWidth - 10) / 2;
        final tileHeight = cellWidth < 150 ? 100.0 : 92.0;

        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            mainAxisExtent: tileHeight,
          ),
          itemCount: actions.length,
          itemBuilder: (context, index) {
            final action = actions[index];
            final colors = context.appColors;
            return Material(
              color: AppTheme.card(context),
              borderRadius: BorderRadius.circular(16),
              child: InkWell(
                borderRadius: BorderRadius.circular(16),
                onTap: action.onTap,
                child: Ink(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: colors.border.withValues(alpha: 0.7)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: action.color.withValues(alpha: 0.14),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Icon(action.icon, color: action.color, size: 20),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              action.label,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: colors.textPrimary,
                                fontWeight: FontWeight.w700,
                                fontSize: 14,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              action.subtitle,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: colors.textMuted,
                                fontSize: 11,
                                height: 1.2,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }
}

class _RecentActivityCard extends StatelessWidget {
  final List<VendorNotification> items;
  final ValueChanged<VendorNotification> onItemTap;
  final VoidCallback onViewAll;

  const _RecentActivityCard({
    required this.items,
    required this.onItemTap,
    required this.onViewAll,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.card(context),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.border.withValues(alpha: 0.7)),
      ),
      child: items.isEmpty
          ? Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  Icon(Icons.notifications_none_rounded,
                      size: 36, color: colors.textMuted.withValues(alpha: 0.5)),
                  const SizedBox(height: 10),
                  Text(
                    'No recent notifications',
                    style: TextStyle(color: colors.textMuted),
                  ),
                ],
              ),
            )
          : Column(
              children: [
                for (var i = 0; i < items.length; i++) ...[
                  _ActivityTile(
                    notification: items[i],
                    onTap: () => onItemTap(items[i]),
                  ),
                  if (i < items.length - 1)
                    Divider(
                      height: 1,
                      indent: 56,
                      color: colors.border.withValues(alpha: 0.5),
                    ),
                ],
                Divider(height: 1, color: colors.border.withValues(alpha: 0.5)),
                TextButton(
                  onPressed: onViewAll,
                  child: const Text('View all alerts'),
                ),
              ],
            ),
    );
  }
}

class _ActivityTile extends StatelessWidget {
  final VendorNotification notification;
  final VoidCallback onTap;

  const _ActivityTile({required this.notification, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final style = _activityStyle(notification.notificationType);
    final headline = _activityHeadline(notification);
    final meta = _activityMeta(notification);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: style.color.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(style.icon, color: style.color, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      headline,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: notification.isUnread
                            ? colors.textPrimary
                            : colors.textSecondary,
                        fontWeight: notification.isUnread
                            ? FontWeight.w700
                            : FontWeight.w600,
                        fontSize: 14,
                        height: 1.3,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      meta,
                      style: TextStyle(
                        color: colors.textMuted,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              if (notification.isUnread)
                Container(
                  width: 8,
                  height: 8,
                  margin: const EdgeInsets.only(top: 6, left: 8),
                  decoration: const BoxDecoration(
                    color: AppTheme.accent,
                    shape: BoxShape.circle,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TopListingsCard extends StatelessWidget {
  final List<DashboardTopListing> listings;
  final VoidCallback onTapListing;

  const _TopListingsCard({
    required this.listings,
    required this.onTapListing,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    if (listings.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: AppTheme.card(context),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: colors.border.withValues(alpha: 0.7)),
        ),
        child: Column(
          children: [
            Icon(Icons.inventory_2_outlined,
                size: 36, color: colors.textMuted.withValues(alpha: 0.5)),
            const SizedBox(height: 10),
            Text(
              'No listings yet',
              style: TextStyle(color: colors.textMuted),
            ),
          ],
        ),
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: AppTheme.card(context),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.border.withValues(alpha: 0.7)),
      ),
      child: Column(
        children: [
          for (var i = 0; i < listings.length; i++) ...[
            _TopListingRow(
              rank: i + 1,
              listing: listings[i],
              onTap: onTapListing,
            ),
            if (i < listings.length - 1)
              Divider(
                height: 1,
                indent: 56,
                color: colors.border.withValues(alpha: 0.5),
              ),
          ],
        ],
      ),
    );
  }
}

class _TopListingRow extends StatelessWidget {
  final int rank;
  final DashboardTopListing listing;
  final VoidCallback onTap;

  const _TopListingRow({
    required this.rank,
    required this.listing,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final priceLabel = listing.weeklyRent > 0 || listing.monthlyRent > 0
        ? '₹${listing.weeklyRent.toStringAsFixed(0)}/w · ₹${listing.monthlyRent.toStringAsFixed(0)}/mo · Stock ${listing.stock}'
        : (listing.dailyRent > 0
            ? '₹${listing.dailyRent.toStringAsFixed(0)}/day · Stock ${listing.stock}'
            : 'Stock ${listing.stock}');

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          child: Row(
            children: [
              Container(
                width: 32,
                height: 32,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: AppTheme.accent.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '$rank',
                  style: const TextStyle(
                    color: AppTheme.accent,
                    fontWeight: FontWeight.w800,
                    fontSize: 13,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      listing.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: colors.textPrimary,
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '${listing.category} · ${listing.stock} units',
                      style: TextStyle(
                        color: colors.textMuted,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Text(
                priceLabel,
                style: const TextStyle(
                  color: AppTheme.accent,
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DashboardSkeleton extends StatelessWidget {
  const _DashboardSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 108),
      children: [
        _SkeletonBox(height: 168, radius: 20),
        const SizedBox(height: 16),
        _SkeletonBox(height: 88, radius: 16),
        const SizedBox(height: 20),
        _SkeletonBox(height: 18, width: 140, radius: 6),
        const SizedBox(height: 10),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio: 1.45,
          children: List.generate(4, (_) => _SkeletonBox(height: 100, radius: 16)),
        ),
        const SizedBox(height: 24),
        _SkeletonBox(height: 220, radius: 16),
      ],
    );
  }
}

class _SkeletonBox extends StatelessWidget {
  final double height;
  final double? width;
  final double radius;

  const _SkeletonBox({
    required this.height,
    this.width,
    this.radius = 12,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: AppTheme.card(context),
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: colors.border.withValues(alpha: 0.5)),
      ),
    );
  }
}

class _ActivityVisual {
  final IconData icon;
  final Color color;

  const _ActivityVisual(this.icon, this.color);
}

_ActivityVisual _activityStyle(String type) {
  final t = type.toLowerCase();
  if (t.contains('order') || t.contains('dispatch')) {
    return const _ActivityVisual(Icons.shopping_bag_outlined, Color(0xFF60A5FA));
  }
  if (t.contains('stock') || t.contains('inventory')) {
    return const _ActivityVisual(Icons.inventory_2_outlined, Color(0xFFFBBF24));
  }
  if (t.contains('document') || t.contains('bank') || t.contains('vendor_')) {
    return const _ActivityVisual(Icons.verified_user_outlined, Color(0xFF34D399));
  }
  if (t.contains('expir') || t.contains('return')) {
    return const _ActivityVisual(Icons.timer_outlined, Color(0xFFFB7185));
  }
  return const _ActivityVisual(Icons.notifications_outlined, AppTheme.accent);
}

String _activityHeadline(VendorNotification n) {
  final message = cleanNotificationMessage(n.message);
  if (message.isNotEmpty) return message;

  final title = n.title.trim();
  if (title.isEmpty) return 'Notification';

  // Prefer human-readable part before long reference IDs.
  final parts = title.split(RegExp(r'\s+'));
  if (parts.length > 4 && parts.any((p) => p.contains('-'))) {
    return parts.take(3).join(' ');
  }
  return title;
}

String _activityMeta(VendorNotification n) {
  final typeLabel = _formatNotificationType(n.notificationType);
  final time = _relativeTime(n.sentAt);
  if (time.isEmpty) return typeLabel;
  return '$typeLabel · $time';
}

String _formatNotificationType(String raw) {
  if (raw.trim().isEmpty) return 'Update';
  return raw
      .replaceAll('_', ' ')
      .split(' ')
      .where((w) => w.isNotEmpty)
      .map((w) => '${w[0].toUpperCase()}${w.substring(1)}')
      .join(' ');
}

String _relativeTime(DateTime? dt) {
  if (dt == null) return '';
  final now = DateTime.now();
  final local = dt.toLocal();
  final diff = now.difference(local);
  if (diff.inMinutes < 1) return 'Just now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
  if (diff.inHours < 24) return '${diff.inHours}h ago';
  if (diff.inDays == 1) return 'Yesterday';
  if (diff.inDays < 7) return '${diff.inDays}d ago';
  return '${local.day}/${local.month}/${local.year}';
}
