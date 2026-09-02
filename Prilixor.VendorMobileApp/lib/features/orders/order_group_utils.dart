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
  final s = status.trim().toLowerCase().replaceAll('_', ' ').replaceAll(RegExp(r'\s+'), ' ');
  if (s == 'awaiting vendor acceptance' ||
      s == 'pending vendor acceptance' ||
      s == 'awaiting') {
    return 'Awaiting';
  }
  if (s == 'dispatch failed') return 'Failed';
  if (s.isEmpty) return status;
  return s
      .split(' ')
      .where((w) => w.isNotEmpty)
      .map((w) => '${w[0].toUpperCase()}${w.substring(1)}')
      .join(' ');
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

String orderTypeLabel(String type) {
  return type.toLowerCase() == 'buy' ? 'Buy' : 'Rent';
}

String formatOrderDate(DateTime date) {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  final local = date.toLocal();
  final h = local.hour.toString().padLeft(2, '0');
  final m = local.minute.toString().padLeft(2, '0');
  return '${months[local.month - 1]} ${local.day}, ${local.year} \u00b7 $h:$m';
}

String formatDetailDate(String? value) {
  if (value == null || value.trim().isEmpty) return 'â€”';
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
      ('Order type', orderTypeLabel(order.orderType)),
      ('Quantity', '${order.quantity}'),
      ('Vendor payout', payout),
    ];
  }

  return [
    ('Start date', formatDetailDate(order.startDate)),
    ('End date', formatDetailDate(order.endDate)),
    ('Rental days', '${order.rentalDays}'),
    ('Order type', orderTypeLabel(order.orderType)),
    ('Quantity', '${order.quantity}'),
    ('Vendor payout', payout),
  ];
}

class OrderStatusChip extends StatelessWidget {
  final String status;

