import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/models/vendor_catalog_model.dart';
import '../../core/providers/vendor_catalog_provider.dart';
import '../../core/providers/vendor_profile_provider.dart';
import '../../core/theme.dart';
import '../../shared/widgets/admin_sizing_pricing.dart';
import '../../shared/widgets/chemical_variant_stock_fields.dart';

/// Step 2 — create equipment or chemical listing (web Products create dialog parity).
class CreateListingScreen extends StatefulWidget {
  final bool isChemical;

  const CreateListingScreen({super.key, required this.isChemical});

  @override
  State<CreateListingScreen> createState() => _CreateListingScreenState();
}

class _CreateListingScreenState extends State<CreateListingScreen> {
  final _quantityController = TextEditingController(text: '1');

  String? _categoryId;
  String? _productId;
  String _listingStatus = 'inactive';
  List<ChemicalVariantStockRow> _variantRows = const [];
  String? _categoryError;
  String? _productError;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _ensureCatalogLoaded());
  }

  @override
  void dispose() {
    _quantityController.dispose();
    super.dispose();
  }

  Future<void> _ensureCatalogLoaded() async {
    final vendorId =
        Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    final provider =
        Provider.of<VendorCatalogProvider>(context, listen: false);
    if (provider.categories.isEmpty && !provider.loading) {
      await provider.fetchCatalog(vendorId);
    }
    if (!mounted) return;
    _pickDefaults(provider);
  }

  void _pickDefaults(VendorCatalogProvider provider) {
    final categories = provider.categoriesForTab(widget.isChemical);
    if (categories.isEmpty) return;
    final categoryId = categories.first.id;
    final products = provider.productsForCategory(
      categoryId,
      widget.isChemical,
    );
    setState(() {
      _categoryId = categoryId;
      _productId = products.isNotEmpty ? products.first.id : null;
      _variantRows = _buildVariantRows(provider);
    });
  }

  List<ChemicalVariantStockRow> _buildVariantRows(VendorCatalogProvider provider) {
    final product = _selectedProduct(provider);
    if (product == null) return const [];
    return product.variants
        .where((v) => v.isActive && (v.id ?? '').isNotEmpty)
        .map(ChemicalVariantStockRow.fromCatalogVariant)
        .toList();
  }

  CatalogProduct? _selectedProduct(VendorCatalogProvider provider) {
    if (_productId == null) return null;
    for (final p in provider.products) {
      if (p.id == _productId) return p;
    }
    return null;
  }

  Future<void> _save() async {
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

    setState(() {
      _categoryError =
          (_categoryId == null || _categoryId!.isEmpty) ? 'Select a category.' : null;
      _productError =
          (_productId == null || _productId!.isEmpty) ? 'Select a product.' : null;
    });
    if (_categoryError != null || _productError != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please fill in the required fields.')),
      );
      return;
    }

    final vendorId =
        Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;

    final provider =
        Provider.of<VendorCatalogProvider>(context, listen: false);
    final product = _selectedProduct(provider)!;
    final hasVariants = product.variants.isNotEmpty;

    if (widget.isChemical && hasVariants && _variantRows.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'No active packaging sizes on this product. Ask Admin to add variants.',
          ),
        ),
      );
      return;
    }

    final variantStocks = {
      for (final row in _variantRows) row.productVariantId: row.total,
    };
    final chemicalQty = _variantRows.fold<int>(0, (sum, row) => sum + row.total);
    final equipmentQty = int.tryParse(_quantityController.text.trim()) ?? 1;
    final quantityToSave = widget.isChemical
        ? (hasVariants ? chemicalQty : equipmentQty)
        : equipmentQty;

    final listingId = await provider.createListing(
      vendorId: vendorId,
      productId: _productId!,
      listingTitle: product.productName,
      availableQuantity: quantityToSave.clamp(0, 1 << 30),
      listingStatus: _listingStatus,
      variantStocks: variantStocks,
      variants: product.variants,
      seedVariantInventory:
          widget.isChemical && hasVariants && _variantRows.isNotEmpty,
    );

    if (!mounted) return;
    if (listingId != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Listing saved')),
      );
      Navigator.pop(context, listingId);
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
    final categories = provider.categoriesForTab(widget.isChemical);
    final products = _categoryId == null
        ? const <CatalogProduct>[]
        : provider.productsForCategory(_categoryId!, widget.isChemical);
    final selectedProduct = _selectedProduct(provider);
    final hasVariants = (selectedProduct?.variants ?? const [])
        .where((v) => v.isActive && (v.id ?? '').isNotEmpty)
        .isNotEmpty;

    final typeColor =
        widget.isChemical ? const Color(0xFF34D399) : const Color(0xFF60A5FA);
    final modes = <String>[
      if (selectedProduct?.isRentEnabled == true) 'Rent',
      if (selectedProduct?.isBuyEnabled == true) 'Buy',
    ];
    final modesLabel = modes.isEmpty ? 'Off' : modes.join(' + ');
    final gst = selectedProduct?.gstPercent;
    final typeLabel = widget.isChemical
        ? 'Chemical · $modesLabel'
        : 'Equipment · $modesLabel${gst != null ? ' · GST ${gst.toStringAsFixed(0)}%' : ''}';
    final typeIcon =
        widget.isChemical ? Icons.science_outlined : Icons.medical_services_outlined;

    return Scaffold(
      backgroundColor: AppTheme.bg(context),
      appBar: AppBar(
        title: Text(widget.isChemical ? 'New chemical listing' : 'New equipment listing'),
        centerTitle: true,
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 20),
              children: [
                _TypeBanner(
                  label: typeLabel,
                  icon: typeIcon,
                  color: typeColor,
                  onChangeType: () => Navigator.of(context).pop(),
                ),
                if (pending) ...[
                  const SizedBox(height: 12),
                  _InfoBanner(
                    color: Colors.amber,
                    icon: Icons.hourglass_top_rounded,
                    text:
                        'Your account is pending approval. New listings are disabled until approved.',
                  ),
                ],
                const SizedBox(height: 16),
                _FormSection(
                  title: 'Catalog product',
                  subtitle: 'Pick from Admin catalog — category cannot change after save.',
                  child: Column(
                    children: [
                      _SearchablePickerField(
                        label: 'Category',
                        value: _categoryId,
                        options: categories
                            .map((c) => (id: c.id, label: c.name))
                            .toList(),
                        errorText: _categoryError,
                        enabled: !pending,
                        searchHint: 'Search category…',
                        onChanged: (value) {
                          setState(() {
                            _categoryId = value;
                            final nextProducts = provider.productsForCategory(
                              value,
                              widget.isChemical,
                            );
                            _productId =
                                nextProducts.isNotEmpty ? nextProducts.first.id : null;
                            _variantRows = _buildVariantRows(provider);
                          });
                        },
                      ),
                      const SizedBox(height: 12),
                      _SearchablePickerField(
                        label: 'Product',
                        value: _productId,
                        options: products
                            .map((p) => (id: p.id, label: p.productName))
                            .toList(),
                        errorText: _productError,
                        enabled: !pending,
                        searchHint: 'Search product…',
                        onChanged: (value) {
                          setState(() {
                            _productId = value;
                            _variantRows = _buildVariantRows(provider);
                          });
                        },
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                _FormSection(
                  title: 'Listing details',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _ReadOnlyCatalogName(
                        value: selectedProduct?.productName,
                      ),
                      const SizedBox(height: 14),
                      _DropdownField(
                        label: 'Status',
                        value: _listingStatus,
                        items: const [
                          DropdownMenuItem(value: 'inactive', child: Text('Inactive')),
                          DropdownMenuItem(value: 'active', child: Text('Active')),
                        ],
                        onChanged: pending
                            ? null
                            : (value) => setState(() => _listingStatus = value ?? 'inactive'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                _FormSection(
                  title: widget.isChemical ? 'Initial stock' : 'Quantity',
                  subtitle: widget.isChemical
                      ? 'Units per packaging size. Edit later in Inventory.'
                      : 'Starting quantity. Use Inventory for stock in/out later.',
                  child: widget.isChemical
                      ? (hasVariants
                          ? ChemicalVariantStockFields(
                              rows: _variantRows,
                              onChanged: pending
                                  ? (_) {}
                                  : (rows) => setState(() => _variantRows = rows),
                            )
                          : Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                TextField(
                                  controller: _quantityController,
                                  enabled: !pending,
                                  keyboardType: TextInputType.number,
                                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                                  style: TextStyle(color: context.appColors.textPrimary),
                                  decoration: _inputDecoration(label: 'Quantity'),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  'No packaging sizes on this product yet. Ask Admin to add variants (e.g. 1L, 5L).',
                                  style: TextStyle(
                                    color: context.appColors.textMuted,
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ))
                      : TextField(
                          controller: _quantityController,
                          enabled: !pending,
                          keyboardType: TextInputType.number,
                          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                          style: TextStyle(color: context.appColors.textPrimary),
                          decoration: _inputDecoration(label: 'Quantity'),
                        ),
                ),
                if (selectedProduct != null) ...[
                  const SizedBox(height: 14),
                  _FormSection(
                    title: widget.isChemical ? 'Admin sizing & pricing' : 'Admin pricing',
                    subtitle: 'Read-only — set by platform Admin',
                    trailing: _ReadOnlyBadge(),
                    child: widget.isChemical
                        ? AdminSizingPricingBody(product: selectedProduct)
                        : _EquipmentPricingInfo(product: selectedProduct),
                  ),
                ],
                const SizedBox(height: 12),
              ],
            ),
          ),
          _BottomSaveBar(
            enabled: !pending && !provider.saving,
            saving: provider.saving,
            onSave: _save,
          ),
        ],
      ),
    );
  }

  InputDecoration _inputDecoration({
    required String label,
    String? hint,
    String? errorText,
  }) {
    return InputDecoration(
      labelText: label,
      hintText: hint,
      errorText: errorText,
      labelStyle: TextStyle(color: context.appColors.textSecondary),
      hintStyle: TextStyle(color: context.appColors.textMuted),
      filled: true,
      fillColor: AppTheme.bg(context),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: context.appColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: context.appColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppTheme.accent),
      ),
    );
  }
}

