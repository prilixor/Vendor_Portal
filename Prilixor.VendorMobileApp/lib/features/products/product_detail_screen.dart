import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/models/vendor_catalog_model.dart';
import '../../core/providers/vendor_catalog_provider.dart';
import '../../core/providers/vendor_profile_provider.dart';
import '../../core/utils/media_url.dart';
import '../../shared/widgets/admin_sizing_pricing.dart';
import '../../shared/widgets/catalog_image.dart';
import '../../shared/widgets/catalog_image_viewer_screen.dart';
import '../inventory/inventory_detail_screen.dart';
import '../../core/theme.dart';
import 'edit_listing_screen.dart';

class ProductDetailScreen extends StatefulWidget {
  final String listingId;

  const ProductDetailScreen({super.key, required this.listingId});

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> {
  Future<void> _toggleStatus(VendorListingRow row, bool active) async {
    final vendorId =
        Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    final pending =
        Provider.of<VendorProfileProvider>(context, listen: false).isPending;
    if (pending) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Account pending approval — some actions are limited.'),
        ),
      );
    }
    final provider =
        Provider.of<VendorCatalogProvider>(context, listen: false);
    final ok = await provider.updateListingStatus(
      vendorId: vendorId,
      row: row,
      newStatus: active ? ListingUiStatus.active : ListingUiStatus.inactive,
    );
    if (!mounted) return;
    if (!ok && provider.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(provider.error!), backgroundColor: Colors.redAccent),
      );
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

  Future<void> _deleteListing(VendorListingRow row) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.card(context),
        title: Text('Delete listing?', style: TextStyle(color: context.appColors.textPrimary)),
        content: Text(
          'Delete "${row.productName.trim().isNotEmpty ? row.productName : row.listing.listingTitle}"? This cannot be undone.',
          style: TextStyle(color: context.appColors.textSecondary),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    final vendorId =
        Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    final catalog =
        Provider.of<VendorCatalogProvider>(context, listen: false);
    final ok = await catalog.deleteListing(
      vendorId: vendorId,
      listingId: widget.listingId,
    );
    if (!mounted) return;
    if (ok) {
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Listing deleted.')),
      );
    } else if (catalog.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(catalog.error!),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  Future<void> _openEdit(VendorListingRow row) async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => EditListingScreen(listingId: widget.listingId),
      ),
    );
    if (changed == true && mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<VendorCatalogProvider>(context);
    final row = provider.rowForListing(widget.listingId);
    if (row == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Product')),
        body: Center(child: Text('Listing not found.', style: TextStyle(color: context.appColors.textMuted))),
      );
    }

    final listing = row.listing;
    CatalogProduct? catalogProduct;
    for (final p in provider.products) {
      if (p.id == listing.productId) {
        catalogProduct = p;
        break;
      }
    }
    final inventory = provider.inventoryForListing(widget.listingId);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          row.productName.trim().isNotEmpty
              ? row.productName
              : listing.listingTitle,
        ),
        actions: [
          IconButton(
            tooltip: 'Edit listing',
            onPressed: provider.saving ? null : () => _openEdit(row),
            icon: const Icon(Icons.edit_outlined),
          ),
          IconButton(
            tooltip: 'Delete listing',
            onPressed: provider.saving ? null : () => _deleteListing(row),
            icon: const Icon(Icons.delete_outline, color: Colors.redAccent),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _ListingHeroCarousel(
            images: catalogProduct?.images ?? const [],
            fallbackImageUrl: row.primaryImageUrl,
          ),
          const SizedBox(height: 16),
          _ListingDetailsPanel(
            row: row,
            listing: listing,
            catalogProduct: catalogProduct,
            statusLabel: _statusLabel(row.status),
          ),
          const SizedBox(height: 12),
          _CatalogMediaCard(
            images: catalogProduct?.images ?? const [],
            documents: catalogProduct?.documents ?? const [],
          ),
          const SizedBox(height: 12),
          SwitchListTile(
            tileColor: AppTheme.card(context),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(color: context.appColors.border),
            ),
            title: Text('Listing active', style: TextStyle(color: context.appColors.textPrimary)),
            subtitle: Text(
              'Inactive listings are hidden from customers.',
              style: TextStyle(color: context.appColors.textMuted, fontSize: 12),
            ),
            value: row.status == ListingUiStatus.active,
            activeThumbColor: AppTheme.accent,
            onChanged: provider.saving
                ? null
                : (v) => _toggleStatus(row, v),
          ),
          const SizedBox(height: 12),
          if (inventory != null)
            OutlinedButton.icon(
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) =>
                        InventoryDetailScreen(listingId: widget.listingId),
                  ),
                );
              },
              icon: const Icon(Icons.inventory_2_outlined),
              label: const Text('Manage inventory'),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
                foregroundColor: context.appColors.textPrimary,
                side: BorderSide(color: context.appColors.border),
              ),
            ),
        ],
      ),
    );
  }
}

