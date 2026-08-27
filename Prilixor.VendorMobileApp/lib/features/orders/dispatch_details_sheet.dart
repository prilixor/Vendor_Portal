import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/models/vendor_catalog_model.dart';
import '../../core/providers/vendor_catalog_provider.dart';
import '../../core/theme.dart';

/// Dispatch dialog — optional serial / asset tags before marking in transit (Vendor Web parity).
class DispatchDetailsSheet extends StatefulWidget {
  final String vendorId;
  final String listingId;
  final String listingTitle;
  final int quantity;
  final List<String> existingAssetTags;
  final String? productVariantId;

  const DispatchDetailsSheet({
    super.key,
    required this.vendorId,
    required this.listingId,
    required this.listingTitle,
    required this.quantity,
    this.existingAssetTags = const [],
    this.productVariantId,
  });

  static Future<List<String>?> show(
    BuildContext context, {
    required String vendorId,
    required String listingId,
    required String listingTitle,
    required int quantity,
    List<String> existingAssetTags = const [],
    String? productVariantId,
  }) {
    return showModalBottomSheet<List<String>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => DispatchDetailsSheet(
        vendorId: vendorId,
        listingId: listingId,
        listingTitle: listingTitle,
        quantity: quantity,
        existingAssetTags: existingAssetTags,
        productVariantId: productVariantId,
      ),
    );
  }

  bool get hasPreassignedTags =>
      existingAssetTags.where((t) => t.trim().isNotEmpty).isNotEmpty;

  @override
  State<DispatchDetailsSheet> createState() => _DispatchDetailsSheetState();
}

class _DispatchDetailsSheetState extends State<DispatchDetailsSheet> {
  late final List<TextEditingController> _controllers;
  List<VendorProductAsset> _availableAssets = [];
  bool _loadingAssets = true;
  final Map<int, bool> _openDropdowns = {};

  @override
  void initState() {
    super.initState();
    _controllers = List.generate(
      widget.quantity,
      (_) => TextEditingController(),
    );
    if (!widget.hasPreassignedTags) {
      _loadAssets();
    } else {
      _loadingAssets = false;
    }
  }

  Future<void> _loadAssets() async {
    setState(() {
      _loadingAssets = true;
      _availableAssets = [];
    });
    final assets = await Provider.of<VendorCatalogProvider>(context, listen: false)
        .fetchListingAssets(widget.vendorId, widget.listingId);
    if (!mounted) return;
    setState(() {
      _availableAssets = assets.where((asset) {
        if (asset.listingId != widget.listingId) return false;
        if (asset.status.trim().toLowerCase() != 'available') return false;
        final variantId = widget.productVariantId;
        if (variantId != null &&
            variantId.isNotEmpty &&
            asset.productVariantId != null &&
            asset.productVariantId!.isNotEmpty &&
            asset.productVariantId != variantId) {
          return false;
        }
        return true;
      }).toList();
      _loadingAssets = false;
    });
  }

  @override
  void dispose() {
    for (final c in _controllers) {
      c.dispose();
    }
    super.dispose();
  }