class _TypeBanner extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onChangeType;

  const _TypeBanner({
    required this.label,
    required this.icon,
    required this.color,
    required this.onChangeType,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            color.withValues(alpha: 0.18),
            color.withValues(alpha: 0.06),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: color, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'LISTING TYPE',
                  style: TextStyle(
                    color: context.appColors.textMuted,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.7,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  label,
                  style: TextStyle(
                    color: context.appColors.textPrimary,
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                  ),
                ),
              ],
            ),
          ),
          TextButton(
            onPressed: onChangeType,
            style: TextButton.styleFrom(foregroundColor: color),
            child: const Text('Change', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }
}

class _FormSection extends StatelessWidget {
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final Widget child;

  const _FormSection({
    required this.title,
    this.subtitle,
    this.trailing,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.card(context),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: context.appColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: context.isDarkMode ? 0.18 : 0.04),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  title.toUpperCase(),
                  style: TextStyle(
                    color: context.appColors.textSecondary,
                    fontWeight: FontWeight.w800,
                    fontSize: 11,
                    letterSpacing: 0.8,
                  ),
                ),
              ),
              if (trailing != null) trailing!,
            ],
          ),
          if (subtitle != null) ...[
            const SizedBox(height: 6),
            Text(
              subtitle!,
              style: TextStyle(
                color: context.appColors.textMuted,
                fontSize: 12,
                height: 1.35,
              ),
            ),
          ],
          const SizedBox(height: 14),
          child,
        ],
      ),
    );
  }
}

