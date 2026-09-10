import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/models/vendor_catalog_model.dart';
import '../../core/providers/vendor_catalog_provider.dart';
import '../../core/providers/vendor_profile_provider.dart';
import '../../core/theme.dart';
import '../../shared/widgets/brand_page_loader.dart';
import '../../shared/widgets/list_pagination.dart';
import '../../shared/widgets/required_field_ux.dart';

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
  static const _assetsPerPage = 10;

  List<VendorProductAsset> _assets = const [];
  bool _loading = true;
  final _tagController = TextEditingController();
  final _conditionController = TextEditingController();
  final _searchController = TextEditingController();
  String _searchQuery = '';
  String? _variantId;
  String? _tagError;
  String? _variantError;
  int _assetPage = 1;

  @override
  void dispose() {
    _tagController.dispose();
    _conditionController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  List<VendorProductAsset> get _filteredAssets {
    final query = _searchQuery.trim().toLowerCase();
    if (query.isEmpty) return _assets;
    return _assets
        .where((asset) => asset.assetTag.toLowerCase().contains(query))
        .toList();
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
      _assetPage = 1;
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
    final tagMessage = widget.isChemical
        ? 'Please enter a batch/serial number.'
        : 'Please enter a serial number.';
    final tagErr = requiredMessage(tag, message: tagMessage);
    final variantErr = widget.isChemical && (_variantId == null || _variantId!.isEmpty)
        ? 'Please select a packaging size.'
        : null;

    if (tagErr != null || variantErr != null) {
      setState(() {
        _tagError = tagErr;
        _variantError = variantErr;
      });
      showRequiredFieldsBlocked(context);
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
      setState(() {
        _tagError = null;
        _variantError = null;
      });
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
    final filteredAssets = _filteredAssets;
    final assetTotalPages = filteredAssets.isEmpty
        ? 1
        : ((filteredAssets.length + _assetsPerPage - 1) / _assetsPerPage).ceil();
    final safeAssetPage = _assetPage.clamp(1, assetTotalPages);
    final paginatedAssets = filteredAssets.isEmpty
        ? const <VendorProductAsset>[]
        : filteredAssets.sublist(
            (safeAssetPage - 1) * _assetsPerPage,
            (safeAssetPage * _assetsPerPage).clamp(0, filteredAssets.length),
          );

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
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppTheme.card(context),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: context.appColors.border.withValues(alpha: 0.75)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.isChemical
                                ? 'Register new batch / serial'
                                : 'Register new serial',
                            style: TextStyle(
                              color: context.appColors.textPrimary,
                              fontWeight: FontWeight.w700,
                              fontSize: 14,
                            ),
                          ),
                          const SizedBox(height: 10),
                          const RequiredFieldsNote(padding: EdgeInsets.zero),
                          const SizedBox(height: 12),
                          if (widget.isChemical) ...[
                            RequiredLabel(
                              'Packaging size',
                              required: true,
                              style: TextStyle(
                                color: context.appColors.textSecondary,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(height: 6),
                            DropdownButtonFormField<String>(
                              initialValue: _variantId,
                              dropdownColor: context.appColors.surface,
                              style: TextStyle(color: context.appColors.textPrimary),
                              decoration: InputDecoration(
                                hintText: variants.isEmpty
                                    ? 'No packaging sizes / stock yet'
                                    : 'Select packaging size',
                                hintStyle: TextStyle(color: context.appColors.textMuted),
                                filled: true,
                                fillColor: context.appColors.surface,
                                contentPadding:
                                    const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide: BorderSide(
                                    color: _variantError != null
                                        ? kFieldErrorColor
                                        : context.appColors.border,
                                  ),
                                ),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide: BorderSide(
                                    color: _variantError != null
                                        ? kFieldErrorColor
                                        : context.appColors.border,
                                  ),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide: BorderSide(
                                    color: _variantError != null
                                        ? kFieldErrorColor
                                        : AppTheme.accent,
                                    width: 2,
                                  ),
                                ),
                              ),
                              items: variants
                                  .map(
                                    (v) => DropdownMenuItem(
                                      value: v.productVariantId,
                                      child: Text(
                                        v.label,
                                        style:
                                            TextStyle(color: context.appColors.textPrimary),
                                      ),
                                    ),
                                  )
                                  .toList(),
                              onChanged: (v) => setState(() {
                                _variantId = v;
                                _variantError = null;
                              }),
                            ),
                            FieldErrorText(_variantError),
                            const SizedBox(height: 12),
                          ],
                          TextField(
                            controller: _tagController,
                            style: TextStyle(color: context.appColors.textPrimary),
                            textInputAction: TextInputAction.next,
                            onChanged: (_) {
                              if (_tagError != null) setState(() => _tagError = null);
                            },
                            onSubmitted: (_) => _addAsset(),
                            decoration: requiredInputDecoration(
                              context,
                              label: widget.isChemical
                                  ? 'Batch / serial / tag'
                                  : 'Serial number / tag',
                              required: true,
                              errorText: _tagError,
                              hintText: widget.isChemical
                                  ? 'Batch / serial / tag'
                                  : 'Serial number / tag',
                              fillColor: context.appColors.surface,
                            ),
                          ),
                          const SizedBox(height: 12),
                          TextField(
                            controller: _conditionController,
                            style: TextStyle(color: context.appColors.textPrimary),
                            textInputAction: TextInputAction.done,
                            onSubmitted: (_) => _addAsset(),
                            decoration: requiredInputDecoration(
                              context,
                              label: 'Condition',
                              hintText: 'Optional',
                              fillColor: context.appColors.surface,
                            ),
                          ),
                          const SizedBox(height: 14),
                          ElevatedButton.icon(
                            onPressed: provider.saving ? null : _addAsset,
                            icon: const Icon(Icons.add),
                            label: const Text('Add'),
                            style: ElevatedButton.styleFrom(
                              minimumSize: const Size.fromHeight(44),
                              backgroundColor: AppTheme.accent,
                            ),
                          ),
                        ],
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
                  TextField(
                    controller: _searchController,
                    style: TextStyle(color: context.appColors.textPrimary),
                    onChanged: (value) => setState(() {
                      _searchQuery = value;
                      _assetPage = 1;
                    }),
                    decoration: InputDecoration(
                      hintText: widget.isChemical
                          ? 'Search batch / serial...'
                          : 'Search serial numbers...',
                      hintStyle: TextStyle(color: context.appColors.textMuted),
                      prefixIcon: Icon(Icons.search, color: context.appColors.textMuted),
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
                  const SizedBox(height: 10),
                  if (_assets.isEmpty)
                    Text(
                      'No serial numbers registered yet.',
                      style: TextStyle(color: context.appColors.textMuted),
                    )
                  else if (filteredAssets.isEmpty)
                    Text(
                      'No serial numbers match your search.',
                      style: TextStyle(color: context.appColors.textMuted),
                    )
                  else
                    ...paginatedAssets.map(
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
                  if (filteredAssets.isNotEmpty)
                    ListPagination(
                      page: safeAssetPage,
                      pageSize: _assetsPerPage,
                      total: filteredAssets.length,
                      label: widget.isChemical ? 'batch / serial numbers' : 'serial numbers',
                      onPageChange: (page) => setState(() => _assetPage = page),
                    ),
                ],
              ),
            ),
    );
  }
}
