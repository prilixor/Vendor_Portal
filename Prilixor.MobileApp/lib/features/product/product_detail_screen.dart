import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/providers/product_provider.dart';
import '../../core/providers/checkout_provider.dart';
import '../../core/providers/favorite_provider.dart';
import '../../core/providers/cart_provider.dart';
import '../../core/models/cart_model.dart';

class ProductDetailScreen extends StatefulWidget {
  final String listingId;

  const ProductDetailScreen({super.key, required this.listingId});

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> {
  int _quantity = 1;
  String _orderType = 'rent';
  int _rentalDays = 7;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<CheckoutProvider>(context, listen: false).fetchProductDetail(widget.listingId);
      Provider.of<FavoriteProvider>(context, listen: false).fetchFavorites();
    });
  }

  @override
  Widget build(BuildContext context) {
    final checkoutProvider = Provider.of<CheckoutProvider>(context);
    final favoriteProvider = Provider.of<FavoriteProvider>(context);
    final detail = checkoutProvider.productDetail;
    final isFavorite = favoriteProvider.isFavorite(widget.listingId);

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: Container(
          margin: const EdgeInsets.all(8.0),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.5),
            shape: BoxShape.circle,
          ),
          child: IconButton(
            padding: EdgeInsets.zero,
            icon: const Icon(Icons.arrow_back, color: Colors.white, size: 20),
            onPressed: () {
              checkoutProvider.clearState();
              Navigator.pop(context);
            },
          ),
        ),
        actions: [
          Container(
            margin: const EdgeInsets.all(8.0),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.5),
              shape: BoxShape.circle,
            ),
            child: IconButton(
              padding: EdgeInsets.zero,
              icon: Icon(
                isFavorite ? Icons.favorite : Icons.favorite_border,
                color: isFavorite ? Colors.red : Colors.white,
                size: 20,
              ),
              onPressed: () {
                favoriteProvider.toggleFavorite(widget.listingId);
              },
            ),
          ),
        ],
      ),
      extendBodyBehindAppBar: true,
      body: checkoutProvider.isLoading && detail == null
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF6C63FF)))
          : checkoutProvider.errorMessage != null
              ? Center(child: Text(checkoutProvider.errorMessage!, style: const TextStyle(color: Colors.redAccent)))
              : detail == null
                  ? const Center(child: Text('Product not found.', style: TextStyle(color: Colors.white)))
                  : SingleChildScrollView(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Image Header
                          Container(
                            height: 300,
                            color: const Color(0xFF1E293B),
                            child: detail.imageUrls.isNotEmpty
                                ? Image.network(
                                    detail.imageUrls.first, 
                                    fit: BoxFit.cover,
                                    errorBuilder: (_, __, ___) => const Center(child: Icon(Icons.broken_image, color: Colors.white54, size: 80)),
                                  )
                                : const Icon(Icons.image, color: Colors.white54, size: 80),
                          ),
                          
                          // Content
                          Padding(
                            padding: const EdgeInsets.all(20.0),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // Title and Price
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Expanded(
                                      child: Text(
                                        detail.title,
                                        style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white),
                                      ),
                                    ),
                                    Text(
                                      '\$${detail.dailyRent}/day',
                                      style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Color(0xFF6C63FF)),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Builder(
                                  builder: (context) {
                                    final badge = detail.getAvailabilityBadge();
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
                                          fontSize: 12,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    );
                                  },
                                ),
                                const SizedBox(height: 12),

                                
                                // Requirements
                                const Text(
                                  'Requirements',
                                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                                ),
                                const SizedBox(height: 12),
                                Row(
                                  children: [
                                    _buildRequirementChip(
                                      Icons.medical_information, 
                                      detail.prescriptionRequired ? "Prescription Req." : "No Prescription", 
                                      detail.prescriptionRequired,
                                    ),
                                    const SizedBox(width: 12),
                                    _buildRequirementChip(
                                      Icons.payments, 
                                      detail.depositRequired ? "\$${detail.securityDeposit} Deposit" : "No Deposit", 
                                      detail.depositRequired,
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 24),
                                
                                // Description
                                const Text(
                                  'Description',
                                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  detail.description.isNotEmpty ? detail.description : "No description provided for this product.",
                                  style: const TextStyle(color: Colors.white70, fontSize: 15, height: 1.5),
                                ),
                                
                                // Order Options
                                const SizedBox(height: 24),
                                const Text(
                                  'Order Options',
                                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                                ),
                                const SizedBox(height: 12),
                                
                                // Order Type Toggle
                                Row(
                                  children: [
                                    Expanded(
                                      child: _buildTypeOption('rent', 'Rent'),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: _buildTypeOption('buy', 'Buy'),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 16),
                                
                                // Rent Days (if rent)
                                if (_orderType == 'rent') ...[
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      const Text('Rental Duration (Days)', style: TextStyle(color: Colors.white70, fontSize: 16)),
                                      Row(
                                        children: [
                                          IconButton(
                                            icon: const Icon(Icons.remove_circle_outline, color: Colors.white),
                                            onPressed: _rentalDays > 1 ? () => setState(() => _rentalDays--) : null,
                                          ),
                                          Text('$_rentalDays', style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                                          IconButton(
                                            icon: const Icon(Icons.add_circle_outline, color: Colors.white),
                                            onPressed: () => setState(() => _rentalDays++),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 12),
                                ],
                                
                                // Quantity
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    const Text('Quantity', style: TextStyle(color: Colors.white70, fontSize: 16)),
                                    Row(
                                      children: [
                                        IconButton(
                                          icon: const Icon(Icons.remove_circle_outline, color: Colors.white),
                                          onPressed: _quantity > 1 ? () => setState(() => _quantity--) : null,
                                        ),
                                        Text('$_quantity', style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                                        IconButton(
                                          icon: const Icon(Icons.add_circle_outline, color: Colors.white),
                                          onPressed: _quantity < detail.availableQuantity ? () => setState(() => _quantity++) : null,
                                        ),
                                      ],
                                    ),
                                  ],
                                ),

                                const SizedBox(height: 100), // padding for bottom bar
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
      bottomSheet: detail != null
          ? Container(
              padding: const EdgeInsets.all(20),
              color: const Color(0xFF1E293B),
              child: SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF6C63FF),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  onPressed: ['Out of stock', 'Unavailable', 'Out at this vendor'].contains(detail.getAvailabilityBadge()['label'])
                      ? null
                      : () {
                          final cart = Provider.of<CartProvider>(context, listen: false);
                          cart.addLine(CartLineModel(
                            listingId: detail.id,
                            title: detail.title,
                            primaryImageUrl: detail.imageUrls.isNotEmpty ? detail.imageUrls.first : null,
                            dailyRent: detail.dailyRent,
                            securityDeposit: detail.securityDeposit,
                            quantity: _quantity,
                            rentalDays: _rentalDays,
                            orderType: _orderType,
                          ));
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Added to Cart!'), backgroundColor: Colors.green),
                          );
                        },
                  child: Text(
                    ['Out of stock', 'Unavailable', 'Out at this vendor'].contains(detail.getAvailabilityBadge()['label'])
                        ? 'Out of Stock'
                        : 'Add to Cart',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                ),
              ),
            )
          : null,
    );
  }

  Widget _buildRequirementChip(IconData icon, String label, bool isActive) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: isActive ? const Color(0xFF6C63FF).withOpacity(0.2) : Colors.white10,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isActive ? const Color(0xFF6C63FF) : Colors.transparent),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: isActive ? const Color(0xFF6C63FF) : Colors.white54),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              color: isActive ? const Color(0xFF6C63FF) : Colors.white54,
              fontSize: 13,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTypeOption(String value, String label) {
    final isSelected = _orderType == value;
    return GestureDetector(
      onTap: () {
        setState(() {
          _orderType = value;
        });
      },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF6C63FF) : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: isSelected ? const Color(0xFF6C63FF) : Colors.white24),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.white : Colors.white70,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }
}