class _ReadOnlyBadge extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: context.appColors.surface,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: context.appColors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.shield_outlined, size: 12, color: context.appColors.textMuted),
          const SizedBox(width: 4),
          Text(
            'Read-only',
            style: TextStyle(
              color: context.appColors.textSecondary,
              fontSize: 10,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoBanner extends StatelessWidget {
  final Color color;
  final IconData icon;
  final String text;

  const _InfoBanner({
    required this.color,
    required this.icon,
    required this.text,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(text, style: TextStyle(color: color, fontSize: 13)),
          ),
        ],
      ),
    );
  }
}

class _SearchablePickerField extends StatelessWidget {
  final String label;
  final String? value;
  final List<({String id, String label})> options;
  final ValueChanged<String> onChanged;
  final String? errorText;
  final bool enabled;
  final String searchHint;

  const _SearchablePickerField({
    required this.label,
    required this.value,
    required this.options,
    required this.onChanged,
    required this.searchHint,
    this.errorText,
    this.enabled = true,
  });

  Future<void> _openPicker(BuildContext context) async {
    if (!enabled) return;
    final selected = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.card(context),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        var query = '';
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            final filtered = options
                .where((o) => o.label.toLowerCase().contains(query.toLowerCase()))
                .toList();
            return SafeArea(
              child: Padding(
                padding: EdgeInsets.only(
                  bottom: MediaQuery.viewInsetsOf(ctx).bottom,
                ),
                child: SizedBox(
                  height: MediaQuery.sizeOf(ctx).height * 0.65,
                  child: Column(
                    children: [
                      const SizedBox(height: 10),
                      Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: context.appColors.border,
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                'Select $label',
                                style: TextStyle(
                                  color: context.appColors.textPrimary,
                                  fontSize: 16,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                            IconButton(
                              onPressed: () => Navigator.pop(ctx),
                              icon: Icon(Icons.close, color: context.appColors.textMuted),
                            ),
                          ],
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: TextField(
                          autofocus: true,
                          style: TextStyle(color: context.appColors.textPrimary),
                          decoration: InputDecoration(
                            hintText: searchHint,
                            hintStyle: TextStyle(color: context.appColors.textMuted),
                            prefixIcon: Icon(Icons.search, color: context.appColors.textMuted),
                            filled: true,
                            fillColor: AppTheme.bg(context),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: BorderSide(color: context.appColors.border),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: BorderSide(color: context.appColors.border),
                            ),
                          ),
                          onChanged: (v) => setModalState(() => query = v.trim()),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Expanded(
                        child: filtered.isEmpty
                            ? Center(
                                child: Text(
                                  'No results found.',
                                  style: TextStyle(color: context.appColors.textMuted),
                                ),
                              )
                            : ListView.separated(
                                itemCount: filtered.length,
                                separatorBuilder: (_, __) => Divider(
                                  height: 1,
                                  color: context.appColors.border,
                                ),
                                itemBuilder: (_, i) {
                                  final option = filtered[i];
                                  final selected = option.id == value;
                                  return ListTile(
                                    title: Text(
                                      option.label,
                                      style: TextStyle(
                                        color: context.appColors.textPrimary,
                                        fontWeight:
                                            selected ? FontWeight.w700 : FontWeight.w500,
                                      ),
                                    ),
                                    trailing: selected
                                        ? const Icon(Icons.check, color: AppTheme.accent)
                                        : null,
                                    onTap: () => Navigator.pop(ctx, option.id),
                                  );
                                },
                              ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
    if (selected != null) onChanged(selected);
  }

  @override
  Widget build(BuildContext context) {
    String? selectedLabel;
    for (final o in options) {
      if (o.id == value) {
        selectedLabel = o.label;
        break;
      }
    }

    return InkWell(
      onTap: enabled ? () => _openPicker(context) : null,
      borderRadius: BorderRadius.circular(12),
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          errorText: errorText,
          labelStyle: TextStyle(color: context.appColors.textSecondary),
          filled: true,
          fillColor: AppTheme.bg(context),
          suffixIcon: Icon(Icons.search, color: context.appColors.textMuted),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: context.appColors.border),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: context.appColors.border),
          ),
        ),
        child: Text(
          selectedLabel ?? 'Select $label',
          style: TextStyle(
            color: selectedLabel == null ? context.appColors.textMuted : context.appColors.textPrimary,
            fontSize: 15,
          ),
        ),
      ),
    );
  }
}

class _DropdownField extends StatelessWidget {
  final String label;
  final String? value;
  final List<DropdownMenuItem<String>> items;
  final ValueChanged<String?>? onChanged;

  const _DropdownField({
    required this.label,
    required this.value,
    required this.items,
    this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<String>(
      initialValue: value,
      items: items,
      onChanged: onChanged,
      dropdownColor: context.appColors.surface,
      style: TextStyle(color: context.appColors.textPrimary),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyle(color: context.appColors.textSecondary),
        filled: true,
        fillColor: AppTheme.bg(context),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: context.appColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: context.appColors.border),
        ),
      ),
    );
  }
}

