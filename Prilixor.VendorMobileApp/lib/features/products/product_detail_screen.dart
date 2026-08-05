import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/models/vendor_catalog_model.dart';
import '../../core/providers/vendor_catalog_provider.dart';
import '../../core/providers/vendor_profile_provider.dart';
import '../../core/utils/media_url.dart';
import '../inventory/inventory_detail_screen.dart';
import 'edit_listing_screen.dart';
import 'listing_media_screen.dart';

class ProductDetailScreen extends StatefulWidget {
  final String listingId;

  const ProductDetailScreen({super.key, required this.listingId});

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> {
  List<VendorProductImage> _images = const [];
  bool _imagesLoading = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadImages());
  }

  Future<void> _loadImages() async {
    final vendorId =
        Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    setState(() => _imagesLoading = true);
    final images = await Provider.of<VendorCatalogProvider>(context,
            listen: false)
        .fetchListingImages(vendorId, widget.listingId);
    if (!mounted) return;
    setState(() {
      _images = images;
      _imagesLoading = false;
    });
  }

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
        backgroundColor: const Color(0xFF1E293B),
        title: const Text('Delete listing?', style: TextStyle(color: Colors.white)),
        content: Text(
          'Delete "${row.productName.trim().isNotEmpty ? row.productName : row.listing.listingTitle}"? This cannot be undone.',
          style: const TextStyle(color: Colors.white70),
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

  Future<void> _openMedia(VendorListingRow row) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ListingMediaScreen(
          listingId: widget.listingId,
          listingTitle: row.productName.trim().isNotEmpty
              ? row.productName
              : row.listing.listingTitle,
        ),
      ),
    );
    if (mounted) await _loadImages();
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<VendorCatalogProvider>(context);
    final row = provider.rowForListing(widget.listingId);
    if (row == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Product')),
        body: const Center(child: Text('Listing not found.', style: TextStyle(color: Colors.white54))),
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
    final primary = _images.where((i) => i.isPrimary).firstOrNull ??
        (_images.isNotEmpty ? _images.first : null);
    final imageUrl = resolveMediaUrl(primary?.displayUrl);

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
            tooltip: 'Manage photos & documents',
            onPressed: () => _openMedia(row),
            icon: const Icon(Icons.photo_library_outlined),
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
          if (_imagesLoading)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: CircularProgressIndicator(color: Color(0xFF6C63FF)),
              ),
            )
          else if (imageUrl != null)
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: AspectRatio(
                aspectRatio: 16 / 9,
                child: Image.network(imageUrl, fit: BoxFit.cover),
              ),
            )
          else
            Container(
              height: 140,
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.white12),
              ),
              child: const Center(
                child: Icon(Icons.image_outlined, color: Colors.white24, size: 48),
              ),
            ),
          const SizedBox(height: 16),
          _InfoCard(
            children: [
              _InfoRow(label: 'Catalog product', value: row.productName),
              _InfoRow(label: 'Category', value: row.categoryName),
              _InfoRow(label: 'Type', value: row.isChemical ? 'Chemical' : 'Equipment'),
              _InfoRow(
                label: 'Modes',
                value: () {
                  final modes = <String>[
                    if (catalogProduct?.isRentEnabled == true) 'Rent',
                    if (catalogProduct?.isBuyEnabled == true) 'Buy',
                  ];
                  return modes.isEmpty ? 'Off' : modes.join(' + ');
                }(),
              ),
              if (catalogProduct != null)
                _InfoRow(
                  label: 'GST',
                  value: '${catalogProduct.gstPercent.toStringAsFixed(0)}%',
                ),
              _InfoRow(label: 'Status', value: _statusLabel(row.status)),
              if (!row.isChemical) ...[
                _InfoRow(
                  label: 'Daily rate',
                  value: '₹${(catalogProduct?.dailyRent ?? listing.dailyRent).toStringAsFixed(0)}',
                ),
                _InfoRow(
                  label: 'Deposit',
                  value: '₹${(catalogProduct?.securityDeposit ?? listing.securityDeposit).toStringAsFixed(0)}',
                ),
                _InfoRow(
                  label: 'Buy price',
                  value: catalogProduct?.buyPrice != null && catalogProduct!.buyPrice! > 0
                      ? '₹${catalogProduct.buyPrice!.toStringAsFixed(0)}'
                      : '—',
                ),
                _InfoRow(
                  label: 'Vendor daily rate',
                  value: '₹${(catalogProduct?.vendorDailyRent ?? 0).toStringAsFixed(0)}',
                ),
                _InfoRow(
                  label: 'Vendor buy price',
                  value: catalogProduct?.vendorBuyPrice != null && catalogProduct!.vendorBuyPrice! > 0
                      ? '₹${catalogProduct.vendorBuyPrice!.toStringAsFixed(0)}'
                      : '—',
                ),
              ],
              _InfoRow(label: 'Quantity', value: '${row.quantity}'),
              if (listing.favoriteCount > 0)
                _InfoRow(label: 'Favorites', value: '${listing.favoriteCount}'),
            ],
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: () => _openMedia(row),
            icon: const Icon(Icons.add_photo_alternate_outlined),
            label: Text(_images.isEmpty ? 'Add photos & documents' : 'Photos & documents (${_images.length})'),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(48),
              foregroundColor: Colors.white,
              side: const BorderSide(color: Colors.white24),
            ),
          ),
          const SizedBox(height: 12),
          SwitchListTile(
            tileColor: const Color(0xFF1E293B),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: const BorderSide(color: Colors.white12),
            ),
            title: const Text('Listing active', style: TextStyle(color: Colors.white)),
            subtitle: const Text(
              'Inactive listings are hidden from customers.',
              style: TextStyle(color: Colors.white54, fontSize: 12),
            ),
            value: row.status == ListingUiStatus.active,
            activeThumbColor: const Color(0xFF6C63FF),
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
                foregroundColor: Colors.white,
                side: const BorderSide(color: Colors.white24),
              ),
            ),
        ],
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  final List<Widget> children;
  const _InfoCard({required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white12),
      ),
      child: Column(children: children),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  const _InfoRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(label, style: const TextStyle(color: Colors.white54, fontSize: 13)),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

extension _FirstOrNull<E> on Iterable<E> {
  E? get firstOrNull {
    final it = iterator;
    if (!it.moveNext()) return null;
    return it.current;
  }
}
