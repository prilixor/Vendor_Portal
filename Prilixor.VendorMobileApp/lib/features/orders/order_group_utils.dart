import 'package:flutter/material.dart';

import '../../core/models/vendor_order_model.dart';
import '../../core/theme.dart';
import '../../shared/widgets/catalog_image.dart';

class OrderGroup {
  final String baseOrderNumber;
  final List<VendorOrder> items;

  const OrderGroup({
    required this.baseOrderNumber,
    required this.items,
  });

  DateTime get latestCreated {
    return items
        .map((o) => o.createdAtUtc)
        .reduce((a, b) => a.isAfter(b) ? a : b);
  }

  double get totalPayout =>
      items.fold(0.0, (sum, order) => sum + order.payoutAmount);
}

String getBaseOrderNumber(String orderNumber) {
  final parts = orderNumber.split('-');
  return parts.length >= 3 ? parts.sublist(0, 3).join('-') : orderNumber;
}

List<OrderGroup> buildOrderGroups(List<VendorOrder> orders) {
  final groups = <OrderGroup>[];
  for (final order in orders) {
    final base = getBaseOrderNumber(order.orderNumber);
    OrderGroup? group;
    for (final existing in groups) {
      if (existing.baseOrderNumber == base) {
        group = existing;
        break;
      }
    }
    if (group == null) {
      groups.add(OrderGroup(baseOrderNumber: base, items: [order]));
    } else {
      group.items.add(order);
    }
  }
  for (final group in groups) {
    group.items.sort((a, b) => a.orderNumber.compareTo(b.orderNumber));
  }
  groups.sort((a, b) => b.latestCreated.compareTo(a.latestCreated));
  return groups;
}

List<VendorOrder> orderGroupItems({
  required VendorOrder anchor,
  required List<VendorOrder> allOrders,
}) {
  final base = getBaseOrderNumber(anchor.orderNumber);
  final matches = allOrders
      .where((o) => getBaseOrderNumber(o.orderNumber) == base)
      .toList();
  if (matches.isEmpty) return [anchor];
  final hasAnchor = matches.any((o) => o.orderId == anchor.orderId);
  final items = hasAnchor
      ? matches
      : [anchor, ...matches.where((o) => o.orderId != anchor.orderId)];
  items.sort((a, b) => a.orderNumber.compareTo(b.orderNumber));
  return items;
}

String formatOrderStatusLabel(String status) {
  final s = status.trim().toLowerCase().replaceAll('_', ' ');
  if (s == 'awaiting vendor acceptance' || s == 'pending vendor acceptance') {
    return 'Awaiting';
  }
  if (s == 'dispatch failed') return 'Failed';
  return status.replaceAll('_', ' ');
}

Color orderStatusColor(String status) {
  final s = status.toLowerCase().replaceAll('_', ' ');
  if (s.contains('awaiting') || s == 'pending') return Colors.amber;
  if (s == 'confirmed') return const Color(0xFF60A5FA);
  if (s.contains('transit')) return Colors.purpleAccent;
  if (s == 'active') return const Color(0xFF34D399);
  if (s == 'returned') return Colors.blueGrey;
  if (s.contains('cancel')) return Colors.grey;
  if (s.contains('dispatch failed')) return Colors.redAccent;
  if (s.contains('bought')) return Colors.pinkAccent;
  return Colors.white54;
}

Color orderTypeColor(String type) {
  return type.toLowerCase() == 'buy'
      ? const Color(0xFF818CF8)
      : const Color(0xFF34D399);
}

String formatOrderDate(DateTime date) {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  final local = date.toLocal();
  final h = local.hour.toString().padLeft(2, '0');
  final m = local.minute.toString().padLeft(2, '0');
  return '${months[local.month - 1]} ${local.day}, ${local.year} · $h:$m';
}

String formatDetailDate(String? value) {
  if (value == null || value.trim().isEmpty) return '—';
  final parsed = DateTime.tryParse(value);
  if (parsed == null) return value;
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  final local = parsed.toLocal();
  return '${months[local.month - 1]} ${local.day}, ${local.year}';
}

List<(String, String)> orderDetailRows(VendorOrder order) {
  final isBuy = order.orderType.toLowerCase() == 'buy';
  final payout = '₹${order.payoutAmount.toStringAsFixed(0)}';

  if (isBuy) {
    return [
      ('Purchase date', formatDetailDate(order.startDate)),
      ('Order type', order.orderType.toUpperCase()),
      ('Quantity', '${order.quantity}'),
      ('Vendor payout', payout),
    ];
  }

  return [
    ('Start date', formatDetailDate(order.startDate)),
    ('End date', formatDetailDate(order.endDate)),
    ('Rental days', '${order.rentalDays}'),
    ('Order type', order.orderType.toUpperCase()),
    ('Quantity', '${order.quantity}'),
    ('Vendor payout', payout),
  ];
}

class OrderStatusChip extends StatelessWidget {
  final String status;

  const OrderStatusChip({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    final color = orderStatusColor(status);
    return Container(
      height: 20,
      alignment: Alignment.center,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Text(
        formatOrderStatusLabel(status),
        maxLines: 1,
        softWrap: false,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w700,
          height: 1.1,
        ),
      ),
    );
  }
}

class OrderTypeChip extends StatelessWidget {
  final String orderType;

  const OrderTypeChip({super.key, required this.orderType});

  @override
  Widget build(BuildContext context) {
    final color = orderTypeColor(orderType);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Text(
        orderType.toUpperCase(),
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class OrderThumb extends StatelessWidget {
  final String? url;
  final double size;

  const OrderThumb({super.key, this.url, this.size = 48});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CatalogImage(
        url: url,
        fit: BoxFit.cover,
        borderRadius: BorderRadius.circular(10),
      ),
    );
  }
}

class OrderMetaChip extends StatelessWidget {
  final String label;
  final bool highlight;

  const OrderMetaChip({super.key, required this.label, this.highlight = false});

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: highlight
            ? colors.primarySoft
            : colors.surfaceElevated,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: highlight ? colors.accent : colors.textSecondary,
          fontSize: 10,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