  const OrderStatusChip({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    final isDark = context.isDarkMode;
    final s = status.toLowerCase().trim().replaceAll('_', ' ');
    final isStatusActive = s == 'active';
    final isStatusPending = s.contains('awaiting') || s.contains('pending');
    final isStatusConfirmed = s == 'confirmed';
    final isStatusTransit = s.contains('transit');
    final isStatusReturned = s == 'returned';
    final isStatusCancelled = s.contains('cancel');
    final isStatusFailed = s.contains('dispatch failed') || s.contains('failed');
    final isStatusBought = s.contains('bought');

    Color color;
    Color bgColor;
    Color borderColor;

    if (!isDark) {
      if (isStatusActive) {
        color = const Color(0xFF047857);
        bgColor = const Color(0xFFECFDF5);
        borderColor = const Color(0xFFA7F3D0);
      } else if (isStatusPending) {
        color = const Color(0xFF92400E);
        bgColor = const Color(0xFFFEF3C7);
        borderColor = const Color(0xFFFDE68A);
      } else if (isStatusConfirmed) {
        color = const Color(0xFF1D4ED8);
        bgColor = const Color(0xFFEFF6FF);
        borderColor = const Color(0xFFBFDBFE);
      } else if (isStatusTransit) {
        color = const Color(0xFF6D28D9);
        bgColor = const Color(0xFFF5F3FF);
        borderColor = const Color(0xFFDDD6FE);
      } else if (isStatusFailed) {
        color = const Color(0xFFB91C1C);
        bgColor = const Color(0xFFFEF2F2);
        borderColor = const Color(0xFFFECACA);
      } else if (isStatusBought) {
        color = const Color(0xFFBE185D);
        bgColor = const Color(0xFFFDF2F8);
        borderColor = const Color(0xFFFBCFE8);
      } else if (isStatusReturned) {
        color = const Color(0xFF334155);
        bgColor = const Color(0xFFF1F5F9);
        borderColor = const Color(0xFFCBD5E1);
      } else if (isStatusCancelled) {
        color = const Color(0xFF64748B);
        bgColor = const Color(0xFFF8FAFC);
        borderColor = const Color(0xFFE2E8F0);
      } else {
        color = const Color(0xFF475569);
        bgColor = const Color(0xFFF1F5F9);
        borderColor = const Color(0xFFCBD5E1);
      }
    } else {
      color = orderStatusColor(status);
      bgColor = color.withValues(alpha: 0.16);
      borderColor = color.withValues(alpha: 0.35);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: borderColor),
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
    final isDark = context.isDarkMode;
    final isBuy = orderType.toLowerCase() == 'buy';

    Color color;
    Color bgColor;
    Color borderColor;

    if (!isDark) {
      if (isBuy) {
        color = const Color(0xFF4338CA);
        bgColor = const Color(0xFFEEF2FF);
        borderColor = const Color(0xFFC7D2FE);
      } else {
        color = const Color(0xFF047857);
        bgColor = const Color(0xFFECFDF5);
        borderColor = const Color(0xFFA7F3D0);
      }
    } else {
      final base = orderTypeColor(orderType);
      color = base;
      bgColor = base.withValues(alpha: 0.14);
      borderColor = base.withValues(alpha: 0.35);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: borderColor),
      ),
      child: Text(
        orderTypeLabel(orderType),
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
    final colors = context.appColors;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: colors.border.withValues(alpha: 0.75)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: context.isDarkMode ? 0.2 : 0.06),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
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

/// Vendor Web parity: customer/qty/payout on one row, location on its own row.
class OrderItemMetaLine extends StatelessWidget {
  final VendorOrder order;

  const OrderItemMetaLine({super.key, required this.order});

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final muted = TextStyle(
      color: colors.textMuted,
      fontSize: 11,
      height: 1.35,
    );
    final value = TextStyle(
      color: colors.textPrimary,
      fontSize: 11,
      fontWeight: FontWeight.w700,
      height: 1.35,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 10,
          runSpacing: 4,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.person_outline_rounded,
                  size: 13,
                  color: colors.textMuted.withValues(alpha: 0.8),
                ),
                const SizedBox(width: 4),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 108),
                  child: Text(
                    order.customerName,
                    style: muted,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            Text.rich(
              TextSpan(
                children: [
                  TextSpan(text: 'Qty: ', style: muted),
                  TextSpan(text: '${order.quantity}', style: value),
                ],
              ),
            ),
            Text.rich(
              TextSpan(
                children: [
                  TextSpan(text: 'Payout: ', style: muted),
                  TextSpan(
                    text: '₹${order.payoutAmount.toStringAsFixed(0)}',
                    style: value,
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 5),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 1),
              child: Icon(
                Icons.location_on_outlined,
                size: 13,
                color: colors.textMuted.withValues(alpha: 0.8),
              ),
            ),
            const SizedBox(width: 4),
            Expanded(
              child: Text.rich(
                TextSpan(
                  children: [
                    TextSpan(text: 'Location: ', style: muted),
                    TextSpan(
                      text: order.customerLocation,
                      style: value.copyWith(fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

/// Group card header — order id, payout, fulfillment, and ordered-on date.
class OrderGroupCardHeader extends StatelessWidget {
  final OrderGroup group;

  const OrderGroupCardHeader({super.key, required this.group});

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final itemLabel =
        '${group.items.length} ${group.items.length == 1 ? 'item' : 'items'}';

    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  group.baseOrderNumber,
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w800,
                    fontSize: 14,
                    letterSpacing: -0.15,
                    height: 1.25,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Text(
                '₹${group.totalPayout.toStringAsFixed(0)}',
                style: const TextStyle(
                  color: AppTheme.accent,
                  fontWeight: FontWeight.w800,
                  fontSize: 15,
                  height: 1.25,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Consolidated fulfillment · $itemLabel',
            style: TextStyle(
              color: colors.textMuted,
              fontSize: 11,
              height: 1.35,
            ),
          ),
          const SizedBox(height: 4),
          Align(
            alignment: Alignment.centerRight,
            child: Text.rich(
              TextSpan(
                style: TextStyle(
                  color: colors.textMuted,
                  fontSize: 11,
                  height: 1.35,
                ),
                children: [
                  const TextSpan(text: 'Ordered on: '),
                  TextSpan(
                    text: formatOrderDate(group.latestCreated),
                    style: TextStyle(
                      color: colors.textSecondary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
  }
}

/// Grouped order list row — matches Vendor Web item card layout.
class OrderGroupListItem extends StatelessWidget {
  final VendorOrder order;
  final VoidCallback onTap;

  const OrderGroupListItem({
    super.key,
    required this.order,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;

    return Material(
      color: context.isDarkMode
          ? colors.surfaceElevated.withValues(alpha: 0.55)
          : const Color(0xFFFAFBFC),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: colors.border.withValues(alpha: 0.55)),
          ),
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  OrderThumb(url: order.imageUrl, size: 54),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          order.listingTitle,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: colors.textPrimary,
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                            height: 1.25,
                          ),
                        ),
                        const SizedBox(height: 7),
                        OrderItemMetaLine(order: order),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 11),
              Divider(height: 1, color: colors.border.withValues(alpha: 0.4)),
              const SizedBox(height: 10),
              Row(
                children: [
                  OrderTypeChip(orderType: order.orderType),
                  const SizedBox(width: 6),
                  OrderStatusChip(status: order.status),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'Details',
                          style: TextStyle(
                            color: AppTheme.accent,
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        Icon(
                          Icons.chevron_right_rounded,
                          color: AppTheme.accent,
                          size: 18,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
