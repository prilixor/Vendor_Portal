import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/models/dispatch_offer_model.dart';
import '../../core/providers/vendor_order_provider.dart';
import '../../core/theme.dart';
import '../../shared/widgets/vendor_doctor_lookup_sheet.dart';
import 'order_detail_screen.dart';
import 'order_group_utils.dart';

/// Order Requests — grouped by base order number like Vendor Web.
class OrderRequestsScreen extends StatefulWidget {
  /// When false (tab hidden), countdown ticker is paused to avoid 1Hz rebuilds.
  final bool isActive;

  const OrderRequestsScreen({super.key, this.isActive = true});

  @override
  State<OrderRequestsScreen> createState() => _OrderRequestsScreenState();
}

class _OrderRequestsScreenState extends State<OrderRequestsScreen> {
  final _searchController = TextEditingController();
  String _searchQuery = '';
  String _typeFilter = 'all';
  Timer? _ticker;
  final Set<String> _expandedGroups = {};

  static const _collapseAfter = 3;

  @override
  void initState() {
    super.initState();
    if (widget.isActive) _startTicker();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load(silent: true));
  }

  @override
  void didUpdateWidget(covariant OrderRequestsScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isActive && !oldWidget.isActive) {
      _startTicker();
      _load(silent: true);
    } else if (!widget.isActive && oldWidget.isActive) {
      _ticker?.cancel();
      _ticker = null;
    }
  }

  void _startTicker() {
    _ticker?.cancel();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted && widget.isActive) setState(() {});
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    final vendorId = Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null || vendorId.isEmpty) return;
    await Provider.of<VendorOrderProvider>(context, listen: false)
        .fetchOffers(vendorId, silent: silent);
  }

  Future<void> _respond(
    VendorDispatchOffer offer, {
    required bool accept,
  }) async {
    if (!accept) {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Reject request?'),
          content: Text('Decline ${offer.listingTitle}?'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () => Navigator.pop(ctx, true),
              style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
              child: const Text('Reject'),
            ),
          ],
        ),
      );
      if (confirmed != true) return;
    }

    if (!mounted) return;
    final vendorId = Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    final provider = Provider.of<VendorOrderProvider>(context, listen: false);
    final ok = accept
        ? await provider.acceptOffer(vendorId, offer.orderId)
        : await provider.rejectOffer(vendorId, offer.orderId);
    if (!mounted) return;
    if (ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            accept ? 'Order request accepted.' : 'Order request rejected.',
          ),
        ),
      );
      if (accept) {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => OrderDetailScreen(orderId: offer.orderId),
          ),
        );
      }
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(provider.error ?? 'Action failed'),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  String _expiresLabel(DateTime expiresAt) {
    final ms = expiresAt.difference(DateTime.now()).inMilliseconds;
    if (ms <= 0) return 'Expired';
    final min = (ms / 60000).ceil();
    if (min >= 60) {
      final h = min ~/ 60;
      final m = min % 60;
      return m == 0 ? '${h}h left' : '${h}h ${m}m left';
    }
    return '$min min left';
  }

  String _baseOrderNumber(String num) {
    final parts = num.split('-');
    return parts.length >= 3 ? parts.sublist(0, 3).join('-') : num;
  }

  bool _matchesSearch(VendorDispatchOffer offer, String q) {
    if (q.isEmpty) return true;
    return offer.orderNumber.toLowerCase().contains(q) ||
        offer.listingTitle.toLowerCase().contains(q) ||
        (offer.doctorName?.toLowerCase().contains(q) ?? false) ||
        (offer.doctorUniqueCode?.toLowerCase().contains(q) ?? false) ||
        (offer.hospitalName?.toLowerCase().contains(q) ?? false) ||
        (offer.hospitalCity?.toLowerCase().contains(q) ?? false);
  }

  bool _matchesType(VendorDispatchOffer offer) {
    if (_typeFilter == 'all') return true;
    return offer.orderType.toLowerCase() == _typeFilter;
  }

  List<_OfferGroup> _buildGroups(List<VendorDispatchOffer> offers) {
    final groups = <_OfferGroup>[];
    for (final offer in offers) {
      if (!_matchesSearch(offer, _searchQuery) || !_matchesType(offer)) continue;
      final base = _baseOrderNumber(offer.orderNumber);
      _OfferGroup? g;
      for (final existing in groups) {
        if (existing.baseOrderNumber == base) {
          g = existing;
          break;
        }
      }
      if (g == null) {
        g = _OfferGroup(
          baseOrderNumber: base,
          expiresAt: offer.expiresAt,
          items: [],
        );
        groups.add(g);
      }
      g.items.add(offer);
      if (offer.expiresAt.isBefore(g.expiresAt)) {
        g.expiresAt = offer.expiresAt;
      }
    }
    groups.sort((a, b) => a.expiresAt.compareTo(b.expiresAt));
    return groups;
  }

  double _groupPayout(_OfferGroup group) =>
      group.items.fold(0.0, (sum, o) => sum + o.payoutAmount);

  void _toggleExpanded(String baseOrderNumber) {
    setState(() {
      if (_expandedGroups.contains(baseOrderNumber)) {
        _expandedGroups.remove(baseOrderNumber);
      } else {
        _expandedGroups.add(baseOrderNumber);
      }
    });
  }

  Widget _buildScrollHeader({
    required int groupCount,
    required int itemCount,
    required double totalPayout,
    required bool refreshing,
    required int totalOffers,
    required int rentCount,
    required int buyCount,
  }) {
    final colors = context.appColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _RequestsHeader(
          groupCount: groupCount,
          itemCount: itemCount,
          totalPayout: totalPayout,
          refreshing: refreshing,
          onRefresh: () => _load(),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
          child: TextField(
            controller: _searchController,
            style: TextStyle(color: colors.textPrimary),
            decoration: InputDecoration(
              hintText: 'Search order, listing, doctor, hospital…',
              hintStyle: TextStyle(color: colors.textMuted),
              prefixIcon: Icon(Icons.search, color: colors.accent),
              suffixIcon: _searchQuery.isNotEmpty
                  ? IconButton(
                      icon: Icon(Icons.close, color: colors.textMuted),
                      onPressed: () {
                        _searchController.clear();
                        setState(() => _searchQuery = '');
                      },
                    )
                  : null,
              filled: true,
              fillColor: colors.surface,
              contentPadding: const EdgeInsets.symmetric(vertical: 0),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide(color: colors.border),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide(color: colors.border),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide(color: colors.accent),
              ),
            ),
            onChanged: (v) => setState(() => _searchQuery = v.trim().toLowerCase()),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _TypeChip(
                  label: 'All',
                  selected: _typeFilter == 'all',
                  count: totalOffers,
                  onTap: () => setState(() => _typeFilter = 'all'),
                ),
                const SizedBox(width: 8),
                _TypeChip(
                  label: 'Rent',
                  selected: _typeFilter == 'rent',
                  count: rentCount,
                  onTap: () => setState(() => _typeFilter = 'rent'),
                ),
                const SizedBox(width: 8),
                _TypeChip(
                  label: 'Buy',
                  selected: _typeFilter == 'buy',
                  count: buyCount,
                  onTap: () => setState(() => _typeFilter = 'buy'),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<VendorOrderProvider>(context);
    final groups = _buildGroups(provider.pendingOffers);
    final totalItems = groups.fold<int>(0, (n, g) => n + g.items.length);
    final totalPayout = groups.fold<double>(0, (n, g) => n + _groupPayout(g));
    final rentCount = provider.pendingOffers
        .where((o) => o.orderType.toLowerCase() == 'rent')
        .length;
    final buyCount = provider.pendingOffers
        .where((o) => o.orderType.toLowerCase() == 'buy')
        .length;

    return RefreshIndicator(
      color: AppTheme.accent,
      onRefresh: () => _load(),
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverToBoxAdapter(
            child: _buildScrollHeader(
              groupCount: groups.length,
              itemCount: totalItems,
              totalPayout: totalPayout,
              refreshing: provider.offersLoading,
              totalOffers: provider.pendingOffers.length,
              rentCount: rentCount,
              buyCount: buyCount,
            ),
          ),
          if (provider.offersLoading && groups.isEmpty)
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 96),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, index) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _RequestGroupSkeleton(),
                  ),
                  childCount: 3,
                ),
              ),
            )
          else if (groups.isEmpty)
            SliverFillRemaining(
              hasScrollBody: false,
              child: Builder(
                builder: (context) {
                  final colors = context.appColors;
                  return Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.assignment_outlined,
                          size: 56,
                          color: colors.textMuted.withValues(alpha: 0.45),
                        ),
                        const SizedBox(height: 14),
                        Text(
                          _searchQuery.isNotEmpty || _typeFilter != 'all'
                              ? 'No requests match your filters.'
                              : 'No pending requests right now.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: colors.textPrimary,
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'New customer dispatch offers will appear here.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: colors.textMuted,
                            fontSize: 13,
                          ),
                        ),
                        const SizedBox(height: 20),
                        OutlinedButton.icon(
                          onPressed: () => _load(),
                          icon: const Icon(Icons.refresh),
                          label: const Text('Refresh'),
                        ),
                      ],
                    ),
                  );
                },
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
              sliver: SliverList.separated(
                itemCount: groups.length,
                separatorBuilder: (context, index) => const SizedBox(height: 12),
                itemBuilder: (context, index) {
                  final group = groups[index];
                  final expanded = _expandedGroups.contains(group.baseOrderNumber);
                  final visibleItems = expanded || group.items.length <= _collapseAfter
                      ? group.items
                      : group.items.take(_collapseAfter - 1).toList();
                  final hiddenCount = group.items.length - visibleItems.length;

                  return _RequestGroupCard(
                    group: group,
                    payoutTotal: _groupPayout(group),
                    expiresLabel: _expiresLabel(group.expiresAt),
                    expired: group.expiresAt.isBefore(DateTime.now()),
                    workingOrderId: provider.workingOrderId,
                    visibleItems: visibleItems,
                    hiddenCount: hiddenCount,
                    expanded: expanded,
                    onToggleExpand: hiddenCount > 0 || expanded
                        ? () => _toggleExpanded(group.baseOrderNumber)
                        : null,
                    onAccept: (offer) => _respond(offer, accept: true),
                    onReject: (offer) => _respond(offer, accept: false),
                    expiresLabelFor: _expiresLabel,
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}

class _OfferGroup {
  final String baseOrderNumber;
  DateTime expiresAt;
  final List<VendorDispatchOffer> items;

  _OfferGroup({
    required this.baseOrderNumber,
    required this.expiresAt,
    required this.items,
  });
}

class _RequestsHeader extends StatelessWidget {
  final int groupCount;
  final int itemCount;
  final double totalPayout;
  final bool refreshing;
  final VoidCallback onRefresh;

  const _RequestsHeader({
    required this.groupCount,
    required this.itemCount,
    required this.totalPayout,
    required this.refreshing,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            colors.primarySoft,
            colors.surface,
            colors.surfaceElevated.withValues(alpha: 0.65),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.accent.withValues(alpha: 0.2)),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: colors.accent.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(Icons.inbox_outlined, color: colors.accent),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  groupCount == 0
                      ? 'Waiting for requests'
                      : '$groupCount ${groupCount == 1 ? 'request' : 'requests'} · $itemCount ${itemCount == 1 ? 'item' : 'items'}',
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w800,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  groupCount == 0
                      ? 'Accept or reject incoming dispatch offers.'
                      : 'Potential payout ₹${totalPayout.toStringAsFixed(0)}',
                  style: TextStyle(
                    color: colors.textSecondary,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Refresh',
            onPressed: refreshing ? null : onRefresh,
            icon: refreshing
                ? SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: colors.accent),
                  )
                : Icon(Icons.refresh_rounded, color: colors.accent),
          ),
        ],
      ),
    );
  }
}

