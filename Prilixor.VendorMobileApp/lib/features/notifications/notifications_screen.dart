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

/// Vendor Alerts — parity with Vendor Web notifications (latest first, clean inbox).
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
    final vendorId =
        Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    await Provider.of<VendorNotificationProvider>(context, listen: false)
        .fetchNotifications(vendorId, silent: silent);
  }

  Future<void> _toggleRead(VendorNotification n) async {
    final vendorId =
        Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    final provider =
        Provider.of<VendorNotificationProvider>(context, listen: false);
    if (provider.isUnread(n)) {
      await provider.markAsRead(vendorId, n.id);
    } else {
      await provider.markAsUnread(vendorId, n.id);
    }
  }

  Future<void> _onTap(VendorNotification n) async {
    final vendorId =
        Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    final provider =
        Provider.of<VendorNotificationProvider>(context, listen: false);
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
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 6),
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
                child: Text(
                  provider.error!,
                  style: const TextStyle(color: Colors.redAccent),
                ),
              ),
            )
          else if (items.isEmpty)
            SliverFillRemaining(
              hasScrollBody: false,
              child: Builder(
                builder: (context) {
                  final colors = context.appColors;
                  return Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.notifications_off_outlined,
                        size: 56,
                        color: colors.textMuted.withValues(alpha: 0.45),
                      ),
                      const SizedBox(height: 14),
                      Text(
                        "You're all caught up",
                        style: TextStyle(
                          color: colors.textPrimary,
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        _filter == _InboxFilter.unread
                            ? 'No unread notifications.'
                            : 'No notifications yet.',
                        style: TextStyle(
                          color: colors.textMuted,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  );
                },
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
              sliver: SliverToBoxAdapter(
                child: _InboxListCard(
                  child: Column(
                    children: [
                      for (var i = 0; i < items.length; i++) ...[
                        if (i > 0)
                          Divider(
                            height: 1,
                            color: context.appColors.border.withValues(alpha: 0.5),
                          ),
                        _NotificationTile(
                          notification: items[i],
                          unread: provider.isUnread(items[i]),
                          onTap: () => _onTap(items[i]),
                          onToggleRead: () => _toggleRead(items[i]),
                        ),
                      ],
                    ],
                  ),
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
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppTheme.card(context),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: colors.border.withValues(alpha: 0.7)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Inbox',
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                    height: 1.2,
                  ),
                ),
                if (unreadCount > 0)
                  Text(
                    '$unreadCount unread',
                    style: TextStyle(
                      color: colors.textMuted,
                      fontSize: 11,
                      height: 1.2,
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
            selected: filter == _InboxFilter.unread,
            onTap: () => onFilterChanged(_InboxFilter.unread),
          ),
          if (onMarkAllRead != null) ...[
            const SizedBox(width: 4),
            Material(
              color: AppTheme.accent.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
              child: InkWell(
                onTap: onMarkAllRead,
                borderRadius: BorderRadius.circular(10),
                child: Tooltip(
                  message: 'Mark all read',
                  child: const SizedBox(
                    width: 32,
                    height: 32,
                    child: Icon(
                      Icons.done_all,
                      size: 18,
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
  final bool selected;
  final VoidCallback onTap;

  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Material(
      color: selected
          ? AppTheme.accent.withValues(alpha: 0.18)
          : colors.surfaceElevated.withValues(alpha: 0.6),
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        borderRadius: BorderRadius.circular(999),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          child: Text(
            label,
            style: TextStyle(
              color: selected ? AppTheme.accent : colors.textSecondary,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  }
}

class _InboxListCard extends StatelessWidget {
  final Widget child;

  const _InboxListCard({required this.child});

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.card(context),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: colors.border.withValues(alpha: 0.7)),
      ),
      clipBehavior: Clip.antiAlias,
      child: child,
    );
  }
}

class _NotificationTile extends StatelessWidget {
  final VendorNotification notification;
  final bool unread;
  final VoidCallback onTap;
  final VoidCallback onToggleRead;

  const _NotificationTile({
    required this.notification,
    required this.unread,
    required this.onTap,
    required this.onToggleRead,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
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
      color: unread
          ? AppTheme.accent.withValues(alpha: 0.08)
          : Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 8, 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  iconForVisualType(visual),
                  color: color,
                  size: 18,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            notification.title,
                            style: TextStyle(
                              color: colors.textPrimary,
                              fontWeight:
                                  unread ? FontWeight.w700 : FontWeight.w600,
                              fontSize: 13,
                              height: 1.25,
                            ),
                          ),
                        ),
                        if (unread)
                          Container(
                            width: 8,
                            height: 8,
                            margin: const EdgeInsets.only(left: 6, top: 4),
                            decoration: const BoxDecoration(
                              color: AppTheme.accent,
                              shape: BoxShape.circle,
                            ),
                          ),
                      ],
                    ),
                    if (body.isNotEmpty) ...[
                      const SizedBox(height: 3),
                      Text(
                        body,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: colors.textSecondary,
                          fontSize: 12,
                          height: 1.35,
                        ),
                      ),
                    ],
                    if (adminComment != null) ...[
                      const SizedBox(height: 8),
                      AdminCommentHint(
                        comment: adminComment,
                        margin: EdgeInsets.zero,
                      ),
                    ],
                    const SizedBox(height: 5),
                    Text(
                      when,
                      style: TextStyle(
                        color: colors.textMuted,
                        fontSize: 11,
                      ),
                    ),
                    if (hasRoute) ...[
                      const SizedBox(height: 4),
                      Text(
                        'Tap to open',
                        style: TextStyle(
                          color: AppTheme.accent.withValues(alpha: 0.85),
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              TextButton(
                onPressed: onToggleRead,
                style: TextButton.styleFrom(
                  minimumSize: Size.zero,
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  foregroundColor: colors.textMuted,
                ),
                child: Text(
                  unread ? 'Read' : 'Unread',
                  style: const TextStyle(fontSize: 11),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