class _BottomSaveBar extends StatelessWidget {
  final bool enabled;
  final bool saving;
  final VoidCallback onSave;

  const _BottomSaveBar({
    required this.enabled,
    required this.saving,
    required this.onSave,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.card(context),
        border: Border(top: BorderSide(color: context.appColors.border)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: context.isDarkMode ? 0.35 : 0.05),
            blurRadius: 16,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          child: ElevatedButton(
            onPressed: enabled ? onSave : null,
            style: ElevatedButton.styleFrom(
              minimumSize: const Size.fromHeight(52),
              backgroundColor: AppTheme.accent,
              disabledBackgroundColor: AppTheme.accent.withValues(alpha: 0.35),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
            child: saving
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Text(
                    'Save listing',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                  ),
          ),
        ),
      ),
    );
  }
}

class _EquipmentPricingInfo extends StatelessWidget {
  final CatalogProduct product;
  const _EquipmentPricingInfo({required this.product});

  String _money(num? value) {
    if (value == null || value <= 0) return '—';
    return '₹${value.toStringAsFixed(0)}';
  }

  @override
  Widget build(BuildContext context) {
    final modes = <String>[
      if (product.isRentEnabled) 'Rent',
      if (product.isBuyEnabled) 'Buy',
    ];
    final modesLabel = modes.isEmpty ? 'Off' : modes.join(' + ');

    return Column(
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: _PricingPanel(
                title: 'Customer',
                accent: const Color(0xFF60A5FA),
                children: [
                  _MetricTile(label: 'Daily rate', value: _money(product.dailyRent)),
                  _MetricTile(label: 'Deposit', value: _money(product.securityDeposit)),
                  _MetricTile(label: 'Buy price', value: _money(product.buyPrice)),
                  _MetricTile(
                    label: 'GST / Modes',
                    value: '${product.gstPercent.toStringAsFixed(0)}% · $modesLabel',
                    compact: true,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _PricingPanel(
                title: 'Your payout',
                accent: AppTheme.accent,
                children: [
                  _MetricTile(label: 'Vendor daily', value: _money(product.vendorDailyRent)),
                  _MetricTile(label: 'Vendor buy', value: _money(product.vendorBuyPrice)),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: AppTheme.accent.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppTheme.accent.withValues(alpha: 0.2)),
          ),
          child: Text(
            'Rental payout = vendor daily rate × plan days (set by Admin)',
            style: TextStyle(
              color: context.appColors.textSecondary,
              fontSize: 11,
              height: 1.35,
            ),
          ),
        ),
      ],
    );
  }
}

class _PricingPanel extends StatelessWidget {
  final String title;
  final Color accent;
  final List<Widget> children;