class _TypeChip extends StatelessWidget {
  final String label;
  final bool selected;
  final int count;
  final VoidCallback onTap;

  const _TypeChip({
    required this.label,
    required this.selected,
    required this.count,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return FilterChip(
      label: Text('$label ($count)'),
      selected: selected,
      onSelected: (_) => onTap(),
      showCheckmark: false,
      labelStyle: TextStyle(
        color: selected ? colors.accent : colors.textSecondary,
        fontWeight: FontWeight.w600,
        fontSize: 12,
      ),
      backgroundColor: colors.surface,
      selectedColor: colors.primarySoft,
      side: BorderSide(
        color: selected ? colors.accent.withValues(alpha: 0.55) : colors.border,
      ),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
    );
  }
}

class _RequestGroupCard extends StatelessWidget {
  final _OfferGroup group;
  final double payoutTotal;
  final String expiresLabel;
  final bool expired;
  final String? workingOrderId;
  final List<VendorDispatchOffer> visibleItems;
  final int hiddenCount;
  final bool expanded;
  final VoidCallback? onToggleExpand;
  final ValueChanged<VendorDispatchOffer> onAccept;
  final ValueChanged<VendorDispatchOffer> onReject;
  final String Function(DateTime) expiresLabelFor;

  const _RequestGroupCard({
    required this.group,
    required this.payoutTotal,
    required this.expiresLabel,
    required this.expired,
    required this.workingOrderId,
    required this.visibleItems,
    required this.hiddenCount,
    required this.expanded,
    required this.onToggleExpand,
    required this.onAccept,
    required this.onReject,
    required this.expiresLabelFor,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final urgent = !expired &&
        group.expiresAt.difference(DateTime.now()).inMinutes <= 10;

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: urgent
              ? Colors.amber.withValues(alpha: 0.45)
              : colors.border,
        ),
        boxShadow: urgent
            ? [
                BoxShadow(
                  color: Colors.amber.withValues(alpha: 0.08),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ]
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        group.baseOrderNumber,
                        style: TextStyle(
                          color: colors.textPrimary,
                          fontWeight: FontWeight.w800,
                          fontSize: 14,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          Text(
                            'Consolidated · ${group.items.length} ${group.items.length == 1 ? 'item' : 'items'}',
                            style: TextStyle(
                              color: colors.textMuted,
                              fontSize: 11,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            '₹${payoutTotal.toStringAsFixed(0)}',
                            style: TextStyle(
                              color: colors.accent,
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                _TimerPill(label: expiresLabel, expired: expired, urgent: urgent),
              ],
            ),
          ),
          Divider(height: 1, color: colors.border.withValues(alpha: 0.6)),
          ...visibleItems.map(
            (offer) => _RequestItemRow(
              offer: offer,
              working: workingOrderId == offer.orderId,
              expired: offer.expiresAt.isBefore(DateTime.now()),
              expiresLabel: expiresLabelFor(offer.expiresAt),
              onAccept: () => onAccept(offer),
              onReject: () => onReject(offer),
            ),
          ),
          if (onToggleExpand != null && (hiddenCount > 0 || expanded))
            InkWell(
              onTap: onToggleExpand,
              borderRadius: const BorderRadius.vertical(bottom: Radius.circular(16)),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 10),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      expanded ? Icons.expand_less : Icons.expand_more,
                      size: 18,
                      color: AppTheme.accent,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      expanded
                          ? 'Show less'
                          : 'Show $hiddenCount more ${hiddenCount == 1 ? 'item' : 'items'}',
                      style: const TextStyle(
                        color: AppTheme.accent,
                        fontWeight: FontWeight.w600,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _TimerPill extends StatelessWidget {
  final String label;
  final bool expired;
  final bool urgent;

  const _TimerPill({
    required this.label,
    required this.expired,
    required this.urgent,
  });

  @override
  Widget build(BuildContext context) {
    final color = expired
        ? Colors.redAccent
        : urgent
            ? Colors.amber
            : const Color(0xFF60A5FA);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            expired ? Icons.timer_off_outlined : Icons.timer_outlined,
            size: 14,
            color: color,
          ),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _RequestItemRow extends StatelessWidget {
  final VendorDispatchOffer offer;
  final bool working;
  final bool expired;
  final String expiresLabel;
  final VoidCallback onAccept;
  final VoidCallback onReject;

  const _RequestItemRow({
    required this.offer,
    required this.working,
    required this.expired,
    required this.expiresLabel,
    required this.onAccept,
    required this.onReject,
  });

  Color _typeColor(String type) {
    return type.toLowerCase() == 'buy'
        ? const Color(0xFF818CF8)
        : const Color(0xFF34D399);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final type = offer.orderType.toLowerCase();
    final disabled = working || expired;

    return Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 10, 10),
      decoration: BoxDecoration(
        color: colors.background.withValues(alpha: 0.55),
        border: Border(
          bottom: BorderSide(color: colors.border.withValues(alpha: 0.5)),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          OrderThumb(url: offer.imageUrl),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  offer.listingTitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                    height: 1.25,
                  ),
                ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: [
                    _MetaChip(label: 'Qty ${offer.quantity}'),
                    if (type != 'buy')
                      _MetaChip(label: '${offer.rentalDays} days'),
                    _MetaChip(
                      label: '₹${offer.payoutAmount.toStringAsFixed(0)}',
                      highlight: true,
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                      decoration: BoxDecoration(
                        color: _typeColor(type).withValues(alpha: 0.14),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(
                          color: _typeColor(type).withValues(alpha: 0.35),
                        ),
                      ),
                      child: Text(
                        type,
                        style: TextStyle(
                          color: _typeColor(type),
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
                if (offer.doctorName != null ||
                    offer.hospitalName != null ||
                    offer.doctorUniqueCode != null) ...[
                  const SizedBox(height: 6),
                  Material(
                    color: colors.surfaceElevated,
                    borderRadius: BorderRadius.circular(8),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(8),
                      onTap: offer.doctorUniqueCode != null
                          ? () => showVendorDoctorLookupSheet(
                                context,
                                initialCode: offer.doctorUniqueCode,
                              )
                          : null,
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: colors.border.withValues(alpha: 0.7)),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              Icons.medical_services_outlined,
                              size: 12,
                              color: colors.textMuted,
                            ),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    [
                                      if (offer.doctorName != null)
                                        'Dr. ${offer.doctorName}${offer.doctorSpecialization != null ? ' · ${offer.doctorSpecialization}' : ''}${offer.doctorUniqueCode != null ? ' · ${offer.doctorUniqueCode}' : ''}',
                                      if (offer.hospitalName != null)
                                        offer.hospitalName! +
                                            (offer.hospitalCity != null
                                                ? ' (${offer.hospitalCity})'
                                                : ''),
                                      if (offer.doctorName == null &&
                                          offer.hospitalName == null &&
                                          offer.doctorUniqueCode != null)
                                        offer.doctorUniqueCode!,
                                    ].join(' · '),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      color: colors.textSecondary,
                                      fontSize: 10,
                                      height: 1.3,
                                    ),
                                  ),
                                  if (offer.doctorUniqueCode != null) ...[
                                    const SizedBox(height: 2),
                                    Text(
                                      'Tap to view',
                                      style: TextStyle(
                                        color: colors.textMuted,
                                        fontSize: 9,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
                if (expired)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text(
                      expiresLabel,
                      style: const TextStyle(
                        color: Colors.redAccent,
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 6),
          Column(
            children: [
              _ActionIconButton(
                icon: Icons.check_rounded,
                color: const Color(0xFF34D399),
                tooltip: 'Accept',
                disabled: disabled,
                loading: working,
                onPressed: onAccept,
              ),
              const SizedBox(height: 6),
              _ActionIconButton(
                icon: Icons.close_rounded,
                color: Colors.redAccent,
                tooltip: 'Reject',
                disabled: disabled,
                loading: false,
                onPressed: onReject,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  final String label;
  final bool highlight;

  const _MetaChip({required this.label, this.highlight = false});

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

class _ActionIconButton extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String tooltip;
  final bool disabled;
  final bool loading;
  final VoidCallback onPressed;

  const _ActionIconButton({
    required this.icon,
    required this.color,
    required this.tooltip,
    required this.disabled,
    required this.loading,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: color.withValues(alpha: disabled ? 0.08 : 0.16),
        borderRadius: BorderRadius.circular(10),
        child: InkWell(
          onTap: disabled ? null : onPressed,
          borderRadius: BorderRadius.circular(10),
          child: SizedBox(
            width: 36,
            height: 36,
            child: loading
                ? Padding(
                    padding: const EdgeInsets.all(8),
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: color,
                    ),
                  )
                : Icon(icon, color: disabled ? color.withValues(alpha: 0.35) : color, size: 20),
          ),
        ),
      ),
    );
  }
}

class _RequestGroupSkeleton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      height: 140,
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.border.withValues(alpha: 0.7)),
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 140,
            height: 14,
            decoration: BoxDecoration(
              color: colors.surfaceElevated,
              borderRadius: BorderRadius.circular(6),
            ),
          ),
          const SizedBox(height: 16),
          Expanded(
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: colors.surfaceElevated,
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        height: 12,
                        width: double.infinity,
                        decoration: BoxDecoration(
                          color: colors.surfaceElevated,
                          borderRadius: BorderRadius.circular(6),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Container(
                        height: 10,
                        width: 120,
                        decoration: BoxDecoration(
                          color: colors.surfaceElevated,
                          borderRadius: BorderRadius.circular(6),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