class _ListingHeroCarousel extends StatefulWidget {
  final List<CatalogProductImage> images;
  final String? fallbackImageUrl;

  const _ListingHeroCarousel({
    required this.images,
    this.fallbackImageUrl,
  });

  @override
  State<_ListingHeroCarousel> createState() => _ListingHeroCarouselState();
}

class _ListingHeroCarouselState extends State<_ListingHeroCarousel> {
  late final PageController _pageController;
  int _index = 0;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  List<String> get _imageUrls {
    final sorted = [...widget.images]..sort((a, b) {
        final primaryDelta = (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0);
        if (primaryDelta != 0) return primaryDelta;
        return a.displayOrder.compareTo(b.displayOrder);
      });
    final urls = sorted
        .map((image) => image.displayUrl.trim())
        .where((url) => url.isNotEmpty)
        .toList();
    if (urls.isNotEmpty) return urls;

    final fallback = widget.fallbackImageUrl?.trim();
    if (fallback != null && fallback.isNotEmpty) return [fallback];
    return const [];
  }

  void _openImageGallery() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => CatalogImageViewerScreen(
          imageUrls: _imageUrls,
          initialIndex: _index,
          title: 'Catalog photos',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final urls = _imageUrls;
    if (urls.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
        decoration: BoxDecoration(
          color: context.appColors.surfaceElevated,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: context.appColors.border),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.image_outlined, size: 36, color: context.appColors.textMuted),
            const SizedBox(height: 8),
            Text(
              'No catalog photo yet',
              style: TextStyle(color: context.appColors.textPrimary, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 4),
            Text(
              'Photos are uploaded by Admin.',
              style: TextStyle(color: context.appColors.textMuted, fontSize: 12),
            ),
          ],
        ),
      );
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: AspectRatio(
        aspectRatio: 16 / 9,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: context.appColors.surfaceElevated,
            border: Border.all(color: context.appColors.border.withValues(alpha: 0.65)),
          ),
          child: Stack(
            fit: StackFit.expand,
            children: [
              GestureDetector(
                onTap: _openImageGallery,
                child: Padding(
                  padding: const EdgeInsets.all(10),
                  child: urls.length == 1
                      ? CatalogImage(url: urls.first, fit: BoxFit.contain)
                      : PageView.builder(
                          controller: _pageController,
                          itemCount: urls.length,
                          onPageChanged: (index) => setState(() => _index = index),
                          itemBuilder: (_, index) => CatalogImage(
                            url: urls[index],
                            fit: BoxFit.contain,
                          ),
                        ),
                ),
              ),
            if (urls.length > 1) ...[
              Positioned(
                top: 10,
                right: 10,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.55),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    '${_index + 1}/${urls.length}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
              Positioned(
                left: 0,
                right: 0,
                bottom: 10,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(urls.length, (index) {
                    final selected = index == _index;
                    return AnimatedContainer(
                      duration: const Duration(milliseconds: 180),
                      margin: const EdgeInsets.symmetric(horizontal: 3),
                      width: selected ? 18 : 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: selected ? AppTheme.accent : Colors.white.withValues(alpha: 0.55),
                        borderRadius: BorderRadius.circular(999),
                      ),
                    );
                  }),
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

class _CatalogMediaCard extends StatelessWidget {
  final List<CatalogProductImage> images;
  final List<CatalogProductDocument> documents;

  const _CatalogMediaCard({
    required this.images,
    required this.documents,
  });

  List<CatalogProductImage> get _sortedImages {
    final copy = [...images];
    copy.sort((a, b) {
      final primaryDelta = (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0);
      if (primaryDelta != 0) return primaryDelta;
      return a.displayOrder.compareTo(b.displayOrder);
    });
    return copy;
  }

  String _summary(int photoCount, int docCount) {
    final parts = <String>[];
    if (photoCount > 0) parts.add('$photoCount photo${photoCount == 1 ? '' : 's'}');
    if (docCount > 0) parts.add('$docCount document${docCount == 1 ? '' : 's'}');
    return parts.join(' · ');
  }

  Future<void> _openDocument(CatalogProductDocument doc) async {
    final url = resolveMediaUrl(doc.fileUrl);
    if (url == null) return;
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  void _openImageGallery(BuildContext context, int initialIndex) {
    final sortedImages = _sortedImages;
    final urls = sortedImages
        .map((image) => image.displayUrl.trim())
        .where((url) => url.isNotEmpty)
        .toList();
    if (urls.isEmpty) return;

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => CatalogImageViewerScreen(
          imageUrls: urls,
          initialIndex: initialIndex.clamp(0, urls.length - 1),
          title: 'Catalog photos',
        ),
      ),
    );
  }

  void _showMediaSheet(BuildContext context) {
    final sortedImages = _sortedImages;
    final hasImages = sortedImages.isNotEmpty;
    final hasDocs = documents.isNotEmpty;

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.card(context),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.82,
          minChildSize: 0.45,
          maxChildSize: 0.95,
          builder: (context, scrollController) {
            Widget photosGrid() {
              return GridView.builder(
                controller: scrollController,
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  crossAxisSpacing: 10,
                  mainAxisSpacing: 10,
                  childAspectRatio: 1,
                ),
                itemCount: sortedImages.length,
                itemBuilder: (context, index) {
                  final image = sortedImages[index];
                  return GestureDetector(
                    onTap: () => _openImageGallery(context, index),
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: CatalogImage(url: image.displayUrl, fit: BoxFit.cover),
                        ),
                        if (image.isPrimary)
                          Positioned(
                            top: 8,
                            left: 8,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: AppTheme.accent,
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: const Text(
                                'Primary',
                                style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                              ),
                            ),
                          ),
                      ],
                    ),
                  );
                },
              );
            }

            Widget docsList() {
              return ListView(
                controller: scrollController,
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                children: documents.map((doc) {
                  return Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    decoration: BoxDecoration(
                      color: AppTheme.card(context),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: context.appColors.border),
                    ),
                    child: ListTile(
                      leading: const Icon(Icons.description_outlined, color: AppTheme.accent),
                      title: Text(doc.label, style: TextStyle(color: context.appColors.textPrimary, fontWeight: FontWeight.w700)),
                      trailing: Icon(Icons.open_in_new, color: context.appColors.textSecondary),
                      onTap: () => _openDocument(doc),
                    ),
                  );
                }).toList(),
              );
            }

            return Column(
              children: [
                const SizedBox(height: 8),
                Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: context.appColors.border,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Catalog media',
                        style: TextStyle(color: context.appColors.textPrimary, fontWeight: FontWeight.w700, fontSize: 18),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Uploaded by Admin. View only.',
                        style: TextStyle(color: context.appColors.textMuted, fontSize: 12),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: hasImages && hasDocs
                      ? DefaultTabController(
                          length: 2,
                          child: Column(
                            children: [
                              TabBar(
                                labelColor: AppTheme.accent,
                                unselectedLabelColor: context.appColors.textMuted,
                                indicatorColor: AppTheme.accent,
                                tabs: [
                                  Tab(text: 'Photos (${sortedImages.length})'),
                                  Tab(text: 'Documents (${documents.length})'),
                                ],
                              ),
                              Expanded(
                                child: TabBarView(
                                  children: [photosGrid(), docsList()],
                                ),
                              ),
                            ],
                          ),
                        )
                      : hasImages
                          ? photosGrid()
                          : docsList(),
                ),
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final sortedImages = _sortedImages;
    final hasImages = sortedImages.isNotEmpty;
    final hasDocs = documents.isNotEmpty;
    final previewThumbs = sortedImages.take(4).toList();

    if (!hasImages && !hasDocs) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: AppTheme.card(context),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: context.appColors.border),
        ),
        child: Text(
          'No catalog photos or documents from Admin yet.',
          style: TextStyle(color: context.appColors.textMuted, fontSize: 13),
        ),
      );
    }

    return Material(
      color: AppTheme.card(context),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => _showMediaSheet(context),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: context.appColors.border),
          ),
          child: Row(
            children: [
              if (previewThumbs.isNotEmpty)
                SizedBox(
                  width: 28.0 + (previewThumbs.length - 1) * 18,
                  height: 40,
                  child: Stack(
                    children: [
                      for (var i = 0; i < previewThumbs.length; i++)
                        Positioned(
                          left: i * 18.0,
                          child: Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: AppTheme.card(context), width: 2),
                            ),
                            clipBehavior: Clip.antiAlias,
                            child: CatalogImage(url: previewThumbs[i].displayUrl, fit: BoxFit.cover),
                          ),
                        ),
                    ],
                  ),
                )
              else
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppTheme.accent.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.description_outlined, color: AppTheme.accent),
                ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          'Catalog media',
                          style: TextStyle(color: context.appColors.textPrimary, fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: context.appColors.border.withValues(alpha: 0.35),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text('Read-only', style: TextStyle(color: context.appColors.textSecondary, fontSize: 10)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _summary(sortedImages.length, documents.length),
                      style: TextStyle(color: context.appColors.textMuted, fontSize: 12),
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: context.appColors.textSecondary),
            ],
          ),
        ),
      ),
    );
  }
}

