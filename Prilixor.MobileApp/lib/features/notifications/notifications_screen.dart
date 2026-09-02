import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/providers/notification_provider.dart';
import '../../core/models/notification_model.dart';
import '../../core/models/order_model.dart';
import '../../core/providers/order_provider.dart';
import '../../core/theme.dart';
import '../../shared/widgets/brand_page_loader.dart';
import '../../shared/widgets/guest_sign_in_prompt.dart';
import '../orders/orders_screen.dart';
import '../orders/order_detail_screen.dart';
import '../../core/providers/product_provider.dart';
import '../product/product_detail_screen.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final auth = Provider.of<AuthProvider>(context);
    final provider = Provider.of<NotificationProvider>(context);

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        title: Text('Alerts', style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold)),
        backgroundColor: colors.background,
        elevation: 0,
        actions: [
          if (auth.isAuthenticated && provider.unreadCount > 0)
            TextButton(
              onPressed: () => provider.markAllAsRead(),
              child: const Text('Mark all read', style: TextStyle(color: Color(0xFF6C63FF))),
            ),
        ],
      ),
      body: !auth.isAuthenticated || provider.errorMessage == 'auth_required'
          ? GuestSignInPrompt.guest(
              title: 'Sign in to view alerts',
              message: 'Order updates and notifications appear here after you sign in.',
              icon: Icons.notifications_none_rounded,
            )
          : provider.isLoading && provider.notifications.isEmpty
          ? const BrandPageLoader()
          : provider.errorMessage != null
              ? Center(child: Text(provider.errorMessage!, style: const TextStyle(color: Colors.redAccent)))
              : provider.notifications.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.notifications_off_outlined, size: 64, color: colors.border),
                          const SizedBox(height: 16),
                          Text('You\'re all caught up!', style: TextStyle(color: colors.textMuted, fontSize: 16)),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      color: const Color(0xFF6C63FF),
                      onRefresh: () => provider.fetchNotifications(),
                      child: ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: provider.notifications.length,
                        separatorBuilder: (context, index) => const SizedBox(height: 12),
                        itemBuilder: (context, index) {
                          return _buildNotificationCard(context, provider.notifications[index]);
                        },
                      ),
                    ),
    );
  }

  Widget _buildNotificationCard(BuildContext context, NotificationModel notification) {
    final colors = context.appColors;
    final provider = Provider.of<NotificationProvider>(context, listen: false);
    final isUnread = provider.isUnread(notification);

    return GestureDetector(
      onTap: () async {
        if (isUnread) {
          final ok = await provider.markAsRead(notification.id);
          if (!ok && context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Could not mark alert as read. It may reappear as unread.'),
                backgroundColor: Colors.orange,
              ),
            );
          }
        }

        if (notification.relatedOrderId != null && notification.relatedOrderId!.isNotEmpty) {
          final orderProvider = Provider.of<OrderProvider>(context, listen: false);
          final relatedId = notification.relatedOrderId!;

          // Always refresh so status matches vendor-side updates.
          await orderProvider.fetchOrders(silent: true);

          List<OrderModel> getOrdersInGroup(OrderModel targetOrder) {
            String baseOrder = targetOrder.orderNumber;
            if (baseOrder.contains('-')) {
              final p = baseOrder.split('-');
              if (p.length >= 3) {
                baseOrder = p.sublist(0, 3).join('-');
              }
            }
            return orderProvider.orders.where((o) {
              String b = o.orderNumber;
              if (b.contains('-')) {
                final p = b.split('-');
                if (p.length >= 3) {
                  b = p.sublist(0, 3).join('-');
                }
              }
              return b == baseOrder;
            }).toList();
          }

          OrderModel? targetOrder;
          try {
            targetOrder = orderProvider.orders.firstWhere((o) => o.id == relatedId);
          } catch (_) {}

          if (targetOrder != null) {
            final ordersInGroup = getOrdersInGroup(targetOrder);
            if (context.mounted) {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => OrderDetailScreen(
                    orderNumber: targetOrder!.orderNumber,
                    ordersInGroup: ordersInGroup,
                  ),
                ),
              );
            }
          } else if (context.mounted) {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const OrdersScreen()),
            );
          }
        } else {
          // Fallback routing based on type/title (mirrors WebApp getCustomerRoute)
          final type = notification.notificationType.toLowerCase();
          final title = notification.title.toLowerCase();
          
          if (type.contains("support_chat") ||
              title.contains("blinksmed support") ||
              title.contains("support replied")) {
            if (context.mounted) {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const OrdersScreen()),
              );
            }
          } else if (type.startsWith("order_") || type.contains("order") ||
              title.contains("order") || title.contains("rental") ||
              title.contains("placed") || title.contains("expired") || title.contains("expiring")) {
            if (context.mounted) {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const OrdersScreen()),
              );
            }
          } else if (type.contains("stock") || title.contains("stock") || title.contains("favorite")) {
            final regex = RegExp(r'Good news! (.*?) from your favorites');
            final match = regex.firstMatch(notification.body);
            if (match != null && match.groupCount >= 1 && context.mounted) {
              final productName = match.group(1)!;
              final productProvider = Provider.of<ProductProvider>(context, listen: false);
              
              await productProvider.fetchProducts(search: productName);
              if (productProvider.products.isNotEmpty && context.mounted) {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => ProductDetailScreen(listingId: productProvider.products.first.id)),
                );
              }
            }
          }
        }
      },
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isUnread
              ? _getColorForNotification(notification.notificationType, notification.title, context.isDarkMode).withValues(alpha: context.isDarkMode ? 0.09 : 0.04)
              : colors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isUnread
                ? _getColorForNotification(notification.notificationType, notification.title, context.isDarkMode).withValues(alpha: context.isDarkMode ? 0.4 : 0.28)
                : colors.border.withValues(alpha: context.isDarkMode ? 0.6 : 0.8),
            width: isUnread ? 1.2 : 1.0,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: context.isDarkMode ? 0.15 : 0.025),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: _getColorForNotification(notification.notificationType, notification.title, context.isDarkMode)
                    .withValues(alpha: context.isDarkMode ? 0.18 : 0.12),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: _getColorForNotification(notification.notificationType, notification.title, context.isDarkMode)
                      .withValues(alpha: context.isDarkMode ? 0.35 : 0.22),
                  width: 0.8,
                ),
              ),
              child: Icon(
                _getIconForNotification(notification.notificationType, notification.title),
                color: _getColorForNotification(notification.notificationType, notification.title, context.isDarkMode),
                size: 20,
              ),
            ),
            const SizedBox(width: 12),
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
                            fontSize: 14.5,
                            fontWeight: isUnread ? FontWeight.w800 : FontWeight.w600,
                            height: 1.25,
                          ),
                        ),
                      ),
                      if (isUnread) ...[
                        const SizedBox(width: 6),
                        Container(
                          width: 8,
                          height: 8,
                          margin: const EdgeInsets.only(top: 4),
                          decoration: BoxDecoration(
                            color: _getColorForNotification(notification.notificationType, notification.title, context.isDarkMode),
                            shape: BoxShape.circle,
                          ),
                        ),
                      ],
                    ],
                  ),
                  if (_getBadgeLabel(notification.notificationType) != null) ...[
                    const SizedBox(height: 5),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: _getColorForNotification(notification.notificationType, notification.title, context.isDarkMode)
                            .withValues(alpha: context.isDarkMode ? 0.18 : 0.1),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        _getBadgeLabel(notification.notificationType)!,
                        style: TextStyle(
                          color: _getColorForNotification(notification.notificationType, notification.title, context.isDarkMode),
                          fontSize: 10.5,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                  if (notification.body.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(
                      notification.body,
                      style: TextStyle(
                        color: context.isDarkMode ? const Color(0xFFCBD5E1) : colors.textSecondary,
                        fontSize: 13,
                        height: 1.35,
                      ),
                    ),
                  ],
                  const SizedBox(height: 8),
                  Text(
                    _formatDate(notification.createdAt),
                    style: TextStyle(
                      color: colors.textMuted,
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  IconData _getIconForNotification(String type, String title) {
    final t = type.trim().toLowerCase();
    final h = title.trim().toLowerCase();

    if (t.contains('welcome') || h.contains('welcome')) {
      return Icons.waving_hand_outlined;
    }
    if (t.contains('photo') || h.contains('photo')) {
      return Icons.add_a_photo_outlined;
    }
    if (t.contains('dispatch') ||
        t.contains('transit') ||
        t.contains('delivery') ||
        t.contains('shipping') ||
        h.contains('dispatch') ||
        h.contains('delivery') ||
        h.contains('transit')) {
      return Icons.local_shipping_outlined;
    }
    if (t.contains('pay') ||
        t.contains('refund') ||
        t.contains('invoice') ||
        h.contains('payment') ||
        h.contains('refund')) {
      return Icons.payments_outlined;
    }
    if (t.contains('expire') ||
        t.contains('expir') ||
        t.contains('return') ||
        t.contains('continuation') ||
        h.contains('expir') ||
        h.contains('return')) {
      return Icons.hourglass_bottom_rounded;
    }
    if (t.contains('cancel') ||
        t.contains('fail') ||
        t.contains('reject') ||
        h.contains('cancel') ||
        h.contains('failed')) {
      return Icons.cancel_outlined;
    }
    if (t.contains('support') ||
        t.contains('chat') ||
        t.contains('message') ||
        h.contains('support') ||
        h.contains('ticket')) {
      return Icons.chat_bubble_outline_rounded;
    }
    if (t.contains('stock') || h.contains('stock') || h.contains('favorite')) {
      return Icons.inventory_2_outlined;
    }
    if (t.contains('order') || h.contains('order') || h.contains('rental')) {
      return Icons.shopping_bag_outlined;
    }
    return Icons.notifications_active_outlined;
  }

  Color _getColorForNotification(String type, String title, bool isDark) {
    final t = type.trim().toLowerCase();
    final h = title.trim().toLowerCase();

    if (t.contains('welcome') || h.contains('welcome')) {
      return isDark ? const Color(0xFF38BDF8) : const Color(0xFF0284C7); // Sky
    }
    if (t.contains('photo') || h.contains('photo')) {
      return isDark ? const Color(0xFF22D3EE) : const Color(0xFF0891B2); // Cyan
    }
    if (t.contains('dispatch') ||
        t.contains('transit') ||
        t.contains('delivery') ||
        t.contains('shipping') ||
        h.contains('dispatch') ||
        h.contains('delivery') ||
        h.contains('transit')) {
      return isDark ? const Color(0xFF60A5FA) : const Color(0xFF2563EB); // Blue
    }
    if (t.contains('pay') ||
        t.contains('refund') ||
        t.contains('invoice') ||
        h.contains('payment') ||
        h.contains('refund')) {
      return isDark ? const Color(0xFF34D399) : const Color(0xFF059669); // Emerald
    }
    if (t.contains('expire') ||
        t.contains('expir') ||
        t.contains('return') ||
        t.contains('continuation') ||
        h.contains('expir') ||
        h.contains('return')) {
      return isDark ? const Color(0xFFFBBF24) : const Color(0xFFD97706); // Amber
    }
    if (t.contains('cancel') ||
        t.contains('fail') ||
        t.contains('reject') ||
        h.contains('cancel') ||
        h.contains('failed')) {
      return isDark ? const Color(0xFFF87171) : const Color(0xFFDC2626); // Rose
    }
    if (t.contains('support') ||
        t.contains('chat') ||
        t.contains('message') ||
        h.contains('support') ||
        h.contains('ticket')) {
      return isDark ? const Color(0xFFA78BFA) : const Color(0xFF7C3AED); // Purple
    }
    if (t.contains('stock') || h.contains('stock') || h.contains('favorite')) {
      return isDark ? const Color(0xFF2DD4BF) : const Color(0xFF0D9488); // Teal
    }
    if (t.contains('order') || h.contains('order') || h.contains('rental')) {
      return isDark ? const Color(0xFF818CF8) : const Color(0xFF4F46E5); // Indigo
    }
    return isDark ? const Color(0xFFA5B4FC) : const Color(0xFF6C63FF);
  }

  String? _getBadgeLabel(String type) {
    final t = type.trim().toLowerCase();
    if (t.isEmpty || t == 'general') return null;
    if (t == 'welcome') return 'Welcome';
    if (t == 'order_pending') return 'Pending';
    if (t == 'order_confirmed') return 'Confirmed';
    if (t == 'order_status_updated') return 'Order update';
    if (t == 'order_dispatched' || t.contains('dispatch')) return 'Dispatched';
    if (t == 'order_in_transit' || t.contains('transit')) return 'In transit';
    if (t == 'order_delivered' || t.contains('deliver')) return 'Delivered';
    if (t.contains('payment') || t.contains('pay')) return 'Payment';
    if (t == 'order_cancelled' || t.contains('cancel')) return 'Cancelled';
    if (t == 'order_dispatch_failed' || t.contains('fail')) return 'Action needed';
    if (t == 'order_expiring_soon' || t.contains('expir')) return 'Expiring';
    if (t.contains('continuation')) return 'Extension';
    if (t.contains('photo')) return 'Photos';
    if (t == 'support_chat_reply' || t.contains('support') || t.contains('chat')) return 'Support';
    if (t == 'back_in_stock' || t.contains('stock')) return 'Back in stock';
    final words = t.replaceAll('_', ' ').replaceFirst('order ', '');
    return words.split(' ').map((w) => w.isNotEmpty ? '${w[0].toUpperCase()}${w.substring(1)}' : '').join(' ');
  }

  String _formatDate(DateTime date) {
    final now = DateTime.now();
    final difference = now.difference(date);

    if (difference.inDays == 0) {
      if (difference.inHours == 0) {
        return '${difference.inMinutes}m ago';
      }
      return '${difference.inHours}h ago';
    } else if (difference.inDays < 7) {
      return '${difference.inDays}d ago';
    } else {
      return '${date.day}/${date.month}/${date.year}';
    }
  }
}
