import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/providers/address_provider.dart';
import '../../core/providers/product_provider.dart';
import '../../core/providers/favorite_provider.dart';
import '../../core/models/product_model.dart';
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

  String? _selectedCategoryName;
  bool _showFavoritesOnly = false;
  /// Mirrors React browseMode: equipment | chemicals
  String _browseMode = 'equipment';
  /// all | available | low_stock | out_of_stock
  String _availabilityFilter = 'all';
  bool _locationPromptChecked = false;

  @override
  void initState() {
    super.initState();
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
    Provider.of<ProductProvider>(context, listen: false).fetchProducts(
      categoryId: _selectedCategoryName,
      search: _searchController.text.trim(),
    );
  }

  void _onCategorySelected(String categoryName) {
    setState(() {
      _selectedCategoryName = _selectedCategoryName == categoryName ? null : categoryName;
    });
    _onSearch();
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

    var products = productProvider.products;
    // Match React CustomerBrowse: equipment = baseUnit == null; chemicals = baseUnit != null
    if (_browseMode == 'equipment') {
      products = products.where((p) => p.baseUnit == null).toList();
    } else {
      products = products.where((p) => p.baseUnit != null).toList();
    }
    if (_availabilityFilter != 'all') {
      products = products
          .where((p) => p.availabilityStatus.trim().toLowerCase() == _availabilityFilter)
          .toList();
    }
    if (_showFavoritesOnly) {
      products = products.where((p) => favoriteProvider.isFavorite(p.id)).toList();
    }

    final modeCategories = productProvider.categories
        .where((c) => _browseMode == 'chemicals' ? c.isChemical : !c.isChemical)
        .toList();
    const availabilityPills = <Map<String, String>>[
      {'id': 'all', 'label': 'All stock'},
      {'id': 'available', 'label': 'Available'},
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
                  TextField(
                    controller: _searchController,
                    onSubmitted: (_) => _onSearch(),
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
                    ),
                  ),
                ],
              ),
            ),
            
            if (modeCategories.isNotEmpty)
              SizedBox(
                height: 50,
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: modeCategories.length,
                  itemBuilder: (context, index) {
                    final category = modeCategories[index];
                    final isSelected = _selectedCategoryName == category.categoryName;
                    return Padding(
                      padding: const EdgeInsets.only(right: 8.0),
                      child: ChoiceChip(
                        label: Text(category.categoryName),
                        selected: isSelected,
                        onSelected: (_) => _onCategorySelected(category.categoryName),
                        selectedColor: const Color(0xFF6C63FF),
                        backgroundColor: const Color(0xFF1E293B),
                        labelStyle: TextStyle(color: isSelected ? Colors.white : Colors.white70),
                      ),
                    );
                  },
                ),
              ),
              
            SizedBox(
              height: 40,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: availabilityPills.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final pill = availabilityPills[index];
                  final selected = _availabilityFilter == pill['id'];
                  return ChoiceChip(
                    label: Text(pill['label']!),
                    selected: selected,
                    onSelected: (_) => setState(() => _availabilityFilter = pill['id']!),
                    selectedColor: const Color(0xFF6C63FF),
                    backgroundColor: const Color(0xFF1E293B),
                    labelStyle: TextStyle(color: selected ? Colors.white : Colors.white70, fontSize: 12),
                  );
                },
              ),
            ),
            const SizedBox(height: 4),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0),
              child: Row(
                children: [
                  Switch(
                    value: _showFavoritesOnly,
                    onChanged: (val) => setState(() => _showFavoritesOnly = val),
                    activeThumbColor: const Color(0xFF6C63FF),
                  ),
                  const Text('Favorites Only', style: TextStyle(color: Colors.white70)),
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
