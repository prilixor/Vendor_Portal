import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/providers/notification_provider.dart';
import '../../core/models/notification_model.dart';
import '../../core/models/order_model.dart';
import '../../core/providers/order_provider.dart';
import '../../core/theme.dart';
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
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF6C63FF)))
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
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isUnread ? const Color(0xFF6C63FF).withValues(alpha: 0.1) : colors.surface,
          borderRadius: BorderRadius.circular(12),
          border: isUnread
              ? Border.all(color: const Color(0xFF6C63FF).withValues(alpha: 0.3))
              : Border.all(color: colors.border),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: isUnread ? const Color(0xFF6C63FF).withValues(alpha: 0.2) : colors.surfaceElevated,
                shape: BoxShape.circle,
              ),
              child: Icon(
                _getIconForType(notification.notificationType),
                color: isUnread ? const Color(0xFF6C63FF) : colors.textMuted,
                size: 20,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    crossAxisAlignment: WrapCrossAlignment.center,
                    spacing: 8,
                    children: [
                      Text(
                        notification.title,
                        style: TextStyle(
                          color: colors.textPrimary,
                          fontSize: 16,
                          fontWeight: isUnread ? FontWeight.bold : FontWeight.w500,
                        ),
                      ),
                      if (notification.notificationType.isNotEmpty)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: colors.surfaceElevated,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            notification.notificationType.toLowerCase().replaceAll('_', ' '),
                            style: TextStyle(color: colors.textMuted, fontSize: 10),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    notification.body,
                    style: TextStyle(color: colors.textSecondary, fontSize: 14),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _formatDate(notification.createdAt),
                    style: TextStyle(color: colors.textMuted, fontSize: 12),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  IconData _getIconForType(String type) {
    final lowerType = type.toLowerCase();
    if (lowerType.contains('order')) return Icons.shopping_bag_outlined;
    if (lowerType.contains('expire') || lowerType.contains('return')) return Icons.timer_outlined;
    if (lowerType.contains('message') || lowerType.contains('chat')) return Icons.chat_bubble_outline;
    return Icons.notifications_none;
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
