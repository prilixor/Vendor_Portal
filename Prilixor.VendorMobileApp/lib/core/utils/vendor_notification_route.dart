import 'package:flutter/material.dart';

import '../../features/inventory/inventory_screen.dart';
import '../../features/onboarding/onboarding_screen.dart';
import '../../features/orders/order_detail_screen.dart';
import '../../features/orders/order_requests_screen.dart';
import '../../features/orders/orders_screen.dart';
import '../../features/products/products_screen.dart';
import '../models/vendor_notification_model.dart';
import 'vendor_notification_utils.dart';

/// Mobile destinations aligned with Vendor Web [getVendorRoute].
enum VendorNotificationDestination {
  orderRequests,
  orders,
  orderDetail,
  products,
  inventory,
  onboardingProfile,
  onboardingDocuments,
  onboardingBank,
}

class VendorNotificationRoute {
  final VendorNotificationDestination destination;
  final String? orderId;

  const VendorNotificationRoute({
    required this.destination,
    this.orderId,
  });
}

/// Mirrors `seller-sparkle-ui/src/app/helpers/vendorNav.ts` → `getVendorRoute`.
VendorNotificationRoute? resolveVendorNotificationRoute({
  required String? notificationType,
  required String? title,
  String? orderIdFromMessage,
}) {
  final type = notificationType?.trim().toLowerCase() ?? '';
  final t = title?.trim().toLowerCase() ?? '';

  if (type == 'dispatch_offer' ||
      type == 'new_order' ||
      type.contains('order_request')) {
    return const VendorNotificationRoute(
      destination: VendorNotificationDestination.orderRequests,
    );
  }

  if (type == 'order_confirmed' ||
      type == 'order_status_updated' ||
      type == 'order_photos_requested' ||
      type.startsWith('order_')) {
    return _ordersRoute(orderIdFromMessage);
  }

  if (type.startsWith('listing_') || type.contains('product')) {
    return const VendorNotificationRoute(
      destination: VendorNotificationDestination.products,
    );
  }

  if (type.startsWith('stock_') ||
      type == 'low_stock' ||
      type == 'out_of_stock') {
    return const VendorNotificationRoute(
      destination: VendorNotificationDestination.inventory,
    );
  }

  if (type.startsWith('document_')) {
    return const VendorNotificationRoute(
      destination: VendorNotificationDestination.onboardingDocuments,
    );
  }

  if (type.startsWith('bank_')) {
    return const VendorNotificationRoute(
      destination: VendorNotificationDestination.onboardingBank,
    );
  }

  if (type == 'vendor_extension_requested' ||
      type == 'vendor_buyout_requested') {
    return _ordersRoute(orderIdFromMessage);
  }

  if (type.startsWith('vendor_')) {
    return const VendorNotificationRoute(
      destination: VendorNotificationDestination.onboardingProfile,
    );
  }

  if (t.contains('order request') || t.contains('dispatch offer')) {
    return const VendorNotificationRoute(
      destination: VendorNotificationDestination.orderRequests,
    );
  }

  if (t.contains('order') || t.contains('rental')) {
    return _ordersRoute(orderIdFromMessage);
  }

  if (t.contains('listing') || t.contains('product')) {
    return const VendorNotificationRoute(
      destination: VendorNotificationDestination.products,
    );
  }

  if (t.contains('stock') || t.contains('inventory')) {
    return const VendorNotificationRoute(
      destination: VendorNotificationDestination.inventory,
    );
  }

  if (t.contains('document') ||
      t.contains('docs') ||
      t.contains('verification') ||
      t.contains('approved')) {
    return const VendorNotificationRoute(
      destination: VendorNotificationDestination.onboardingDocuments,
    );
  }

  if (t.contains('bank')) {
    return const VendorNotificationRoute(
      destination: VendorNotificationDestination.onboardingBank,
    );
  }

  if (t.contains('profile')) {
    return const VendorNotificationRoute(
      destination: VendorNotificationDestination.onboardingProfile,
    );
  }

  return null;
}

VendorNotificationRoute? resolveVendorNotificationRouteFor(VendorNotification n) {
  return resolveVendorNotificationRoute(
    notificationType: n.notificationType,
    title: n.title,
    orderIdFromMessage: extractOrderIdFromMessage(n.message),
  );
}

VendorNotificationRoute _ordersRoute(String? orderIdFromMessage) {
  if (orderIdFromMessage != null && orderIdFromMessage.isNotEmpty) {
    return VendorNotificationRoute(
      destination: VendorNotificationDestination.orderDetail,
      orderId: orderIdFromMessage,
    );
  }
  return const VendorNotificationRoute(
    destination: VendorNotificationDestination.orders,
  );
}

void navigateVendorNotificationRoute(
  BuildContext context,
  VendorNotificationRoute route,
) {
  switch (route.destination) {
    case VendorNotificationDestination.orderRequests:
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const _OrderRequestsHost()),
      );
      return;
    case VendorNotificationDestination.orders:
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const _OrdersHost()),
      );
      return;
    case VendorNotificationDestination.orderDetail:
      final orderId = route.orderId;
      if (orderId == null || orderId.isEmpty) return;
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => OrderDetailScreen(orderId: orderId),
        ),
      );
      return;
    case VendorNotificationDestination.products:
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const ProductsScreen()),
      );
      return;
    case VendorNotificationDestination.inventory:
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const InventoryScreen()),
      );
      return;
    case VendorNotificationDestination.onboardingProfile:
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => const OnboardingScreen(initialTab: 0),
        ),
      );
      return;
    case VendorNotificationDestination.onboardingDocuments:
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => const OnboardingScreen(initialTab: 1),
        ),
      );
      return;
    case VendorNotificationDestination.onboardingBank:
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => const OnboardingScreen(initialTab: 2),
        ),
      );
      return;
  }
}

void navigateForVendorNotification(BuildContext context, VendorNotification n) {
  final route = resolveVendorNotificationRouteFor(n);
  if (route == null) return;
  navigateVendorNotificationRoute(context, route);
}

class _OrderRequestsHost extends StatelessWidget {
  const _OrderRequestsHost();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Order Requests')),
      body: const OrderRequestsScreen(),
    );
  }
}

class _OrdersHost extends StatelessWidget {
  const _OrdersHost();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Orders')),
      body: const OrdersScreen(),
    );
  }
}
