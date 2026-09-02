import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/models/vendor_notification_model.dart';
import '../../core/providers/vendor_notification_provider.dart';
import '../../core/theme.dart';
import '../../core/utils/admin_comment_util.dart';
import '../../core/utils/vendor_notification_route.dart';
import '../../core/utils/vendor_notification_utils.dart';
import '../../shared/widgets/admin_comment_hint.dart';
import '../../shared/widgets/brand_page_loader.dart';

/// Vendor Alerts — modern inbox with clean card hierarchy consistent with Vendor App.
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  _InboxFilter _filter = _InboxFilter.all;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load(silent: true));
  }

  Future<void> _load({bool silent = false}) async {
    final vendorId = Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    await Provider.of<VendorNotificationProvider>(context, listen: false)
        .fetchNotifications(vendorId, silent: silent);
  }

  Future<void> _toggleRead(VendorNotification n) async {
    final vendorId = Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    final provider = Provider.of<VendorNotificationProvider>(context, listen: false);
    if (provider.isUnread(n)) {
      await provider.markAsRead(vendorId, n.id);
    } else {
      await provider.markAsUnread(vendorId, n.id);
    }
  }

  Future<void> _onTap(VendorNotification n) async {
    final vendorId = Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    final provider = Provider.of<VendorNotificationProvider>(context, listen: false);
    if (provider.isUnread(n)) {
      await provider.markAsRead(vendorId, n.id);
    }
    if (!mounted) return;
    navigateForVendorNotification(context, n);
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final provider = Provider.of<VendorNotificationProvider>(context);
    final vendorId = auth.vendorId;
    final items = provider.filteredNotifications(
      unreadOnly: _filter == _InboxFilter.unread,
    );

    return RefreshIndicator(
      color: AppTheme.accent,
      onRefresh: () => _load(),
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              child: _InboxHeader(
                unreadCount: provider.unreadCount,
                filter: _filter,
                onFilterChanged: (f) => setState(() => _filter = f),
                onMarkAllRead: vendorId == null || provider.unreadCount == 0
                    ? null
                    : () => provider.markAllAsRead(vendorId),
              ),
            ),
          ),
          if (provider.isLoading && provider.notifications.isEmpty)
            const SliverFillRemaining(
              hasScrollBody: false,
              child: BrandPageLoader(),
            )
          else if (provider.error != null && provider.notifications.isEmpty)
            SliverFillRemaining(
              hasScrollBody: false,
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text(
                    provider.error!,
                    style: const TextStyle(color: Colors.redAccent),
                    textAlign: TextAlign.center,
                  ),
                ),
              ),
            )
          else if (items.isEmpty)
            SliverFillRemaining(
              hasScrollBody: false,
              child: Builder(
                builder: (context) {
                  final colors = context.appColors;
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(32),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            width: 68,
                            height: 68,
                            decoration: BoxDecoration(
                              color: AppTheme.accent.withValues(alpha: 0.1),
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              Icons.notifications_off_outlined,
                              size: 32,
                              color: AppTheme.accent,
                            ),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            "You're all caught up",
                            style: TextStyle(
                              color: colors.textPrimary,
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            _filter == _InboxFilter.unread
                                ? 'No unread notifications right now.'
                                : 'No notifications in your inbox yet.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: colors.textMuted,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, index) {
                    final item = items[index];
                    final unread = provider.isUnread(item);
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: _NotificationCard(
                        notification: item,
                        unread: unread,
                        onTap: () => _onTap(item),
                        onToggleRead: () => _toggleRead(item),
                      ),
                    );
                  },
                  childCount: items.length,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

enum _InboxFilter { all, unread }

class _InboxHeader extends StatelessWidget {
  final int unreadCount;
  final _InboxFilter filter;
  final ValueChanged<_InboxFilter> onFilterChanged;
  final VoidCallback? onMarkAllRead;

  const _InboxHeader({
    required this.unreadCount,
    required this.filter,
    required this.onFilterChanged,
    this.onMarkAllRead,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final isDark = context.isDarkMode;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: AppTheme.card(context),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: colors.border.withValues(alpha: isDark ? 0.6 : 0.8),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.2 : 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Alerts Feed',
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                    letterSpacing: -0.2,
                  ),
                ),
                const SizedBox(height: 1),
                Text(
                  unreadCount > 0 ? '$unreadCount unread' : 'All caught up',
                  style: TextStyle(
                    color: unreadCount > 0
                        ? (isDark ? const Color(0xFFA5B4FC) : AppTheme.accent)
                        : colors.textMuted,
                    fontSize: 11.5,
                    fontWeight: unreadCount > 0 ? FontWeight.w600 : FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          _FilterChip(
            label: 'All',
            selected: filter == _InboxFilter.all,
            onTap: () => onFilterChanged(_InboxFilter.all),
          ),
          const SizedBox(width: 6),
          _FilterChip(
            label: 'Unread',
            count: unreadCount > 0 ? unreadCount : null,
            selected: filter == _InboxFilter.unread,
            onTap: () => onFilterChanged(_InboxFilter.unread),
          ),
          if (onMarkAllRead != null) ...[
            const SizedBox(width: 6),
            Material(
              color: AppTheme.accent.withValues(alpha: isDark ? 0.18 : 0.12),
              borderRadius: BorderRadius.circular(10),
              child: InkWell(
                onTap: onMarkAllRead,
                borderRadius: BorderRadius.circular(10),
                child: Tooltip(
                  message: 'Mark all as read',
                  child: const SizedBox(
                    width: 32,
                    height: 32,
                    child: Icon(
                      Icons.done_all_rounded,
                      size: 17,
                      color: AppTheme.accent,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final int? count;
  final bool selected;
  final VoidCallback onTap;

  const _FilterChip({
    required this.label,
    this.count,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final isDark = context.isDarkMode;

    return Material(
      color: selected
          ? AppTheme.accent
          : (isDark ? colors.surfaceElevated : const Color(0xFFF1F5F9)),
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: TextStyle(
                  color: selected ? Colors.white : colors.textSecondary,
                  fontSize: 12,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
                ),
              ),
              if (count != null && count! > 0) ...[
                const SizedBox(width: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                  decoration: BoxDecoration(
                    color: selected
                        ? Colors.white.withValues(alpha: 0.25)
                        : AppTheme.accent.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    '$count',
                    style: TextStyle(
                      color: selected ? Colors.white : AppTheme.accent,
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _NotificationCard extends StatelessWidget {
  final VendorNotification notification;
  final bool unread;
  final VoidCallback onTap;
  final VoidCallback onToggleRead;

  const _NotificationCard({
    required this.notification,
    required this.unread,
    required this.onTap,
    required this.onToggleRead,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final isDark = context.isDarkMode;
    final visual = visualTypeFor(notification);
    final color = colorForVisualType(visual);
    final isRejection = isVerificationRejectionNotification(
      notification.notificationType,
    );
    final adminComment = isRejection
        ? extractAdminCommentFromNotification(notification.message)
        : null;
    var body = cleanNotificationMessage(notification.message);
    if (adminComment != null) {
      body = cleanNotificationMessage(
        notificationBodyWithoutAdminReason(body),
      );
    }
    final when = formatRelativeTime(effectiveTimestamp(notification));
    final hasRoute = resolveVendorNotificationRouteFor(notification) != null;

    return Material(
      color: AppTheme.card(context),
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: unread
                  ? AppTheme.accent.withValues(alpha: isDark ? 0.45 : 0.35)
                  : colors.border.withValues(alpha: isDark ? 0.6 : 0.75),
              width: unread ? 1.2 : 1.0,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: isDark ? 0.18 : 0.025),
                blurRadius: 6,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Left Accent Stripe for Unread items
                  if (unread)
                    Container(
                      width: 4,
                      color: AppTheme.accent,
                    ),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Top row: Icon + Title + Status/Action
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                width: 38,
                                height: 38,
                                decoration: BoxDecoration(
                                  color: color.withValues(alpha: isDark ? 0.2 : 0.12),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(
                                    color: color.withValues(alpha: isDark ? 0.35 : 0.2),
                                    width: 0.8,
                                  ),
                                ),
                                child: Icon(
                                  iconForVisualType(visual),
                                  color: color,
                                  size: 19,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      notification.title,
                                      style: TextStyle(
                                        color: colors.textPrimary,
                                        fontWeight: unread ? FontWeight.w800 : FontWeight.w700,
                                        fontSize: 13.5,
                                        height: 1.25,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      when,
                                      style: TextStyle(
                                        color: colors.textMuted,
                                        fontSize: 11,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 8),
                              // Read/Unread Action Badge
                              Material(
                                color: Colors.transparent,
                                child: InkWell(
                                  onTap: onToggleRead,
                                  borderRadius: BorderRadius.circular(8),
                                  child: Padding(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        if (unread) ...[
                                          Container(
                                            width: 7,
                                            height: 7,
                                            margin: const EdgeInsets.only(right: 5),
                                            decoration: const BoxDecoration(
                                              color: AppTheme.accent,
                                              shape: BoxShape.circle,
                                            ),
                                          ),
                                          Text(
                                            'Mark read',
                                            style: TextStyle(
                                              color: isDark ? const Color(0xFFA5B4FC) : AppTheme.accent,
                                              fontSize: 11,
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                        ] else ...[
                                          Icon(
                                            Icons.mark_email_unread_outlined,
                                            size: 14,
                                            color: colors.textMuted,
                                          ),
                                        ],
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          // Body message
                          if (body.isNotEmpty) ...[
                            const SizedBox(height: 10),
                            Text(
                              body,
                              maxLines: 3,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: isDark ? const Color(0xFFCBD5E1) : colors.textSecondary,
                                fontSize: 12.5,
                                height: 1.4,
                              ),
                            ),
                          ],
                          // Admin comment if rejection
                          if (adminComment != null) ...[
                            const SizedBox(height: 8),
                            AdminCommentHint(
                              comment: adminComment,
                              margin: EdgeInsets.zero,
                            ),
                          ],
                          // Action footer if routing exists
                          if (hasRoute) ...[
                            const SizedBox(height: 10),
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  'Tap to open details',
                                  style: TextStyle(
                                    color: isDark ? const Color(0xFFA5B4FC) : AppTheme.accent,
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                const SizedBox(width: 4),
                                Icon(
                                  Icons.arrow_forward_rounded,
                                  size: 13,
                                  color: isDark ? const Color(0xFFA5B4FC) : AppTheme.accent,
                                ),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