class _ListingDetailsPanel extends StatelessWidget {
  final VendorListingRow row;
  final VendorProductListing listing;
  final CatalogProduct? catalogProduct;
  final String statusLabel;

  const _ListingDetailsPanel({
    required this.row,
    required this.listing,
    required this.catalogProduct,
    required this.statusLabel,
  });

  String _money(double value) => '₹${value.toStringAsFixed(0)}';

  String _moneyOrDash(double? value) {
    if (value == null || value <= 0) return '—';
    return _money(value);
  }

  List<String> get _modes {
    final modes = <String>[
      if (catalogProduct?.isRentEnabled == true) 'Rent',
      if (catalogProduct?.isBuyEnabled == true) 'Buy',
    ];
    return modes;
  }

  @override
  Widget build(BuildContext context) {
    final modes = _modes;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            _StatusChip(status: row.status, label: statusLabel),
            _MetaChip(
              icon: row.isChemical ? Icons.science_outlined : Icons.medical_services_outlined,
              label: row.isChemical ? 'Chemical' : 'Equipment',
            ),
            if (modes.isNotEmpty)
              ...modes.map((mode) => _MetaChip(
                    icon: mode == 'Rent' ? Icons.event_repeat_outlined : Icons.shopping_bag_outlined,
                    label: mode,
                  )),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _QuickStatTile(
                icon: Icons.inventory_2_outlined,
                label: 'Quantity',
                value: '${row.quantity}',
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _QuickStatTile(
                icon: Icons.percent_outlined,
                label: 'GST',
                value: catalogProduct != null
                    ? '${catalogProduct!.gstPercent.toStringAsFixed(0)}%'
                    : '—',
              ),
            ),
            if (listing.favoriteCount > 0) ...[
              const SizedBox(width: 10),
              Expanded(
                child: _QuickStatTile(
                  icon: Icons.favorite_border_rounded,
                  label: 'Favorites',
                  value: '${listing.favoriteCount}',
                  accent: const Color(0xFFEC4899),
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 12),
        _DetailSection(
          title: 'Product',
          icon: Icons.category_outlined,
          children: [
            _DetailRow(label: 'Catalog product', value: row.productName),
            _DetailRow(label: 'Category', value: row.categoryName),
            if (catalogProduct != null)
              _DetailRow(
                label: 'Modes',
                value: modes.isEmpty ? 'Off' : modes.join(' + '),
              ),
          ],
        ),
        if (row.isChemical) ...[
          const SizedBox(height: 10),
          _DetailSection(
            title: 'Admin sizing & pricing',
            icon: Icons.payments_outlined,
            badge: 'Read-only',
            children: [
              AdminSizingPricingBody(product: catalogProduct),
            ],
          ),
        ] else ...[
          const SizedBox(height: 10),
          _DetailSection(
            title: 'Customer pricing',
            icon: Icons.payments_outlined,
            badge: 'Read-only',
            children: [
              _DetailRow(
                label: 'Daily rate',
                value: _money(catalogProduct?.dailyRent ?? listing.dailyRent),
              ),
              _DetailRow(
                label: 'Deposit',
                value: _money(catalogProduct?.securityDeposit ?? listing.securityDeposit),
              ),
              _DetailRow(
                label: 'Buy price',
                value: _moneyOrDash(catalogProduct?.buyPrice),
              ),
            ],
          ),
          const SizedBox(height: 10),
          _DetailSection(
            title: 'Your pricing',
            icon: Icons.storefront_outlined,
            children: [
              _DetailRow(
                label: 'Daily rate',
                value: _money(catalogProduct?.vendorDailyRent ?? 0),
              ),
              _DetailRow(
                label: 'Buy price',
                value: _moneyOrDash(catalogProduct?.vendorBuyPrice),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

class _StatusChip extends StatelessWidget {
  final ListingUiStatus status;
  final String label;

  const _StatusChip({required this.status, required this.label});

  Color _tone() {
    switch (status) {
      case ListingUiStatus.active:
        return const Color(0xFF22C55E);
      case ListingUiStatus.inactive:
        return const Color(0xFF94A3B8);
      case ListingUiStatus.draft:
        return const Color(0xFFF59E0B);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tone = _tone();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: tone.withValues(alpha: context.isDarkMode ? 0.18 : 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: tone.withValues(alpha: 0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(color: tone, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              color: tone,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  final IconData icon;
  final String label;

  const _MetaChip({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: colors.surfaceElevated,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: colors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: colors.textSecondary),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              color: colors.textPrimary,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _QuickStatTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color? accent;

  const _QuickStatTile({
    required this.icon,
    required this.label,
    required this.value,
    this.accent,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final tone = accent ?? AppTheme.accent;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(
        color: AppTheme.card(context),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: tone.withValues(alpha: 0.9)),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              color: colors.textPrimary,
              fontWeight: FontWeight.w800,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(color: colors.textMuted, fontSize: 11),
          ),
        ],
      ),
    );
  }
}

class _DetailSection extends StatelessWidget {
  final String title;
  final IconData icon;
  final String? badge;
  final List<Widget> children;

  const _DetailSection({
    required this.title,
    required this.icon,
    required this.children,
    this.badge,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;

    return Container(
      decoration: BoxDecoration(
        color: AppTheme.card(context),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 10),
            child: Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: AppTheme.accent.withValues(alpha: context.isDarkMode ? 0.18 : 0.1),
                    borderRadius: BorderRadius.circular(9),
                  ),
                  child: Icon(icon, size: 17, color: AppTheme.accent),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    title,
                    style: TextStyle(
                      color: colors.textPrimary,
                      fontWeight: FontWeight.w800,
                      fontSize: 14,
                    ),
                  ),
                ),
                if (badge != null)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: colors.surfaceElevated,
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: colors.border),
                    ),
                    child: Text(
                      badge!,
                      style: TextStyle(
                        color: colors.textSecondary,
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          Divider(height: 1, color: colors.border.withValues(alpha: 0.85)),
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 4, 14, 8),
            child: Column(children: children),
          ),
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;

  const _DetailRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 9),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 5,
            child: Text(
              label,
              style: TextStyle(color: colors.textSecondary, fontSize: 13),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            flex: 6,
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: TextStyle(
                color: colors.textPrimary,
                fontWeight: FontWeight.w700,
                fontSize: 13,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
