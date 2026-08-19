import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/models/vendor_catalog_model.dart';
import '../../core/providers/vendor_catalog_provider.dart';
import '../../core/providers/vendor_profile_provider.dart';
import '../../core/theme.dart';
import '../../shared/widgets/brand_page_loader.dart';

class ListingAssetsScreen extends StatefulWidget {
  final String listingId;
  final String productName;
  final bool isChemical;

  const ListingAssetsScreen({
    super.key,
    required this.listingId,
    required this.productName,
    required this.isChemical,
  });

  @override
  State<ListingAssetsScreen> createState() => _ListingAssetsScreenState();
}

class _ListingAssetsScreenState extends State<ListingAssetsScreen> {
  List<VendorProductAsset> _assets = const [];
  bool _loading = true;
  final _tagController = TextEditingController();
  final _conditionController = TextEditingController();
  String? _variantId;

  @override
  void dispose() {
    _tagController.dispose();
    _conditionController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final vendorId =
        Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    setState(() => _loading = true);
    final assets = await Provider.of<VendorCatalogProvider>(context,
            listen: false)
        .fetchListingAssets(vendorId, widget.listingId);
    if (!mounted) return;
    setState(() {
      _assets = assets;
      _loading = false;
    });
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  List<VariantInventoryRow> _variants() {
    return Provider.of<VendorCatalogProvider>(context, listen: false)
        .variantInventoryFor(widget.listingId);
  }

  Future<void> _addAsset() async {
    final tag = _tagController.text.trim();
    if (tag.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(widget.isChemical
              ? 'Enter a batch/serial number.'
              : 'Enter a serial number.'),
        ),
      );
      return;
    }
    if (widget.isChemical && (_variantId == null || _variantId!.isEmpty)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Select a packaging size.')),
      );
      return;
    }

    final pending =
        Provider.of<VendorProfileProvider>(context, listen: false).isPending;
    if (pending) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Account pending approval — changes are disabled.'),
        ),
      );
      return;
    }

    final vendorId =
        Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    final provider =
        Provider.of<VendorCatalogProvider>(context, listen: false);
    final ok = await provider.addListingAsset(
      vendorId: vendorId,
      listingId: widget.listingId,
      assetTag: tag,
      condition: _conditionController.text.trim(),
      productVariantId: widget.isChemical ? _variantId : null,
    );
    if (!mounted) return;
    if (ok) {
      _tagController.clear();
      _conditionController.clear();
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(widget.isChemical
              ? 'Batch/serial added.'
              : 'Serial number added.'),
        ),
      );
    } else if (provider.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(provider.error!),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  Future<void> _deleteAsset(VendorProductAsset asset) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.card(context),
        title: Text('Remove serial?', style: TextStyle(color: context.appColors.textPrimary)),
        content: Text(
          'Remove ${asset.assetTag}?',
          style: TextStyle(color: context.appColors.textSecondary),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
            child: const Text('Remove'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    final vendorId =
        Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    final provider =
        Provider.of<VendorCatalogProvider>(context, listen: false);
    final ok = await provider.deleteListingAsset(
      vendorId: vendorId,
      listingId: widget.listingId,
      assetId: asset.id,
    );
    if (!mounted) return;
    if (ok) {
      await _load();
    } else if (provider.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(provider.error!),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<VendorCatalogProvider>(context);
    final pending = Provider.of<VendorProfileProvider>(context).isPending;
    final variants = _variants();
    final title = widget.isChemical ? 'Batch / serial numbers' : 'Serial numbers';

    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: _loading
          ? const BrandPageLoader()
          : RefreshIndicator(
              color: AppTheme.accent,
              onRefresh: _load,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                children: [
                  Text(
                    widget.productName,
                    style: TextStyle(
                      color: context.appColors.textPrimary,
                      fontWeight: FontWeight.w600,
                      fontSize: 16,
                    ),
                  ),
                  const SizedBox(height: 16),
                  if (!pending) ...[
                    TextField(
                      controller: _tagController,
                      style: TextStyle(color: context.appColors.textPrimary),
                      decoration: InputDecoration(
                        labelText: widget.isChemical
                            ? 'Batch / serial number'
                            : 'Serial number',
                        labelStyle: TextStyle(color: context.appColors.textMuted),
                        filled: true,
                        fillColor: AppTheme.card(context),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(color: context.appColors.border),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(color: context.appColors.border),
                        ),
                      ),
                    ),
                    if (widget.isChemical) ...[
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        initialValue: _variantId,
                        dropdownColor: context.appColors.surface,
                        style: TextStyle(color: context.appColors.textPrimary),
                        decoration: InputDecoration(
                          labelText: 'Packaging size',
                          labelStyle: TextStyle(color: context.appColors.textSecondary),
                          filled: true,
                          fillColor: AppTheme.card(context),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide(color: context.appColors.border),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide(color: context.appColors.border),
                          ),
                        ),
                        items: variants
                            .map(
                              (v) => DropdownMenuItem(
                                value: v.productVariantId,
                                child: Text(v.label, style: TextStyle(color: context.appColors.textPrimary)),
                              ),
                            )
                            .toList(),
                        onChanged: (v) => setState(() => _variantId = v),
                      ),
                    ],
                    const SizedBox(height: 12),
                    TextField(
                      controller: _conditionController,
                      style: TextStyle(color: context.appColors.textPrimary),
                      decoration: InputDecoration(
                        labelText: 'Condition (optional)',
                        labelStyle: TextStyle(color: context.appColors.textMuted),
                        filled: true,
                        fillColor: AppTheme.card(context),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(color: context.appColors.border),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(color: context.appColors.border),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    ElevatedButton.icon(
                      onPressed: provider.saving ? null : _addAsset,
                      icon: const Icon(Icons.add),
                      label: const Text('Add'),
                      style: ElevatedButton.styleFrom(
                        minimumSize: const Size.fromHeight(44),
                        backgroundColor: AppTheme.accent,
                      ),
                    ),
                    const SizedBox(height: 20),
                  ],
                  Text(
                    'Registered (${_assets.length})',
                    style: TextStyle(
                      color: context.appColors.textPrimary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  if (_assets.isEmpty)
                    Text(
                      'No serial numbers registered yet.',
                      style: TextStyle(color: context.appColors.textMuted),
                    )
                  else
                    ..._assets.map(
                      (asset) => Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppTheme.card(context),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: context.appColors.border),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    asset.assetTag,
                                    style: TextStyle(
                                      color: context.appColors.textPrimary,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  Text(
                                    [
                                      asset.status,
                                      if (asset.variantLabel != null &&
                                          asset.variantLabel!.isNotEmpty)
                                        asset.variantLabel,
                                      if (asset.condition != null &&
                                          asset.condition!.isNotEmpty)
                                        asset.condition,
                                    ].join(' · '),
                                    style: TextStyle(
                                      color: context.appColors.textMuted,
                                      fontSize: 12,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            if (!pending)
                              IconButton(
                                onPressed: provider.saving
                                    ? null
                                    : () => _deleteAsset(asset),
                                icon: const Icon(Icons.delete_outline,
                                    color: Colors.redAccent),
                              ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
    );
  }
}
