import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/utils/debouncer.dart';
import '../../core/providers/address_provider.dart';
import '../../core/providers/product_provider.dart';
import '../../core/providers/favorite_provider.dart';
import '../../core/models/product_model.dart';
import '../../core/models/category_model.dart';
import '../../shared/widgets/catalog_image.dart';
import '../../shared/utils/require_auth.dart';
import '../product/product_detail_screen.dart';
import '../profile/addresses_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final TextEditingController _searchController = TextEditingController();
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  static const _locationPromptKey = 'locationPromptDismissed';

  final Debouncer _catalogSearchDebouncer = Debouncer(duration: catalogSearchDebounce);

  String? _selectedCategoryName;
  bool _showFavoritesOnly = false;
  /// Mirrors React browseMode: equipment | chemicals
  String _browseMode = 'equipment';
  /// all | low_stock | out_of_stock — inventory on active listings (matches web Stock filter).
  String _stockFilter = 'all';
  bool _locationPromptChecked = false;

  @override
  void initState() {
    super.initState();
    _searchController.addListener(_scheduleDebouncedSearch);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final productProvider = Provider.of<ProductProvider>(context, listen: false);
      productProvider.fetchCategories();
      productProvider.fetchProducts();
      final auth = Provider.of<AuthProvider>(context, listen: false);
      if (auth.isAuthenticated) {
        Provider.of<FavoriteProvider>(context, listen: false).fetchFavorites();
      }
      _maybeShowLocationPrompt();
    });
  }

  @override
  void dispose() {
    _catalogSearchDebouncer.dispose();
    _searchController.removeListener(_scheduleDebouncedSearch);
    _searchController.dispose();
    super.dispose();
  }

  void _scheduleDebouncedSearch() {
    _catalogSearchDebouncer.run(_onSearch);
  }

  void _submitSearchNow() {
    _catalogSearchDebouncer.cancel();
    _onSearch();
  }

  Future<void> _maybeShowLocationPrompt() async {
    if (_locationPromptChecked || !mounted) return;
    _locationPromptChecked = true;
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (!auth.isAuthenticated) return;
    final dismissed = await _storage.read(key: _locationPromptKey);
    if (dismissed == 'true' || !mounted) return;
    final addressProvider = Provider.of<AddressProvider>(context, listen: false);
    await addressProvider.fetchAddresses();
    if (!mounted) return;
    final hasGeo = addressProvider.addresses.any((a) => a.latitude != null && a.longitude != null);
    if (hasGeo) return;
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text('Set location first', style: TextStyle(color: Colors.white)),
        content: const Text(
          'Add your address with map location to see nearest available products first and get correct delivery charges.',
          style: TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () async {
              await _storage.write(key: _locationPromptKey, value: 'true');
              if (ctx.mounted) Navigator.pop(ctx);
            },
            child: const Text('Later', style: TextStyle(color: Colors.white70)),
          ),
          TextButton(
            onPressed: () async {
              await _storage.write(key: _locationPromptKey, value: 'true');
              if (!ctx.mounted) return;
              Navigator.pop(ctx);
              if (!mounted) return;
              Navigator.push(context, MaterialPageRoute(builder: (_) => const AddressesScreen()));
            },
            child: const Text('Set address now', style: TextStyle(color: Color(0xFF6C63FF), fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  void _onSearch() {
    final q = _searchController.text.trim();
    Provider.of<ProductProvider>(context, listen: false).fetchProducts(
      search: q.isEmpty ? null : q,
    );
  }

  static bool _isActiveListing(ProductModel p) {
    final ls = p.listingStatus.trim().toLowerCase();
    return ls == 'active' || ls == 'approved';
  }

  List<ProductModel> _catalogBeforeCategory(List<ProductModel> all, FavoriteProvider favorites) {
    var result = all.where(_isActiveListing).toList();
    if (_browseMode == 'equipment') {
      result = result.where((p) => p.baseUnit == null).toList();
    } else {
      result = result.where((p) => p.baseUnit != null).toList();
    }
    if (_stockFilter != 'all') {
      result = result
          .where((p) => p.availabilityStatus.trim().toLowerCase() == _stockFilter)
          .toList();
    }
    if (_showFavoritesOnly) {
      result = result.where((p) => favorites.isFavorite(p.id)).toList();
    }
    return result;
  }

  Map<String, int> _categoryCounts(List<ProductModel> catalog) {
    final counts = <String, int>{};
    for (final p in catalog) {
      final name = p.categoryName.trim();
      if (name.isEmpty) continue;
      counts[name] = (counts[name] ?? 0) + 1;
    }
    return counts;
  }

  void _setBrowseMode(String mode) {
    if (_browseMode == mode) return;
    setState(() {
      _browseMode = mode;
      // Clear category if it doesn't belong to the new tab.
      if (_selectedCategoryName != null) {
        final cats = Provider.of<ProductProvider>(context, listen: false).categories;
        final stillValid = cats.any(
          (c) =>
              c.categoryName == _selectedCategoryName &&
              (mode == 'chemicals' ? c.isChemical : !c.isChemical),
        );
        if (!stillValid) {
          _selectedCategoryName = null;
        }
      }
    });
    _onSearch();
  }

  @override
  Widget build(BuildContext context) {
    final productProvider = Provider.of<ProductProvider>(context);
    final favoriteProvider = Provider.of<FavoriteProvider>(context);

    var products = _catalogBeforeCategory(productProvider.products, favoriteProvider);
    if (_selectedCategoryName != null) {
      products = products.where((p) => p.categoryName == _selectedCategoryName).toList();
    }

    final catalogBeforeCategory =
        _catalogBeforeCategory(productProvider.products, favoriteProvider);

    final modeCategories = productProvider.categories
        .where((c) => _browseMode == 'chemicals' ? c.isChemical : !c.isChemical)
        .toList()
      ..sort((a, b) => a.categoryName.toLowerCase().compareTo(b.categoryName.toLowerCase()));
    const stockPills = <Map<String, String>>[
      {'id': 'all', 'label': 'All stock'},
      {'id': 'low_stock', 'label': 'Low stock'},
      {'id': 'out_of_stock', 'label': 'Out of stock'},
    ];

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Discover',
                    style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Medical equipment and chemicals from verified vendors.',
                    style: TextStyle(color: Colors.white54, fontSize: 13),
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        Expanded(child: _browseModeChip('equipment', 'Equipment')),
                        Expanded(child: _browseModeChip('chemicals', 'Chemicals')),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _searchController,
                          onSubmitted: (_) => _submitSearchNow(),
                          textInputAction: TextInputAction.search,
                          style: const TextStyle(color: Colors.white),
                          decoration: InputDecoration(
                            hintText: _browseMode == 'chemicals' ? 'Search chemicals...' : 'Search equipment...',
                            hintStyle: const TextStyle(color: Colors.white54),
                            prefixIcon: const Icon(Icons.search, color: Colors.white70),
                            filled: true,
                            fillColor: const Color(0xFF1E293B),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(16),
                              borderSide: BorderSide.none,
                            ),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Material(
                        color: _hasActiveFilters
                            ? const Color(0xFF6C63FF)
                            : const Color(0xFF1E293B),
                        borderRadius: BorderRadius.circular(16),
                        child: InkWell(
                          onTap: () => _openFiltersSheet(modeCategories),
                          borderRadius: BorderRadius.circular(16),
                          child: SizedBox(
                            width: 52,
                            height: 52,
                            child: Stack(
                              alignment: Alignment.center,
                              children: [
                                Icon(
                                  Icons.tune_rounded,
                                  color: _hasActiveFilters ? Colors.white : Colors.white70,
                                ),
                                if (_activeFilterCount > 0)
                                  Positioned(
                                    top: 10,
                                    right: 10,
                                    child: Container(
                                      width: 16,
                                      height: 16,
                                      alignment: Alignment.center,
                                      decoration: const BoxDecoration(
                                        color: Colors.white,
                                        shape: BoxShape.circle,
                                      ),
                                      child: Text(
                                        '$_activeFilterCount',
                                        style: const TextStyle(
                                          color: Color(0xFF6C63FF),
                                          fontSize: 10,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  if (!productProvider.isLoading) ...[
                    const SizedBox(height: 10),
                    Text(
                      _productCountLabel(catalogBeforeCategory.length, products.length),
                      style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                    ),
                  ],
                  if (_hasActiveFilters) ...[
                    const SizedBox(height: 12),
                    SizedBox(
                      height: 36,
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        children: [
                          if (_selectedCategoryName != null)
                            Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: _ActiveFilterChip(
                                label: _selectedCategoryName!,
                                onClear: () {
                                  setState(() => _selectedCategoryName = null);
                                },
                              ),
                            ),
                          if (_stockFilter != 'all')
                            Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: _ActiveFilterChip(
                                label: stockPills
                                    .firstWhere((p) => p['id'] == _stockFilter)['label']!,
                                onClear: () => setState(() => _stockFilter = 'all'),
                              ),
                            ),
                          if (_showFavoritesOnly)
                            Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: _ActiveFilterChip(
                                label: 'Favorites',
                                onClear: () => setState(() => _showFavoritesOnly = false),
                              ),
                            ),
                          TextButton(
                            onPressed: _clearAllFilters,
                            style: TextButton.styleFrom(
                              foregroundColor: Colors.white70,
                              padding: const EdgeInsets.symmetric(horizontal: 8),
                              minimumSize: Size.zero,
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            ),
                            child: const Text('Clear all', style: TextStyle(fontSize: 13)),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),

            Expanded(
              child: productProvider.isLoading
                  ? const Center(child: CircularProgressIndicator(color: Color(0xFF6C63FF)))
                  : productProvider.errorMessage != null
                      ? Center(child: Text(productProvider.errorMessage!, style: const TextStyle(color: Colors.redAccent)))
                      : products.isEmpty
                          ? const Center(
                              child: Text(
                                'No listings match your filters.',
                                style: TextStyle(color: Colors.white70),
                              ),
                            )
                          : GridView.builder(
                              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                crossAxisCount: 2,
                                mainAxisSpacing: 16,
                                crossAxisSpacing: 12,
                                // Tall enough for image + title + price on phones & web.
                                mainAxisExtent: 260,
                              ),
                              itemCount: products.length,
                              itemBuilder: (context, index) {
                                final product = products[index];
                                return _buildProductCard(product);
                              },
                            ),
            ),
          ],
        ),
      ),
    );
  }

  bool get _hasActiveFilters =>
      _selectedCategoryName != null || _stockFilter != 'all' || _showFavoritesOnly;

  int get _activeFilterCount {
    var n = 0;
    if (_selectedCategoryName != null) n++;
    if (_stockFilter != 'all') n++;
    if (_showFavoritesOnly) n++;
    return n;
  }

  void _clearAllFilters() {
    setState(() {
      _selectedCategoryName = null;
      _stockFilter = 'all';
      _showFavoritesOnly = false;
    });
  }

  String _productCountLabel(int catalogTotal, int visibleTotal) {
    final noun = visibleTotal == 1 ? 'product' : 'products';
    final modeLabel = _browseMode == 'chemicals' ? ' for purchase' : ' for rent';
    if (_selectedCategoryName != null && visibleTotal != catalogTotal) {
      return '$visibleTotal $noun$modeLabel in $_selectedCategoryName';
    }
    return '$visibleTotal $noun$modeLabel';
  }

  Future<void> _openFiltersSheet(List<CategoryModel> categories) async {
    var draftCategory = _selectedCategoryName;
    var draftStock = _stockFilter;
    var draftFavorites = _showFavoritesOnly;
    final categorySearchController = TextEditingController();

    const stockOptions = <Map<String, String>>[
      {'id': 'all', 'label': 'All stock'},
      {'id': 'low_stock', 'label': 'Low stock'},
      {'id': 'out_of_stock', 'label': 'Out of stock'},
    ];

    int draftCount() {
      var n = 0;
      if (draftCategory != null) n++;
      if (draftStock != 'all') n++;
      if (draftFavorites) n++;
      return n;
    }

    List<CategoryModel> filteredCategories() {
      final q = categorySearchController.text.trim().toLowerCase();
      if (q.isEmpty) return categories;
      return categories.where((c) => c.categoryName.toLowerCase().contains(q)).toList();
    }

    final applied = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            final maxH = MediaQuery.of(ctx).size.height * 0.82;
            final bottomInset = MediaQuery.of(ctx).viewInsets.bottom;
            final count = draftCount();
            final productProvider = Provider.of<ProductProvider>(ctx, listen: false);
            final favoriteProvider = Provider.of<FavoriteProvider>(ctx, listen: false);
            // Match web: counts reflect applied stock/favorites/tab filters (not draft category).
            final catalogSnapshot = _catalogBeforeCategory(productProvider.products, favoriteProvider);
            final categoryCountsSnapshot = _categoryCounts(catalogSnapshot);
            final allCategoriesCount = catalogSnapshot.length;

            int? countForCategory(String name) {
              final n = categoryCountsSnapshot[name];
              if (n == null || n <= 0) return null;
              return n;
            }

            return SafeArea(
              child: Align(
                alignment: Alignment.bottomCenter,
                child: Container(
                  constraints: BoxConstraints(maxHeight: maxH),
                  decoration: const BoxDecoration(
                    color: Color(0xFF0F172A),
                    borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                    border: Border(
                      top: BorderSide(color: Color(0xFF334155)),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const SizedBox(height: 10),
                      Center(
                        child: Container(
                          width: 36,
                          height: 4,
                          decoration: BoxDecoration(
                            color: const Color(0xFF475569),
                            borderRadius: BorderRadius.circular(999),
                          ),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(20, 16, 8, 12),
                        child: Row(
                          children: [
                            const Expanded(
                              child: Text(
                                'Filters',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 22,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: -0.3,
                                ),
                              ),
                            ),
                            TextButton(
                              onPressed: () {
                                setSheetState(() {
                                  draftCategory = null;
                                  draftStock = 'all';
                                  draftFavorites = false;
                                  categorySearchController.clear();
                                });
                              },
                              child: const Text(
                                'Clear all',
                                style: TextStyle(color: Color(0xFF94A3B8), fontWeight: FontWeight.w600),
                              ),
                            ),
                            IconButton(
                              onPressed: () => Navigator.pop(ctx, false),
                              icon: const Icon(Icons.close_rounded, color: Color(0xFF94A3B8)),
                              tooltip: 'Close',
                            ),
                          ],
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                        child: Text(
                          'Filter by stock level, category, and saved items. Only active listings are shown.',
                          style: TextStyle(color: Colors.white.withValues(alpha: 0.55), fontSize: 12, height: 1.35),
                        ),
                      ),
                      const Divider(height: 1, color: Color(0xFF1E293B)),
                      Expanded(
                        child: SingleChildScrollView(
                          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              _FilterSectionCard(
                                title: 'STOCK',
                                child: Padding(
                                  padding: const EdgeInsets.all(10),
                                  child: Wrap(
                                    spacing: 8,
                                    runSpacing: 8,
                                    children: stockOptions.map((opt) {
                                      final selected = draftStock == opt['id'];
                                      return _StockFilterChip(
                                        label: opt['label']!,
                                        selected: selected,
                                        onTap: () => setSheetState(() => draftStock = opt['id']!),
                                      );
                                    }).toList(),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 14),
                              _FilterSectionCard(
                                title: 'SAVED',
                                child: _FavoritesFilterRow(
                                  value: draftFavorites,
                                  onChanged: (v) {
                                    if (v && !Provider.of<AuthProvider>(context, listen: false).isAuthenticated) {
                                      ensureAuthenticated(context, message: 'Please log in to see your saved items.');
                                      return;
                                    }
                                    setSheetState(() => draftFavorites = v);
                                  },
                                ),
                              ),
                              const SizedBox(height: 14),
                              _FilterSectionCard(
                                title: 'CATEGORY',
                                trailing: '${categories.length} categories',
                                child: Column(
                                  children: [
                                    if (categories.length >= 8)
                                      Padding(
                                        padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
                                        child: TextField(
                                          controller: categorySearchController,
                                          onChanged: (_) => setSheetState(() {}),
                                          style: const TextStyle(color: Colors.white, fontSize: 14),
                                          decoration: InputDecoration(
                                            hintText: 'Search categories…',
                                            hintStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 13),
                                            prefixIcon: const Icon(Icons.search, color: Color(0xFF64748B), size: 20),
                                            filled: true,
                                            fillColor: const Color(0xFF0F172A),
                                            isDense: true,
                                            contentPadding: const EdgeInsets.symmetric(vertical: 10),
                                            border: OutlineInputBorder(
                                              borderRadius: BorderRadius.circular(10),
                                              borderSide: const BorderSide(color: Color(0xFF334155)),
                                            ),
                                            enabledBorder: OutlineInputBorder(
                                              borderRadius: BorderRadius.circular(10),
                                              borderSide: const BorderSide(color: Color(0xFF334155)),
                                            ),
                                          ),
                                        ),
                                      ),
                                    ConstrainedBox(
                                      constraints: const BoxConstraints(maxHeight: 280),
                                      child: ListView(
                                        shrinkWrap: true,
                                        children: [
                                          if (categorySearchController.text.trim().isEmpty)
                                            _FilterSelectRow(
                                              label: 'All categories',
                                              count: allCategoriesCount,
                                              selected: draftCategory == null,
                                              onTap: () => setSheetState(() => draftCategory = null),
                                            ),
                                          ...filteredCategories().map((c) {
                                            return _FilterSelectRow(
                                              label: c.categoryName,
                                              count: countForCategory(c.categoryName),
                                              selected: draftCategory == c.categoryName,
                                              onTap: () => setSheetState(() => draftCategory = c.categoryName),
                                              showDivider: true,
                                            );
                                          }),
                                          if (filteredCategories().isEmpty)
                                            const Padding(
                                              padding: EdgeInsets.all(20),
                                              child: Text(
                                                'No categories match',
                                                textAlign: TextAlign.center,
                                                style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
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
                        ),
                      ),
                      Container(
                        padding: EdgeInsets.fromLTRB(16, 12, 16, 12 + bottomInset),
                        decoration: const BoxDecoration(
                          color: Color(0xFF0F172A),
                          border: Border(top: BorderSide(color: Color(0xFF1E293B))),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: OutlinedButton(
                                onPressed: () => Navigator.pop(ctx, false),
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: Colors.white70,
                                  side: const BorderSide(color: Color(0xFF334155)),
                                  minimumSize: const Size.fromHeight(48),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                ),
                                child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.w600)),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              flex: 2,
                              child: ElevatedButton(
                                onPressed: () => Navigator.pop(ctx, true),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF6C63FF),
                                  foregroundColor: Colors.white,
                                  elevation: 0,
                                  minimumSize: const Size.fromHeight(48),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                ),
                                child: Text(
                                  count > 0 ? 'Show results ($count)' : 'Show results',
                                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                                ),
                              ),
                            ),
                          ],
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

    categorySearchController.dispose();

    if (applied == true && mounted) {
      setState(() {
        _selectedCategoryName = draftCategory;
        _stockFilter = draftStock;
        _showFavoritesOnly = draftFavorites;
      });
    }
  }

  Widget _browseModeChip(String mode, String label) {
    final selected = _browseMode == mode;
    return GestureDetector(
      onTap: () => _setBrowseMode(mode),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFF6C63FF) : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: TextStyle(
            color: selected ? Colors.white : Colors.white70,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }

  Widget _buildProductCard(ProductModel product) {
    final ls = product.listingStatus.trim().toLowerCase();
    final isBrowsable = ls == 'active' || ls == 'approved';
    final badge = product.getAvailabilityBadge();
    final priceText = product.isChemical
        ? '₹${(product.buyPrice ?? 0).toStringAsFixed(0)}${product.baseUnit != null ? ' / ${product.baseUnit}' : ''}'
        : '₹${product.dailyRent.toStringAsFixed(0)}/day';

    return GestureDetector(
      onTap: isBrowsable
          ? () {
              Navigator.push(context, MaterialPageRoute(builder: (_) => ProductDetailScreen(listingId: product.id)));
            }
          : null,
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFF1E293B),
          borderRadius: BorderRadius.circular(16),
        ),
        clipBehavior: Clip.antiAlias,
        // No AspectRatio — it overflows when grid cell is shorter than width/ratio (Chrome wide view).
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: Stack(
                fit: StackFit.expand,
                children: [
                  const ColoredBox(color: Color(0xFF334155)),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(10, 36, 10, 8),
                    child: CatalogImage(url: product.primaryImageUrl, fit: BoxFit.contain),
                  ),
                  Positioned(
                    top: 10,
                    left: 10,
                    child: Container(
                      constraints: const BoxConstraints(maxWidth: 104),
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Color(badge['color'] as int),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        badge['label'] as String,
                        maxLines: 1,
                        softWrap: false,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          height: 1.15,
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    top: 8,
                    right: 8,
                    child: Consumer<FavoriteProvider>(
                      builder: (context, favoriteProvider, _) {
                        final isFavorite = favoriteProvider.isFavorite(product.id);
                        return Material(
                          color: Colors.black.withValues(alpha: 0.45),
                          shape: const CircleBorder(),
                          child: InkWell(
                            customBorder: const CircleBorder(),
                            onTap: () async {
                              final ok = await ensureAuthenticated(
                                context,
                                message: 'Sign in to save favorites.',
                              );
                              if (!ok || !context.mounted) return;
                              await favoriteProvider.toggleFavorite(product.id);
                            },
                            child: SizedBox(
                              width: 34,
                              height: 34,
                              child: Icon(
                                isFavorite ? Icons.favorite : Icons.favorite_border,
                                color: isFavorite ? Colors.red : Colors.white,
                                size: 18,
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    product.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                      height: 1.25,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    priceText,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                      color: Color(0xFF6C63FF),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActiveFilterChip extends StatelessWidget {
  final String label;
  final VoidCallback onClear;

  const _ActiveFilterChip({required this.label, required this.onClear});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.only(left: 12, right: 4),
      decoration: BoxDecoration(
        color: const Color(0xFF6C63FF).withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0xFF6C63FF).withValues(alpha: 0.45)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
          ),
          IconButton(
            onPressed: onClear,
            icon: const Icon(Icons.close, size: 16, color: Colors.white70),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
            visualDensity: VisualDensity.compact,
          ),
        ],
      ),
    );
  }
}

class _FilterSectionCard extends StatelessWidget {
  final String title;
  final Widget child;
  final String? trailing;

  const _FilterSectionCard({required this.title, required this.child, this.trailing});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF334155).withValues(alpha: 0.7)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                      color: Color(0xFF94A3B8),
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.6,
                    ),
                  ),
                ),
                if (trailing != null)
                  Text(
                    trailing!,
                    style: const TextStyle(color: Color(0xFF64748B), fontSize: 11, fontWeight: FontWeight.w600),
                  ),
              ],
            ),
          ),
          child,
        ],
      ),
    );
  }
}

class _FilterSelectRow extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final bool showDivider;
  final int? count;

  const _FilterSelectRow({
    required this.label,
    required this.selected,
    required this.onTap,
    this.showDivider = false,
    this.count,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        if (showDivider) const Divider(height: 1, color: Color(0xFF334155)),
        Material(
          color: selected ? const Color(0xFF6C63FF).withValues(alpha: 0.12) : Colors.transparent,
          child: InkWell(
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      label,
                      style: TextStyle(
                        color: selected ? Colors.white : const Color(0xFFE2E8F0),
                        fontSize: 14,
                        fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                      ),
                    ),
                  ),
                  if (count != null)
                    Container(
                      margin: const EdgeInsets.only(right: 10),
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: selected
                            ? const Color(0xFF6C63FF).withValues(alpha: 0.25)
                            : const Color(0xFF334155),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        '$count',
                        style: TextStyle(
                          color: selected ? Colors.white : const Color(0xFF94A3B8),
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  Icon(
                    selected ? Icons.check_circle_rounded : Icons.circle_outlined,
                    size: 22,
                    color: selected ? const Color(0xFF6C63FF) : const Color(0xFF64748B),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _StockFilterChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _StockFilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? const Color(0xFF1E293B) : Colors.transparent,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: selected ? const Color(0xFF6C63FF) : const Color(0xFF334155),
            ),
            boxShadow: selected
                ? [BoxShadow(color: Colors.black.withValues(alpha: 0.2), blurRadius: 4, offset: const Offset(0, 1))]
                : null,
          ),
          child: Text(
            label,
            style: TextStyle(
              color: selected ? Colors.white : const Color(0xFFCBD5E1),
              fontSize: 13,
              fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            ),
          ),
        ),
      ),
    );
  }
}

class _FavoritesFilterRow extends StatelessWidget {
  final bool value;
  final ValueChanged<bool> onChanged;

  const _FavoritesFilterRow({required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => onChanged(!value),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 12, 14),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: const Color(0xFF0F172A),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  value ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                  color: value ? const Color(0xFFEF4444) : const Color(0xFF94A3B8),
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Favorites only',
                      style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Show items you have saved',
                      style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                    ),
                  ],
                ),
              ),
              Switch.adaptive(
                value: value,
                activeThumbColor: Colors.white,
                activeTrackColor: const Color(0xFF6C63FF),
                onChanged: onChanged,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
