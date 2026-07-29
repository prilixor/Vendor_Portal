import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/models/vendor_catalog_model.dart';
import '../../core/providers/vendor_catalog_provider.dart';
import '../../core/providers/vendor_profile_provider.dart';
import '../../core/theme.dart';
import '../../shared/widgets/chemical_variant_stock_fields.dart';

/// Step 2 — create equipment or chemical listing (web Products create dialog parity).
class CreateListingScreen extends StatefulWidget {
  final bool isChemical;

  const CreateListingScreen({super.key, required this.isChemical});

  @override
  State<CreateListingScreen> createState() => _CreateListingScreenState();
}

class _CreateListingScreenState extends State<CreateListingScreen> {
  final _titleController = TextEditingController();
  final _quantityController = TextEditingController(text: '1');

  String? _categoryId;
  String? _productId;
  String _listingStatus = 'inactive';
  List<ChemicalVariantStockRow> _variantRows = const [];
  String? _categoryError;
  String? _productError;
  String? _titleError;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _ensureCatalogLoaded());
  }

  @override
  void dispose() {
    _titleController.dispose();
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
      _titleError = _titleController.text.trim().isEmpty
          ? 'Enter a listing title.'
          : null;
    });
    if (_categoryError != null || _productError != null || _titleError != null) {
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
      listingTitle: _titleController.text.trim(),
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
    final typeLabel = widget.isChemical ? 'Chemical · Buy' : 'Equipment · Rent';
    final typeIcon =
        widget.isChemical ? Icons.science_outlined : Icons.medical_services_outlined;

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.isChemical ? 'New chemical listing' : 'New equipment listing'),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
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
          const SizedBox(height: 20),
          _FormSection(
            title: 'Catalog product',
            subtitle: 'Pick from Admin catalog — category cannot change after save.',
            child: Column(
              children: [
                _DropdownField(
                  label: 'Category',
                  value: _categoryId,
                  items: categories
                      .map((c) => DropdownMenuItem(value: c.id, child: Text(c.name)))
                      .toList(),
                  errorText: _categoryError,
                  onChanged: pending
                      ? null
                      : (value) {
                          setState(() {
                            _categoryId = value;
                            final nextProducts = provider.productsForCategory(
                              value ?? '',
                              widget.isChemical,
                            );
                            _productId =
                                nextProducts.isNotEmpty ? nextProducts.first.id : null;
                            _variantRows = _buildVariantRows(provider);
                          });
                        },
                ),
                const SizedBox(height: 12),
                _DropdownField(
                  label: 'Product',
                  value: _productId,
                  items: products
                      .map(
                        (p) => DropdownMenuItem(
                          value: p.id,
                          child: Text(p.productName),
                        ),
                      )
                      .toList(),
                  errorText: _productError,
                  onChanged: pending
                      ? null
                      : (value) {
                          setState(() {
                            _productId = value;
                            _variantRows = _buildVariantRows(provider);
                          });
                        },
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _FormSection(
            title: 'Listing details',
            child: Column(
              children: [
                TextField(
                  controller: _titleController,
                  enabled: !pending,
                  style: const TextStyle(color: Colors.white),
                  decoration: _inputDecoration(
                    label: 'Listing title',
                    hint: 'e.g. Oxygen concentrator — Zone A',
                    errorText: _titleError,
                  ),
                ),
                const SizedBox(height: 12),
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
          const SizedBox(height: 16),
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
                            style: const TextStyle(color: Colors.white),
                            decoration: _inputDecoration(label: 'Quantity'),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'No packaging sizes on this product yet. Ask Admin to add variants (e.g. 1L, 5L).',
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.5),
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
                    style: const TextStyle(color: Colors.white),
                    decoration: _inputDecoration(label: 'Quantity'),
                  ),
          ),
          if (selectedProduct != null) ...[
            const SizedBox(height: 16),
            _FormSection(
              title: 'Admin pricing',
              subtitle: 'Read-only — set by platform Admin',
              child: widget.isChemical
                  ? _ChemicalPricingInfo(product: selectedProduct)
                  : _EquipmentPricingInfo(product: selectedProduct),
            ),
          ],
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: pending || provider.saving ? null : _save,
            style: ElevatedButton.styleFrom(
              minimumSize: const Size.fromHeight(52),
              backgroundColor: AppTheme.accent,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
            child: provider.saving
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text(
                    'Save listing',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                  ),
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
      labelStyle: const TextStyle(color: Colors.white54),
      hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.28)),
      filled: true,
      fillColor: AppTheme.bg(context),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
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
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.18),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: color, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Listing type',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.5),
                    fontSize: 11,
                  ),
                ),
                Text(
                  label,
                  style: TextStyle(
                    color: color,
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                  ),
                ),
              ],
            ),
          ),
          TextButton(
            onPressed: onChangeType,
            child: const Text('Change'),
          ),
        ],
      ),
    );
  }
}

class _FormSection extends StatelessWidget {
  final String title;
  final String? subtitle;
  final Widget child;

  const _FormSection({
    required this.title,
    this.subtitle,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.card(context),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w700,
              fontSize: 15,
            ),
          ),
          if (subtitle != null) ...[
            const SizedBox(height: 4),
            Text(
              subtitle!,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.48),
                fontSize: 12,
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

class _DropdownField extends StatelessWidget {
  final String label;
  final String? value;
  final List<DropdownMenuItem<String>> items;
  final ValueChanged<String?>? onChanged;
  final String? errorText;

  const _DropdownField({
    required this.label,
    required this.value,
    required this.items,
    this.onChanged,
    this.errorText,
  });

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<String>(
      initialValue: value,
      items: items,
      onChanged: onChanged,
      dropdownColor: AppTheme.card(context),
      style: const TextStyle(color: Colors.white),
      decoration: InputDecoration(
        labelText: label,
        errorText: errorText,
        labelStyle: const TextStyle(color: Colors.white54),
        filled: true,
        fillColor: AppTheme.bg(context),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
        ),
      ),
    );
  }
}

class _ChemicalPricingInfo extends StatelessWidget {
  final CatalogProduct product;
  const _ChemicalPricingInfo({required this.product});

  @override
  Widget build(BuildContext context) {
    final variants = product.variants.where((v) => v.isActive).toList();
    if (variants.isEmpty) {
      return Text(
        'No variant pricing configured.',
        style: TextStyle(color: Colors.white.withValues(alpha: 0.5), fontSize: 13),
      );
    }
    return Column(
      children: variants
          .map(
            (v) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      v.label,
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                    ),
                  ),
                  Text(
                    '₹${v.buyPrice.toStringAsFixed(0)}',
                    style: const TextStyle(color: AppTheme.accent, fontWeight: FontWeight.w700),
                  ),
                ],
              ),
            ),
          )
          .toList(),
    );
  }
}

class _EquipmentPricingInfo extends StatelessWidget {
  final CatalogProduct product;
  const _EquipmentPricingInfo({required this.product});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _PriceRow(label: 'Weekly rent', value: '₹${product.weeklyRent.toStringAsFixed(0)}'),
        _PriceRow(label: 'Monthly rent', value: '₹${product.monthlyRent.toStringAsFixed(0)}'),
        _PriceRow(label: 'Security deposit', value: '₹${product.securityDeposit.toStringAsFixed(0)}'),
      ],
    );
  }
}

class _PriceRow extends StatelessWidget {
  final String label;
  final String value;

  const _PriceRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(color: Colors.white.withValues(alpha: 0.55), fontSize: 13),
            ),
          ),
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
