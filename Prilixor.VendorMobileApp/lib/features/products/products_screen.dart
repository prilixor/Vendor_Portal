import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/models/vendor_catalog_model.dart';
import '../../core/providers/vendor_catalog_provider.dart';
import '../../core/providers/vendor_profile_provider.dart';
import '../../core/theme.dart';
import 'listing_type_picker_screen.dart';
import 'product_detail_screen.dart';

/// Vendor product listings — Equipment/Chemical tabs, status + search filters (web parity).
class ProductsScreen extends StatefulWidget {
  final String? initialStatusFilter;
  final bool? initialChemicalTab;

  const ProductsScreen({
    super.key,
    this.initialStatusFilter,
    this.initialChemicalTab,
  });

  @override
  State<ProductsScreen> createState() => _ProductsScreenState();
}

class _ProductsScreenState extends State<ProductsScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  final _searchController = TextEditingController();
  String _searchQuery = '';
  late String _statusFilter;
  bool _favoritesOnly = false;

  static const _statusFilters = <(String id, String label)>[
    ('all', 'All'),
    ('active', 'Active'),
    ('inactive', 'Inactive'),
    ('draft', 'Draft'),
  ];

  @override
  void initState() {
    super.initState();
    _statusFilter = widget.initialStatusFilter ?? 'all';
    _tabController = TabController(
      length: 2,
      vsync: this,
      initialIndex: widget.initialChemicalTab == true ? 1 : 0,
    );
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    final vendorId =
        Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null || vendorId.isEmpty) return;
    await Provider.of<VendorCatalogProvider>(context, listen: false)
        .fetchCatalog(vendorId, silent: silent);
  }

  List<VendorListingRow> _filtered(List<VendorListingRow> rows, bool chemicals) {
    final q = _searchQuery.trim().toLowerCase();
    return rows.where((row) {
      if (row.isChemical != chemicals) return false;
      if (_favoritesOnly && row.listing.favoriteCount <= 0) return false;
      if (_statusFilter != 'all') {
        final statusId = switch (row.status) {
          ListingUiStatus.active => 'active',
          ListingUiStatus.inactive => 'inactive',
          ListingUiStatus.draft => 'draft',
        };
        if (statusId != _statusFilter) return false;
      }
      if (q.isEmpty) return true;
      return row.listing.listingTitle.toLowerCase().contains(q) ||
          row.categoryName.toLowerCase().contains(q) ||
          row.productName.toLowerCase().contains(q);
    }).toList()
      ..sort((a, b) => a.listing.listingTitle.compareTo(b.listing.listingTitle));
  }

  Map<String, int> _statusCounts(List<VendorListingRow> rows, bool chemicals) {
    final base = rows.where((r) => r.isChemical == chemicals).toList();
    final q = _searchQuery.trim().toLowerCase();
    final searchable = base.where((row) {
      if (_favoritesOnly && row.listing.favoriteCount <= 0) return false;
      if (q.isEmpty) return true;
      return row.listing.listingTitle.toLowerCase().contains(q) ||
          row.categoryName.toLowerCase().contains(q) ||
          row.productName.toLowerCase().contains(q);
    }).toList();

    return {
      for (final (id, _) in _statusFilters)
        id: id == 'all'
            ? searchable.length
            : searchable.where((row) {
                final statusId = switch (row.status) {
                  ListingUiStatus.active => 'active',
                  ListingUiStatus.inactive => 'inactive',
                  ListingUiStatus.draft => 'draft',
                };
                return statusId == id;
              }).length,
    };
  }

  Future<void> _openStatusFilter(Map<String, int> counts) async {
    var draft = _statusFilter;
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppTheme.card(context),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: context.appColors.border,
                          borderRadius: BorderRadius.circular(99),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Listing status',
                      style: TextStyle(
                        color: context.appColors.textPrimary,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 12),
                    ..._statusFilters.map((entry) {
                      final selected = draft == entry.$1;
                      return Container(
                        margin: const EdgeInsets.only(bottom: 6),
                        decoration: BoxDecoration(
                          color: selected ? AppTheme.accent.withValues(alpha: 0.1) : Colors.transparent,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: ListTile(
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12),
                          title: Text(entry.$2, style: TextStyle(color: context.appColors.textPrimary, fontWeight: selected ? FontWeight.w600 : FontWeight.normal)),
                          trailing: Text(
                            '${counts[entry.$1] ?? 0}',
                            style: TextStyle(color: context.appColors.textMuted),
                          ),
                          leading: Icon(
                            selected ? Icons.radio_button_checked : Icons.radio_button_off,
                            color: selected ? AppTheme.accent : context.appColors.textMuted,
                          ),
                          onTap: () => setSheetState(() => draft = entry.$1),
                        ),
                      );
                    }),
                    const SizedBox(height: 12),
                    ElevatedButton(
                      onPressed: () {
                        setState(() => _statusFilter = draft);
                        Navigator.pop(ctx);
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.accent,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: const Text('Apply', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Color _statusColor(ListingUiStatus status) {
    switch (status) {
      case ListingUiStatus.active:
        return Colors.green;
      case ListingUiStatus.inactive:
        return Colors.orange;
      case ListingUiStatus.draft:
        return Colors.grey;
    }
  }

  String _statusLabel(ListingUiStatus status) {
    switch (status) {
      case ListingUiStatus.active:
        return 'Active';
      case ListingUiStatus.inactive:
        return 'Inactive';
      case ListingUiStatus.draft:
        return 'Draft';
    }
  }

  Future<void> _openCreateListing() async {
    final pending =
        Provider.of<VendorProfileProvider>(context, listen: false).isPending;
    if (pending) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Available once your account is approved.'),
        ),
      );
      return;
    }
    final isChemicalTab = _tabController.index == 1;
    final result = await Navigator.of(context).push<String>(
      MaterialPageRoute(
        builder: (_) => ListingTypePickerScreen(
          suggestedChemical: isChemicalTab,
        ),
      ),
    );
    if (!mounted) return;
    await _load();
    if (result != null && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Listing saved')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<VendorCatalogProvider>(context);
    final pending = Provider.of<VendorProfileProvider>(context).isPending;
    final isChemicalTab = _tabController.index == 1;
    final filtered = _filtered(provider.listingRows, isChemicalTab);
    final counts = _statusCounts(provider.listingRows, isChemicalTab);
    final statusLabel =
        _statusFilters.firstWhere((e) => e.$1 == _statusFilter).$2;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Products'),
        actions: [
          IconButton(
            onPressed: pending ? null : _openCreateListing,
            tooltip: pending
                ? 'Available once your account is approved'
                : 'New listing',
            icon: const Icon(Icons.add),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          onTap: (_) => setState(() {}),
          tabs: [
            Tab(
              text:
                  'Equipment (${provider.listingRows.where((r) => !r.isChemical).length})',
            ),
            Tab(
              text:
                  'Chemicals (${provider.listingRows.where((r) => r.isChemical).length})',
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: pending ? null : _openCreateListing,
        backgroundColor: const Color(0xFF6C63FF),
        icon: const Icon(Icons.add),
        label: const Text('New listing'),
      ),
      body: RefreshIndicator(
        color: const Color(0xFF6C63FF),
        onRefresh: () => _load(),
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: TextField(
                controller: _searchController,
                style: TextStyle(color: context.appColors.textPrimary),
                decoration: InputDecoration(
                  hintText: 'Search title or category…',
                  hintStyle: TextStyle(color: context.appColors.textMuted),
                  prefixIcon: Icon(Icons.search, color: context.appColors.textMuted),
                  filled: true,
                  fillColor: context.appColors.surface,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide.none,
                  ),
                  contentPadding: const EdgeInsets.symmetric(vertical: 0),
                ),
                onChanged: (v) => setState(() => _searchQuery = v),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _openStatusFilter(counts),
                      icon: Icon(Icons.filter_list, size: 18, color: context.appColors.textSecondary),
                      label: Text('Status: $statusLabel'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: context.appColors.textSecondary,
                        side: BorderSide(color: context.appColors.border),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  FilterChip(
                    label: const Text('Favorites'),
                    selected: _favoritesOnly,
                    onSelected: (v) => setState(() => _favoritesOnly = v),
                    selectedColor: const Color(0xFF6C63FF).withValues(alpha: 0.35),
                    checkmarkColor: _favoritesOnly ? Colors.white : context.appColors.textSecondary,
                    labelStyle: TextStyle(
                      color: _favoritesOnly ? Colors.white : context.appColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: provider.loading && provider.listingRows.isEmpty
                  ? const Center(
                      child: CircularProgressIndicator(color: Color(0xFF6C63FF)),
                    )
                  : provider.error != null && provider.listingRows.isEmpty
                      ? ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: [
                            const SizedBox(height: 80),
                            Padding(
                              padding: const EdgeInsets.all(24),
                              child: Text(
                                provider.error!,
                                textAlign: TextAlign.center,
                                style: const TextStyle(color: Colors.redAccent),
                              ),
                            ),
                          ],
                        )
                      : filtered.isEmpty
                          ? ListView(
                              physics: const AlwaysScrollableScrollPhysics(),
                              children: [
                                const SizedBox(height: 80),
                                Icon(Icons.inventory_2_outlined,
                                    size: 48, color: context.appColors.textMuted),
                                const SizedBox(height: 12),
                                Text(
                                  'No listings match your filters.',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(color: context.appColors.textMuted),
                                ),
                              ],
                            )
                          : ListView.separated(
                              physics: const AlwaysScrollableScrollPhysics(),
                              padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                              itemCount: filtered.length,
                              separatorBuilder: (context, index) =>
                                  const SizedBox(height: 10),
                              itemBuilder: (context, index) {
                                final row = filtered[index];
                                return _ProductCard(
                                  row: row,
                                  statusColor: _statusColor(row.status),
                                  statusLabel: _statusLabel(row.status),
                                  onTap: () {
                                    Navigator.of(context).push(
                                      MaterialPageRoute(
                                        builder: (_) =>
                                            ProductDetailScreen(listingId: row.listing.id),
                                      ),
                                    );
                                  },
                                );
                              },
                            ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProductCard extends StatelessWidget {
  final VendorListingRow row;
  final Color statusColor;
  final String statusLabel;
  final VoidCallback onTap;

  const _ProductCard({
    required this.row,
    required this.statusColor,
    required this.statusLabel,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final listing = row.listing;
    final priceLine = row.isChemical
        ? _chemicalPrice(row)
        : '₹${listing.dailyRent.toStringAsFixed(0)}/day · Qty ${row.quantity}';

    return Material(
      color: context.appColors.surface,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: context.appColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      row.productName.trim().isNotEmpty
                          ? row.productName
                          : listing.listingTitle,
                      style: TextStyle(
                        color: context.appColors.textPrimary,
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                      ),
                    ),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      statusLabel,
                      style: TextStyle(
                        color: statusColor,
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                row.categoryName,
                style: TextStyle(color: context.appColors.textMuted, fontSize: 13),
              ),
              const SizedBox(height: 8),
              Text(
                priceLine,
                style: const TextStyle(
                  color: Color(0xFF6C63FF),
                  fontWeight: FontWeight.w600,
                ),
              ),
              if (listing.favoriteCount > 0) ...[
                const SizedBox(height: 8),
                Text(
                  '❤ ${listing.favoriteCount} favorites',
                  style: const TextStyle(color: Colors.pinkAccent, fontSize: 12),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  String _chemicalPrice(VendorListingRow row) {
    final min = row.buyPriceMin;
    final max = row.buyPriceMax;
    if (min != null && max != null && min != max) {
      return '₹${min.toStringAsFixed(0)}–${max.toStringAsFixed(0)} · Qty ${row.quantity}';
    }
    if (min != null) {
      return '₹${min.toStringAsFixed(0)} · Qty ${row.quantity}';
    }
    return 'Qty ${row.quantity}';
  }
}