  void _confirm() {
    if (widget.hasPreassignedTags) {
      Navigator.pop(context, <String>[]);
      return;
    }
    final tags = _controllers
        .map((c) => c.text.trim())
        .where((t) => t.isNotEmpty)
        .toList();
    if (_hasDuplicateTags(tags)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Each item needs a unique serial number. Remove duplicates and try again.'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }
    Navigator.pop(context, tags);
  }

  Set<String> _usedTagsFor(int excludeIndex) {
    final used = <String>{};
    for (var i = 0; i < _controllers.length; i++) {
      if (i == excludeIndex) continue;
      final tag = _controllers[i].text.trim().toLowerCase();
      if (tag.isNotEmpty) used.add(tag);
    }
    return used;
  }

  int get _remainingAssetCount {
    final used = _controllers
        .map((c) => c.text.trim().toLowerCase())
        .where((t) => t.isNotEmpty)
        .toSet();
    return _availableAssets
        .where((a) => !used.contains(a.assetTag.trim().toLowerCase()))
        .length;
  }

  bool _hasDuplicateTags(List<String> tags) {
    final seen = <String>{};
    for (final tag in tags) {
      final normalized = tag.trim().toLowerCase();
      if (normalized.isEmpty) continue;
      if (seen.contains(normalized)) return true;
      seen.add(normalized);
    }
    return false;
  }

  List<VendorProductAsset> _matchingAssets(int index) {
    final query = _controllers[index].text.trim().toLowerCase();
    final usedTags = _usedTagsFor(index);
    return _availableAssets.where((asset) {
      final tag = asset.assetTag.trim().toLowerCase();
      if (usedTags.contains(tag)) return false;
      if (query.isNotEmpty && !tag.contains(query)) return false;
      return true;
    }).toList();
  }

  void _selectAsset(int index, String assetTag) {
    _controllers[index].text = assetTag;
    setState(() => _openDropdowns[index] = false);
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    final preassigned = widget.existingAssetTags.where((t) => t.trim().isNotEmpty).toList();

    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: Container(
        margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
        decoration: BoxDecoration(
          color: AppTheme.card(context),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: context.appColors.border),
        ),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 36,
                    height: 4,
                    decoration: BoxDecoration(
                      color: context.appColors.border,
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Dispatch details',
                            style: TextStyle(
                              color: context.appColors.textPrimary,
                              fontWeight: FontWeight.w800,
                              fontSize: 18,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            widget.listingTitle,
                            style: TextStyle(
                              color: context.appColors.textSecondary,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: Icon(Icons.close, color: context.appColors.textMuted),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                if (widget.hasPreassignedTags) ...[
                  Text(
                    'These serial numbers are already assigned to this item. Review and confirm dispatch.',
                    style: TextStyle(
                      color: context.appColors.textSecondary,
                      fontSize: 13,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Container(
                    decoration: BoxDecoration(
                      color: AppTheme.bg(context),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: context.appColors.border),
                    ),
                    child: Column(
                      children: [
                        for (var i = 0; i < preassigned.length; i++) ...[
                          if (i > 0)
                            Divider(
                              height: 1,
                              color: context.appColors.border,
                            ),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                            child: Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: AppTheme.accent.withValues(alpha: 0.15),
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                  child: Text(
                                    'Item ${i + 1}',
                                    style: TextStyle(
                                      color: AppTheme.accent.withValues(alpha: 0.95),
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    preassigned[i],
                                    style: TextStyle(
                                      color: context.appColors.textPrimary,
                                      fontWeight: FontWeight.w700,
                                      fontFamily: 'monospace',
                                    ),
                                  ),
                                ),
                                Icon(
                                  Icons.check_circle_outline,
                                  color: context.isDarkMode
                                      ? Colors.greenAccent.withValues(alpha: 0.85)
                                      : const Color(0xFF059669),
                                  size: 20,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ] else ...[
                  Text(
                    'Enter serial numbers or asset tags for ${widget.quantity} '
                    '${widget.quantity == 1 ? 'item' : 'items'} being dispatched. '
                    'Optional — pick from this product\'s stock or type new ones.',
                    style: TextStyle(
                      color: context.appColors.textSecondary,
                      fontSize: 13,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 16),
                  if (_loadingAssets)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 12),
                      child: Center(
                        child: CircularProgressIndicator(color: AppTheme.accent),
                      ),
                    )
                  else ...[
                    if (_availableAssets.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Text(
                          '$_remainingAssetCount of ${_availableAssets.length} serial number(s) still available for ${widget.listingTitle}',
                          style: TextStyle(
                            color: AppTheme.accent.withValues(alpha: 0.9),
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      )
                    else
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Text(
                          'No pre-registered stock for this product. You can type a serial or batch number, or leave blank.',
                          style: TextStyle(
                            color: context.appColors.textMuted,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ...List.generate(widget.quantity, (index) {
                      final matching = _matchingAssets(index);
                      final isOpen = _openDropdowns[index] == true && matching.isNotEmpty;

                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Item ${index + 1} serial number (optional)',
                              style: TextStyle(
                                color: context.appColors.textSecondary,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(height: 6),
                            TextField(
                              controller: _controllers[index],
                              style: TextStyle(color: context.appColors.textPrimary),
                              onChanged: (_) => setState(() {
                                if (_availableAssets.isNotEmpty) {
                                  _openDropdowns[index] = true;
                                }
                              }),
                              onTap: () => setState(() {
                                if (_availableAssets.isNotEmpty) {
                                  _openDropdowns[index] = true;
                                }
                              }),
                              onEditingComplete: () => setState(() => _openDropdowns[index] = false),
                              decoration: InputDecoration(
                                hintText: _availableAssets.isNotEmpty
                                    ? 'Enter or select serial number…'
                                    : 'Enter serial or batch number (optional)…',
                                hintStyle: TextStyle(
                                  color: context.appColors.textMuted,
                                ),
                                filled: true,
                                fillColor: AppTheme.bg(context),
                                suffixIcon: Icon(
                                  Icons.inventory_2_outlined,
                                  color: _availableAssets.isEmpty
                                      ? context.appColors.textMuted
                                      : AppTheme.accent,
                                ),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide: BorderSide(
                                    color: context.appColors.border,
                                  ),
                                ),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide: BorderSide(
                                    color: context.appColors.border,
                                  ),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide: const BorderSide(color: AppTheme.accent),
                                ),
                              ),
                            ),
                            if (isOpen && _availableAssets.isNotEmpty)
                              Container(
                                margin: const EdgeInsets.only(top: 4),
                                constraints: const BoxConstraints(maxHeight: 160),
                                decoration: BoxDecoration(
                                  color: AppTheme.bg(context),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: context.appColors.border,
                                  ),
                                ),
                                child: ListView.separated(
                                  shrinkWrap: true,
                                  padding: EdgeInsets.zero,
                                  itemCount: matching.length,
                                  separatorBuilder: (context, i) => Divider(
                                    height: 1,
                                    color: context.appColors.border,
                                  ),
                                  itemBuilder: (context, i) {
                                    final asset = matching[i];
                                    return ListTile(
                                      dense: true,
                                      title: Text(
                                        asset.assetTag,
                                        style: TextStyle(
                                          color: context.appColors.textPrimary,
                                          fontWeight: FontWeight.w600,
                                          fontSize: 14,
                                        ),
                                      ),
                                      subtitle: asset.condition != null
                                          ? Text(
                                              asset.condition!,
                                              style: TextStyle(
                                                color: context.appColors.textMuted,
                                                fontSize: 11,
                                              ),
                                            )
                                          : null,
                                      onTap: () => _selectAsset(index, asset.assetTag),
                                    );
                                  },
                                ),
                              )
                            else if (_openDropdowns[index] == true &&
                                _availableAssets.isNotEmpty &&
                                _usedTagsFor(index).isNotEmpty &&
                                matching.isEmpty)
                              Padding(
                                padding: const EdgeInsets.only(top: 6),
                                child: Text(
                                  'All remaining serial numbers are already assigned to other items.',
                                  style: TextStyle(
                                    color: context.appColors.textMuted,
                                    fontSize: 11,
                                  ),
                                ),
                              ),
                          ],
                        ),
                      );
                    }),
                  ],
                ],
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(context),
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size.fromHeight(48),
                          foregroundColor: context.appColors.textSecondary,
                          side: BorderSide(color: context.appColors.border),
                        ),
                        child: const Text('Cancel'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      flex: 2,
                      child: ElevatedButton(
                        onPressed: _loadingAssets ? null : _confirm,
                        style: ElevatedButton.styleFrom(
                          minimumSize: const Size.fromHeight(48),
                          backgroundColor: AppTheme.accent,
                        ),
                        child: const Text(
                          'Confirm dispatch',
                          style: TextStyle(fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
