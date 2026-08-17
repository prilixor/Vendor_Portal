import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/providers/order_provider.dart';
import '../../core/models/expiring_order_model.dart';
import '../../core/theme.dart';
import '../../shared/widgets/catalog_image.dart';

class ExpirationsScreen extends StatefulWidget {
  const ExpirationsScreen({super.key});

  @override
  State<ExpirationsScreen> createState() => _ExpirationsScreenState();
}

class _ExpirationsScreenState extends State<ExpirationsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<OrderProvider>(context, listen: false).fetchExpirations(withinDays: 30);
    });
  }

  Map<String, List<ExpiringOrderModel>> _group(List<ExpiringOrderModel> items) {
    final groups = <String, List<ExpiringOrderModel>>{};
    for (final x in items) {
      var base = x.orderNumber;
      if (base.contains('-')) {
        final parts = base.split('-');
        if (parts.length >= 3) base = parts.sublist(0, 3).join('-');
      }
      groups.putIfAbsent(base, () => []).add(x);
    }
    return groups;
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<OrderProvider>(context);
    final colors = context.appColors;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        title: Text('Rental expirations', style: TextStyle(color: colors.textPrimary)),
        backgroundColor: colors.background,
        iconTheme: IconThemeData(color: colors.textPrimary),
        elevation: 0,
      ),
      body: provider.isLoadingExpirations && provider.expirations.isEmpty
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF6C63FF)))
          : provider.expirationsError != null
              ? Center(child: Text(provider.expirationsError!, style: const TextStyle(color: Colors.redAccent)))
              : RefreshIndicator(
                  color: const Color(0xFF6C63FF),
                  onRefresh: () => provider.fetchExpirations(withinDays: 30),
                  child: provider.expirations.isEmpty
                      ? ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: [
                            const SizedBox(height: 120),
                            Icon(Icons.event_available_outlined, size: 64, color: colors.textMuted),
                            const SizedBox(height: 16),
                            Center(
                              child: Text(
                                'No upcoming rental end dates in the next 30 days.',
                                style: TextStyle(color: colors.textSecondary),
                                textAlign: TextAlign.center,
                              ),
                            ),
                          ],
                        )
                      : ListView(
                          padding: const EdgeInsets.all(16),
                          children: [
                            Text(
                              'Track rental end dates for the next 30 days.',
                              style: TextStyle(color: colors.textSecondary, fontSize: 13),
                            ),
                            const SizedBox(height: 16),
                            ..._group(provider.expirations).entries.map((entry) {
                              return Container(
                                margin: const EdgeInsets.only(bottom: 16),
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  color: colors.surface,
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(color: colors.border),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('ORDER GROUP', style: TextStyle(color: colors.textMuted, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1)),
                                    const SizedBox(height: 4),
                                    Text(entry.key, style: TextStyle(color: colors.textPrimary, fontSize: 16, fontWeight: FontWeight.bold)),
                                    const SizedBox(height: 12),
                                    ...entry.value.map((item) {
                                      final urgent = item.daysLeft <= 3;
                                      return Container(
                                        margin: const EdgeInsets.only(bottom: 10),
                                        padding: const EdgeInsets.all(12),
                                        decoration: BoxDecoration(
                                          color: colors.surfaceElevated,
                                          borderRadius: BorderRadius.circular(12),
                                          border: Border.all(color: colors.border),
                                        ),
                                        child: Row(
                                          children: [
                                            Container(
                                              width: 44,
                                              height: 44,
                                              clipBehavior: Clip.antiAlias,
                                              decoration: BoxDecoration(
                                                color: colors.surface,
                                                borderRadius: BorderRadius.circular(10),
                                                border: Border.all(color: colors.border),
                                              ),
                                              child: CatalogImage(
                                                url: item.listingPrimaryImageUrl,
                                                width: 44,
                                                height: 44,
                                                fit: BoxFit.cover,
                                              ),
                                            ),
                                            const SizedBox(width: 12),
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment: CrossAxisAlignment.start,
                                                children: [
                                                  Text(item.listingTitle, style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w600)),
                                                  const SizedBox(height: 4),
                                                  Text(
                                                    '${item.orderNumber} · ${item.orderType} · Ends ${_fmt(item.endDate)}',
                                                    style: TextStyle(color: colors.textSecondary, fontSize: 12),
                                                  ),
                                                ],
                                              ),
                                            ),
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                              decoration: BoxDecoration(
                                                color: urgent ? Colors.redAccent.withValues(alpha: 0.2) : colors.surface,
                                                borderRadius: BorderRadius.circular(8),
                                              ),
                                              child: Text(
                                                item.daysLeft <= 0
                                                    ? 'Due Today'
                                                    : item.daysLeft == 1
                                                        ? '1 day left'
                                                        : '${item.daysLeft} days left',
                                                style: TextStyle(
                                                  color: urgent ? Colors.redAccent : colors.textPrimary,
                                                  fontSize: 11,
                                                  fontWeight: FontWeight.bold,
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                      );
                                    }),
                                  ],
                                ),
                              );
                            }),
                          ],
                        ),
                ),
    );
  }

  String _fmt(DateTime d) => '${d.day}/${d.month}/${d.year}';
}
