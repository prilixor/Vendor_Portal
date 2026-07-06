import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/providers/checkout_provider.dart';
import '../../core/providers/cart_provider.dart';
import '../../core/providers/address_provider.dart';

class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({super.key});

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  String? _selectedAddressId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final addrProv = Provider.of<AddressProvider>(context, listen: false);
      await addrProv.fetchAddresses();
      if (addrProv.addresses.isNotEmpty && mounted) {
        final defaultAddr = addrProv.addresses.firstWhere((a) => a.isDefault, orElse: () => addrProv.addresses.first);
        setState(() {
          _selectedAddressId = defaultAddr.id;
        });
        _fetchQuote();
      }
    });
  }

  void _fetchQuote() {
    final cart = Provider.of<CartProvider>(context, listen: false);
    if (cart.lines.isNotEmpty && _selectedAddressId != null) {
      Provider.of<CheckoutProvider>(context, listen: false).getQuote(cart.lines, addressId: _selectedAddressId);
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<CheckoutProvider>(context);
    final cart = Provider.of<CartProvider>(context);
    final addressProvider = Provider.of<AddressProvider>(context);
    final addresses = addressProvider.addresses;
    final quote = provider.quote;

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        title: const Text('Checkout', style: TextStyle(color: Colors.white)),
        backgroundColor: const Color(0xFF1E293B),
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: cart.lines.isEmpty
          ? const Center(child: Text('Cart is empty', style: TextStyle(color: Colors.white)))
          : SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Order Items', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 16),
                  
                  // Product Summary
                  ...cart.lines.map((line) {
                    return Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E293B),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.white10),
                      ),
                      child: Row(
                        children: [
                          if (line.primaryImageUrl != null && line.primaryImageUrl!.isNotEmpty)
                            ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: Image.network(
                                line.primaryImageUrl!, 
                                width: 50, 
                                height: 50, 
                                fit: BoxFit.cover,
                                errorBuilder: (context, error, stackTrace) => 
                                  Container(width: 50, height: 50, color: Colors.white10, child: const Icon(Icons.image, color: Colors.white54)),
                              ),
                            )
                          else
                            Container(width: 50, height: 50, color: Colors.white10, child: const Icon(Icons.image, color: Colors.white54)),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(line.title, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold), maxLines: 1, overflow: TextOverflow.ellipsis),
                                const SizedBox(height: 4),
                                Text('Qty: ${line.quantity} • ${line.orderType == 'buy' ? 'Buy' : 'Rent ${line.rentalDays} days'}', style: const TextStyle(color: Colors.white70, fontSize: 12)),
                              ],
                            ),
                          ),
                          Text('₹${line.lineTotal.toStringAsFixed(0)}', style: const TextStyle(color: Color(0xFF6C63FF), fontSize: 14, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    );
                  }).toList(),

                  const SizedBox(height: 24),
                  
                  // Address Selection
                  const Text('Delivery Address', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 16),
                  
                  if (addressProvider.isLoading)
                    const Center(child: CircularProgressIndicator(color: Color(0xFF6C63FF)))
                  else if (addresses.isEmpty)
                    const Text('No addresses found. Please add an address in your Profile.', style: TextStyle(color: Colors.white70))
                  else
                    Container(
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E293B),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.white10),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: _selectedAddressId,
                          isExpanded: true,
                          dropdownColor: const Color(0xFF1E293B),
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          style: const TextStyle(color: Colors.white, fontSize: 15),
                          icon: const Icon(Icons.arrow_drop_down, color: Colors.white54),
                          onChanged: (String? newValue) {
                            setState(() {
                              _selectedAddressId = newValue;
                            });
                            _fetchQuote();
                          },
                          items: addresses.map<DropdownMenuItem<String>>((addr) {
                            return DropdownMenuItem<String>(
                              value: addr.id,
                              child: Text('${addr.label ?? 'Address'} - ${addr.line1}, ${addr.city}'),
                            );
                          }).toList(),
                        ),
                      ),
                    ),

                  const SizedBox(height: 24),

                  // Order Summary Quote
                  const Text('Order Summary', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 16),
                  
                  if (provider.isLoading)
                    const Center(child: Padding(padding: EdgeInsets.all(20), child: CircularProgressIndicator(color: Color(0xFF6C63FF))))
                  else if (provider.errorMessage != null)
                    Text(provider.errorMessage!, style: const TextStyle(color: Colors.redAccent))
                  else if (quote != null)
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E293B),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.white10),
                      ),
                      child: Column(
                        children: [
                          _buildQuoteRow('Subtotal', quote.subtotalAmount),
                          if (quote.depositAmount > 0) ...[
                            const SizedBox(height: 8),
                            _buildQuoteRow('Security Deposit', quote.depositAmount),
                          ],
                          if (quote.serviceFeeAmount > 0) ...[
                            const SizedBox(height: 8),
                            _buildQuoteRow('Service Fee', quote.serviceFeeAmount),
                          ],
                          if (quote.gstAmount > 0) ...[
                            const SizedBox(height: 8),
                            _buildQuoteRow('Taxes (GST)', quote.gstAmount),
                          ],
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 12),
                            child: Divider(color: Colors.white24),
                          ),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('Total Amount', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                              Text('₹${quote.totalAmount.toStringAsFixed(0)}', style: const TextStyle(color: Color(0xFF6C63FF), fontSize: 20, fontWeight: FontWeight.bold)),
                            ],
                          ),
                        ],
                      ),
                    ),
                  
                  const SizedBox(height: 100), // Spacing for bottom sheet
                ],
              ),
            ),
      bottomSheet: quote != null
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
                  onPressed: provider.isPlacingOrder
                      ? null
                      : () async {
                          final success = await provider.placeOrder(cart.lines, addressId: _selectedAddressId);
                          if (success && mounted) {
                            cart.clearCart();
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Order placed successfully!'), backgroundColor: Colors.green),
                            );
                            Navigator.of(context).popUntil((route) => route.isFirst);
                          }
                        },
                  child: provider.isPlacingOrder
                      ? const CircularProgressIndicator(color: Colors.white)
                      : const Text(
                          'Place Order',
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                        ),
                ),
              ),
            )
          : null,
    );
  }

  Widget _buildQuoteRow(String label, double amount) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(color: Colors.white70, fontSize: 15)),
        Text('₹${amount.toStringAsFixed(0)}', style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w500)),
      ],
    );
  }
}