  const _PricingPanel({
    required this.title,
    required this.accent,
    required this.children,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: accent.withValues(alpha: 0.22)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title.toUpperCase(),
            style: TextStyle(
              color: accent,
              fontSize: 10,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.7,
            ),
          ),
          const SizedBox(height: 10),
          ...children,
        ],
      ),
    );
  }
}

class _MetricTile extends StatelessWidget {
  final String label;
  final String value;
  final bool compact;

  const _MetricTile({
    required this.label,
    required this.value,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              color: context.appColors.textMuted,
              fontSize: 11,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: TextStyle(
              color: context.appColors.textPrimary,
              fontWeight: FontWeight.w800,
              fontSize: compact ? 12 : 15,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}

class _ReadOnlyCatalogName extends StatelessWidget {
  final String? value;

  const _ReadOnlyCatalogName({required this.value});

  @override
  Widget build(BuildContext context) {
    final empty = value == null || value!.trim().isEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Catalog name (from Admin)',
          style: TextStyle(color: context.appColors.textSecondary, fontSize: 12),
        ),
        const SizedBox(height: 6),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          decoration: BoxDecoration(
            color: AppTheme.bg(context),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: context.appColors.border),
          ),
          child: Row(
            children: [
              Icon(
                Icons.lock_outline,
                size: 16,
                color: context.appColors.textMuted,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  empty ? 'Select a product above' : value!,
                  style: TextStyle(
                    color: empty ? context.appColors.textMuted : context.appColors.textPrimary,
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 6),
        Text(
          'Customers always see this Admin product/chemical name.',
          style: TextStyle(color: context.appColors.textMuted, fontSize: 11),
        ),
      ],
    );
  }
}
