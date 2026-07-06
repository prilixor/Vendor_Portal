import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/providers/product_provider.dart';
import '../../core/providers/favorite_provider.dart';
import '../../core/models/product_model.dart';
import '../product/product_detail_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final TextEditingController _searchController = TextEditingController();
  String? _selectedCategoryName;
  bool _showFavoritesOnly = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final productProvider = Provider.of<ProductProvider>(context, listen: false);
      productProvider.fetchCategories();
      productProvider.fetchProducts();
      Provider.of<FavoriteProvider>(context, listen: false).fetchFavorites();
    });
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

  @override
  Widget build(BuildContext context) {
    final productProvider = Provider.of<ProductProvider>(context);
    final favoriteProvider = Provider.of<FavoriteProvider>(context);

    var products = productProvider.products;
    if (_showFavoritesOnly) {
      products = products.where((p) => favoriteProvider.isFavorite(p.id)).toList();
    }

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
                  const SizedBox(height: 16),
                  TextField(
                    controller: _searchController,
                    onSubmitted: (_) => _onSearch(),
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      hintText: 'Search products...',
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
            
            if (productProvider.categories.isNotEmpty)
              SizedBox(
                height: 50,
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: productProvider.categories.length,
                  itemBuilder: (context, index) {
                    final category = productProvider.categories[index];
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
              
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0),
              child: Row(
                children: [
                  Switch(
                    value: _showFavoritesOnly,
                    onChanged: (val) => setState(() => _showFavoritesOnly = val),
                    activeColor: const Color(0xFF6C63FF),
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
                          ? const Center(child: Text('No products found.', style: TextStyle(color: Colors.white70)))
                          : GridView.builder(
                              padding: const EdgeInsets.symmetric(horizontal: 16),
                              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                crossAxisCount: 2,
                                mainAxisSpacing: 16,
                                crossAxisSpacing: 16,
                                childAspectRatio: 0.7,
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

  Widget _buildProductCard(ProductModel product) {
    final ls = product.listingStatus.trim().toLowerCase();
    final isBrowsable = ls == 'active' || ls == 'approved';

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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            flex: 3,
            child: Stack(
              fit: StackFit.expand,
              children: [
                product.primaryImageUrl != null && product.primaryImageUrl!.isNotEmpty
                    ? Image.network(
                        product.primaryImageUrl!,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => const Icon(Icons.broken_image, color: Colors.white54, size: 40),
                      )
                    : Container(
                        color: const Color(0xFF334155),
                        child: const Icon(Icons.image, color: Colors.white54, size: 40),
                      ),
                Positioned(
                  top: 8,
                  left: 8,
                  child: Builder(
                    builder: (context) {
                      final badge = product.getAvailabilityBadge();
                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Color(badge['color']),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          badge['label'],
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      );
                    },
                  ),
                ),
                Positioned(
                  top: 8,
                  right: 8,
                  child: Consumer<FavoriteProvider>(
                    builder: (context, favoriteProvider, _) {
                      final isFavorite = favoriteProvider.isFavorite(product.id);
                      return GestureDetector(
                        onTap: () {
                          favoriteProvider.toggleFavorite(product.id);
                        },
                        child: Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.5),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            isFavorite ? Icons.favorite : Icons.favorite_border,
                            color: isFavorite ? Colors.red : Colors.white,
                            size: 20,
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            flex: 2,
            child: Padding(
              padding: const EdgeInsets.all(12.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    product.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.white),
                  ),
                  Text(
                    '\$${product.dailyRent}/day',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF6C63FF)),
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
