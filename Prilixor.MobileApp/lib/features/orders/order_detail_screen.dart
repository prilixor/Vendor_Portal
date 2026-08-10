import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/providers/order_detail_provider.dart';
import '../../core/providers/order_provider.dart';
import '../../core/models/order_model.dart';
import '../../core/models/order_image_request_model.dart';
import '../../core/utils/rental_period.dart';
import '../../shared/widgets/catalog_image.dart';
import '../../shared/widgets/struck_price.dart';
import '../product/product_detail_screen.dart';
import '../../core/providers/chat_provider.dart';
import '../chat/chat_detail_screen.dart';
import '../profile/support_screen.dart';

class OrderDetailScreen extends StatefulWidget {
  final String orderNumber;
  final List<OrderModel> ordersInGroup;

  const OrderDetailScreen({super.key, required this.orderNumber, required this.ordersInGroup});

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  int _extensionDays = 1;
  int _selectedOrderIndex = 0;
  final Set<String> _photoRequestSelection = {};

  @override
  void initState() {
    super.initState();
    
    _selectedOrderIndex = widget.ordersInGroup.indexWhere((o) => o.orderNumber == widget.orderNumber);
    if (_selectedOrderIndex == -1) _selectedOrderIndex = 0;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      _fetchCurrentSubOrder();
    });
  }

  Future<void> _fetchCurrentSubOrder() async {
    final provider = Provider.of<OrderDetailProvider>(context, listen: false);
    await provider.fetchOrderDetail(widget.ordersInGroup[_selectedOrderIndex].id);
    await provider.fetchGroupImageRequests(
      widget.ordersInGroup.map((o) => o.id).toList(),
    );
    if (!mounted) return;
    _syncPhotoSelection(provider);
  }

  bool _canRequestForStatus(String status) {
    final compact = status.trim().toLowerCase().replaceAll(RegExp(r'\s+'), '_');
    return compact == 'pending' || compact == 'confirmed' || compact == 'in_transit';
  }

  List<OrderModel> _eligiblePhotoItems(OrderDetailProvider provider) {
    return widget.ordersInGroup
        .where(
          (o) =>
              _canRequestForStatus(o.status) &&
              provider.imageRequestFor(o.id) == null,
        )
        .toList();
  }

  void _syncPhotoSelection(OrderDetailProvider provider) {
    final eligible = _eligiblePhotoItems(provider).map((o) => o.id).toSet();
    setState(() {
      _photoRequestSelection
        ..removeWhere((id) => !eligible.contains(id))
        ..addAll(eligible);
    });
  }

  void _showExtensionBottomSheet(BuildContext context, OrderDetailProvider provider) {
    _extensionDays = 1;
    provider.clearQuotes();
    provider.quoteExtension(widget.ordersInGroup[_selectedOrderIndex].id, _extensionDays);

    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1E293B),
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setStateBottomSheet) {
            return Consumer<OrderDetailProvider>(
              builder: (context, provider, _) {
                return Padding(
                  padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom, left: 24, right: 24, top: 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Extend Rental', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  const Text('Need more time? Extend your rental period below.', style: TextStyle(color: Colors.white70, fontSize: 14)),
                  const SizedBox(height: 24),
                  
                  // Days Selector
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Additional Days:', style: TextStyle(color: Colors.white, fontSize: 16)),
                      Row(
                        children: [
                          IconButton(
                            icon: const Icon(Icons.remove_circle_outline, color: Colors.white54),
                            onPressed: _extensionDays > 1
                                ? () {
                                    setStateBottomSheet(() => _extensionDays--);
                                    provider.quoteExtension(widget.ordersInGroup[_selectedOrderIndex].id, _extensionDays);
                                  }
                                : null,
                          ),
                          Text('$_extensionDays', style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
                          IconButton(
                            icon: const Icon(Icons.add_circle_outline, color: Color(0xFF6C63FF)),
                            onPressed: () {
                              setStateBottomSheet(() => _extensionDays++);
                              provider.quoteExtension(widget.ordersInGroup[_selectedOrderIndex].id, _extensionDays);
                            },
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  
                  // Quote details
                  if (provider.isActionLoading)
                    const Center(child: CircularProgressIndicator(color: Color(0xFF6C63FF)))
                  else if (provider.extensionQuote != null)
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.05), borderRadius: BorderRadius.circular(12)),
                      child: Column(
                        children: [
                          _buildQuoteRow('Extension Cost', provider.extensionQuote!.extensionAmount),
                          // Service fee UI hidden — keep for future re-enable
                          if (false) ...[
                            const SizedBox(height: 8),
                            _buildQuoteRow('Service Fee', provider.extensionQuote!.serviceFeeAmount),
                          ],
                          const SizedBox(height: 8),
                          _buildQuoteRow('GST', provider.extensionQuote!.gstAmount),
                          const Divider(color: Colors.white24, height: 24),
                          _buildQuoteRow('Total Due Now', provider.extensionQuote!.totalAmount, isBold: true),
                          const SizedBox(height: 8),
                          Text(
                            'New End Date: ${provider.extensionQuote!.newEndDate.split('T')[0]}',
                            style: const TextStyle(color: Colors.greenAccent, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                  
                  const SizedBox(height: 32),
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF6C63FF)),
                      onPressed: provider.isActionLoading || provider.extensionQuote == null
                          ? null
                          : () async {
                              final success = await provider.processExtension(widget.ordersInGroup[_selectedOrderIndex].id, _extensionDays);
                              if (success && context.mounted) {
                                Navigator.pop(context);
                                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Rental extended successfully!'), backgroundColor: Colors.green));
                              }
                            },
                      child: const Text('Confirm Extension', style: TextStyle(fontSize: 18, color: Colors.white, fontWeight: FontWeight.bold)),
                    ),
                  ),
                  const SizedBox(height: 32),
                ],
              ),
            );
              },
            );
          },
        );
      },
    );
  }

  void _showBuyoutBottomSheet(BuildContext context, OrderDetailProvider provider) {
    provider.clearQuotes();
    provider.quoteBuyout(widget.ordersInGroup[_selectedOrderIndex].id);

    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1E293B),
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) {
        return Consumer<OrderDetailProvider>(
          builder: (context, provider, _) {
            return Padding(
              padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom, left: 24, right: 24, top: 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Buyout Equipment', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  const Text('Love it? Keep it! We will deduct a portion of your rental fees from the purchase price.', style: TextStyle(color: Colors.white70, fontSize: 14)),
                  const SizedBox(height: 24),
                  
                  if (provider.isActionLoading)
                    const Center(child: CircularProgressIndicator(color: Color(0xFF6C63FF)))
                  else if (provider.buyoutQuote != null)
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.05), borderRadius: BorderRadius.circular(12)),
                      child: Column(
                        children: [
                          _buildQuoteRow('Base Price', provider.buyoutQuote!.baseBuyoutAmount),
                          const SizedBox(height: 8),
                          _buildQuoteRow('Rental Deduction', -provider.buyoutQuote!.rentDeductionAmount, color: Colors.greenAccent),
                          // Service fee UI hidden — keep for future re-enable
                          if (false) ...[
                            const SizedBox(height: 8),
                            _buildQuoteRow('Service Fee', provider.buyoutQuote!.serviceFeeAmount),
                          ],
                          const SizedBox(height: 8),
                          _buildQuoteRow('GST', provider.buyoutQuote!.gstAmount),
                          const Divider(color: Colors.white24, height: 24),
                          _buildQuoteRow('Total Due Now', provider.buyoutQuote!.totalAmount, isBold: true),
                        ],
                      ),
                    ),
                  
                  const SizedBox(height: 32),
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF6C63FF)),
                      onPressed: provider.isActionLoading || provider.buyoutQuote == null
                          ? null
                          : () async {
                              final success = await provider.processBuyout(widget.ordersInGroup[_selectedOrderIndex].id);
                              if (success && context.mounted) {
                                Navigator.pop(context);
                                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Item purchased successfully!'), backgroundColor: Colors.green));
                              }
                            },
                      child: const Text('Confirm Purchase', style: TextStyle(fontSize: 18, color: Colors.white, fontWeight: FontWeight.bold)),
                    ),
                  ),
                  const SizedBox(height: 32),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildQuoteRow(String label, double amount, {bool isBold = false, Color? color}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: TextStyle(color: color ?? Colors.white70, fontSize: isBold ? 16 : 14, fontWeight: isBold ? FontWeight.bold : FontWeight.normal)),
        Text('₹${amount.toStringAsFixed(2)}', style: TextStyle(color: color ?? Colors.white, fontSize: isBold ? 18 : 14, fontWeight: isBold ? FontWeight.bold : FontWeight.normal)),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<OrderDetailProvider>(context);
    final groupTotal = widget.ordersInGroup.fold<double>(0, (sum, o) => sum + o.totalAmount);
    final groupDeposit = widget.ordersInGroup.fold<double>(0, (sum, o) => sum + o.depositAmount);
    final cleanOrderGroupNumber = widget.ordersInGroup.first.orderNumber.replaceAll(RegExp(r'-\d{2}$'), '');

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        title: const Text('Back to orders', style: TextStyle(color: Colors.white70, fontSize: 16)),
        backgroundColor: const Color(0xFF0F172A),
        iconTheme: const IconThemeData(color: Colors.white70),
        elevation: 0,
        titleSpacing: 0,
      ),
      body: Column(
        children: [
          // Header Card
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: const Color(0xFF1E293B), // Match dark mode card
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white10),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('ORDER GROUP', style: TextStyle(color: Colors.white54, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
                      const SizedBox(height: 8),
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        alignment: Alignment.centerLeft,
                        child: Text(cleanOrderGroupNumber, style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
                      ),
                      const SizedBox(height: 4),
                      const Text('Consolidated purchase overview', style: TextStyle(color: Colors.white54, fontSize: 14)),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text('₹${groupTotal.toStringAsFixed(0)}', style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 4),
                    Text('+ ₹${groupDeposit.toStringAsFixed(0)} deposit', style: const TextStyle(color: Colors.white54, fontSize: 12)),
                  ],
                ),
              ],
            ),
          ),

          Expanded(
            child: provider.isLoading && provider.currentOrder == null
                ? const Center(child: CircularProgressIndicator(color: Color(0xFF6C63FF)))
                : provider.currentOrder == null
                    ? Center(child: Text(provider.errorMessage ?? 'Order not found', style: const TextStyle(color: Colors.white)))
                    : SingleChildScrollView(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Items in this order
                            Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: const Color(0xFF1E293B),
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: Colors.white10),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('Items in this Order', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                                  const SizedBox(height: 4),
                                  const Text('Select an item below to track its individual timeline and details.', style: TextStyle(color: Colors.white54, fontSize: 12)),
                                  const SizedBox(height: 16),
                                  ...List.generate(widget.ordersInGroup.length, (index) {
                                    final order = widget.ordersInGroup[index];
                                    final isSelected = _selectedOrderIndex == index;
                                    return GestureDetector(
                                      onTap: () {
                                        setState(() => _selectedOrderIndex = index);
                                        _fetchCurrentSubOrder();
                                      },
                                      child: Container(
                                        margin: const EdgeInsets.only(bottom: 12),
                                        padding: const EdgeInsets.all(12),
                                        decoration: BoxDecoration(
                                          color: isSelected ? Colors.white.withValues(alpha: 0.05) : Colors.transparent,
                                          border: Border.all(color: isSelected ? const Color(0xFF6C63FF) : Colors.white10, width: isSelected ? 2 : 1),
                                          borderRadius: BorderRadius.circular(12),
                                        ),
                                        child: Row(
                                          children: [
                                            ClipRRect(
                                              borderRadius: BorderRadius.circular(8),
                                              child: SizedBox(
                                                width: 44,
                                                height: 44,
                                                child: CatalogImage(
                                                  url: order.listingPrimaryImageUrl,
                                                  width: 44,
                                                  height: 44,
                                                  fit: BoxFit.cover,
                                                ),
                                              ),
                                            ),
                                            const SizedBox(width: 12),
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment: CrossAxisAlignment.start,
                                                children: [
                                                  Text(order.listingTitle, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold), maxLines: 2, overflow: TextOverflow.ellipsis),
                                                  const SizedBox(height: 4),
                                                  Text('Qty: ${order.quantity}', style: const TextStyle(color: Colors.white54, fontSize: 12)),
                                                  const SizedBox(height: 6),
                                                  Wrap(
                                                    children: [
                                                      Container(
                                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                                        decoration: BoxDecoration(color: _getStatusColor(order.status).withValues(alpha: 0.2), borderRadius: BorderRadius.circular(16)),
                                                        child: Text(order.status.toUpperCase(), style: TextStyle(color: _getStatusColor(order.status), fontSize: 10, fontWeight: FontWeight.bold)),
                                                      ),
                                                    ],
                                                  ),
                                                ],
                                              ),
                                            ),
                                            const SizedBox(width: 8),
                                            Column(
                                              crossAxisAlignment: CrossAxisAlignment.end,
                                              children: [
                                                Text('₹${order.totalAmount.toStringAsFixed(0)}', style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                                              ],
                                            ),
                                          ],
                                        ),
                                      ),
                                    );
                                  }),
                                ],
                              ),
                            ),
                            const SizedBox(height: 24),

                            // Order Timeline
                            Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: const Color(0xFF1E293B),
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: Colors.white10),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      const Text('Order timeline', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                                      TextButton(
                                        onPressed: () {
                                          if (provider.currentOrder != null) {
                                            Navigator.push(
                                              context,
                                              MaterialPageRoute(
                                                builder: (context) => ProductDetailScreen(listingId: provider.currentOrder!.listingId),
                                              ),
                                            );
                                          }
                                        }, 
                                        child: const Text('View listing', style: TextStyle(color: Color(0xFF6C63FF)))
                                      ),
                                    ],
                                  ),
                                  Text('Tracking: ${provider.currentOrder!.listingTitle}', style: const TextStyle(color: Colors.white54, fontSize: 12)),
                                  const SizedBox(height: 24),
                                  _buildTimeline(provider.currentOrder!.status, provider.currentOrder!.orderType),
                                ],
                              ),
                            ),
                            const SizedBox(height: 24),

                            // Rental Details Grid
                            if (provider.currentOrder!.startDate != null)
                              Container(
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF1E293B),
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(color: Colors.white10),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(provider.currentOrder!.orderType.toLowerCase() == 'buy' ? 'Purchase details' : 'Rental details', style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                                    const SizedBox(height: 16),
                                    if (provider.currentOrder!.orderType.toLowerCase() == 'buy') ...[
                                      Row(
                                        children: [
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                const Text('PURCHASE DATE', style: TextStyle(color: Colors.white54, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
                                                const SizedBox(height: 4),
                                                Text(provider.currentOrder!.startDate!.split('T')[0], style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold)),
                                              ],
                                            ),
                                          ),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                const Text('QUANTITY', style: TextStyle(color: Colors.white54, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
                                                const SizedBox(height: 4),
                                                Text('${provider.currentOrder!.quantity}', style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold)),
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                    ] else ...[
                                      Row(
                                        children: [
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                const Text('START DATE', style: TextStyle(color: Colors.white54, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
                                                const SizedBox(height: 4),
                                                Text(provider.currentOrder!.startDate!.split('T')[0], style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold)),
                                              ],
                                            ),
                                          ),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                const Text('END DATE', style: TextStyle(color: Colors.white54, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
                                                const SizedBox(height: 4),
                                                Text(provider.currentOrder!.endDate?.split('T')[0] ?? '-', style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold)),
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 16),
                                      Row(
                                        children: [
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                const Text('QUANTITY', style: TextStyle(color: Colors.white54, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
                                                const SizedBox(height: 4),
                                                Text('${provider.currentOrder!.quantity}', style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold)),
                                              ],
                                            ),
                                          ),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  provider.currentOrder!.orderType.toLowerCase() == 'rent'
                                                      ? 'RENTAL PERIOD'
                                                      : 'ORDER TYPE',
                                                  style: const TextStyle(color: Colors.white54, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1.2),
                                                ),
                                                const SizedBox(height: 4),
                                                Text(
                                                  provider.currentOrder!.orderType.toLowerCase() == 'rent'
                                                      ? (provider.currentOrder!.rentalDurationLabel?.isNotEmpty == true
                                                          ? '${provider.currentOrder!.rentalDurationLabel}'
                                                              '${provider.currentOrder!.rentalDurationDays != null ? ' (${provider.currentOrder!.rentalDurationDays} days)' : ''}'
                                                          : formatRentalDuration(
                                                              provider.currentOrder!.rentalDays,
                                                              provider.currentOrder!.rentalPeriodUnit,
                                                            ))
                                                      : 'Buy',
                                                  style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
                                                ),
                                                if (provider.currentOrder!.orderType.toLowerCase() == 'rent' &&
                                                    provider.currentOrder!.rentalFinalPrice != null) ...[
                                                  const SizedBox(height: 4),
                                                  Wrap(
                                                    crossAxisAlignment: WrapCrossAlignment.center,
                                                    spacing: 6,
                                                    children: [
                                                      if (provider.currentOrder!.rentalNormalPrice != null &&
                                                          provider.currentOrder!.rentalNormalPrice! >
                                                              provider.currentOrder!.rentalFinalPrice!)
                                                        StruckPrice(
                                                          '₹${provider.currentOrder!.rentalNormalPrice!.toStringAsFixed(0)}',
                                                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                                                        ),
                                                      Text(
                                                        'Plan price ₹${provider.currentOrder!.rentalFinalPrice!.toStringAsFixed(0)}',
                                                        style: const TextStyle(color: Colors.white54, fontSize: 12),
                                                      ),
                                                    ],
                                                  ),
                                                ],
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ],
                                ),
                              ),

                            if (provider.currentOrder!.hasMedicalReference) ...[
                              const SizedBox(height: 24),
                              _MedicalReferenceCard(order: provider.currentOrder!),
                            ],

                            if (_shouldShowGroupPhotoSection(provider)) ...[
                              const SizedBox(height: 24),
                              _GroupVendorPhotoRequestCard(
                                items: widget.ordersInGroup,
                                requestsByOrderId: provider.imageRequestsByOrderId,
                                selectedIds: _photoRequestSelection,
                                loading: provider.imageRequestLoading,
                                busy: provider.isActionLoading,
                                onToggle: (orderId, selected) {
                                  setState(() {
                                    if (selected) {
                                      _photoRequestSelection.add(orderId);
                                    } else {
                                      _photoRequestSelection.remove(orderId);
                                    }
                                  });
                                },
                                onSelectAll: () {
                                  setState(() {
                                    _photoRequestSelection
                                      ..clear()
                                      ..addAll(
                                        _eligiblePhotoItems(provider).map((o) => o.id),
                                      );
                                  });
                                },
                                onClear: () => setState(_photoRequestSelection.clear),
                                onRequestAll: () => _requestPhotos(
                                  provider,
                                  _eligiblePhotoItems(provider).map((o) => o.id).toList(),
                                ),
                                onRequestSelected: () => _requestPhotos(
                                  provider,
                                  _photoRequestSelection.toList(),
                                ),
                              ),
                            ],
                            
                            const SizedBox(height: 24),

                            // Bottom Action Buttons
                            Builder(
                              builder: (context) {
                                final order = provider.currentOrder!;
                                final status = order.status.trim().toLowerCase();
                                final canCancel = status == 'pending' || status == 'awaiting vendor acceptance';
                                final canExtendBuyout = status == 'active' && order.orderType.toLowerCase() == 'rent';

                                return Column(
                                  crossAxisAlignment: CrossAxisAlignment.stretch,
                                  children: [
                                    Row(
                                      children: [
                                        Expanded(
                                          child: OutlinedButton.icon(
                                            style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: const BorderSide(color: Colors.white24), padding: const EdgeInsets.symmetric(vertical: 16)),
                                            icon: const Icon(Icons.support_agent, size: 18),
                                            label: const Text('BlinksMed support', style: TextStyle(fontSize: 14)),
                                            onPressed: () {
                                              Navigator.push(
                                                context,
                                                MaterialPageRoute(
                                                  builder: (_) => SupportScreen(orderRef: order.orderNumber),
                                                ),
                                              );
                                            },
                                          ),
                                        ),
                                        const SizedBox(width: 12),
                                        Expanded(
                                          child: OutlinedButton.icon(
                                            style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: const BorderSide(color: Colors.white24), padding: const EdgeInsets.symmetric(vertical: 16)),
                                            icon: const Icon(Icons.chat_bubble_outline, size: 18),
                                            label: const Text('Chat with BlinksMed', style: TextStyle(fontSize: 14)),
                                            onPressed: () async {
                                              final chatProvider = Provider.of<ChatProvider>(context, listen: false);
                                              final sessionId = await chatProvider.createSession(
                                                order.vendorId,
                                                order.id,
                                                subject: 'Chat regarding order ${order.orderNumber}: ${order.listingTitle}',
                                              );
                                              if (sessionId != null && context.mounted) {
                                                Navigator.push(
                                                  context,
                                                  MaterialPageRoute(
                                                    builder: (context) => ChatDetailScreen(
                                                      sessionId: sessionId,
                                                      orderNumber: order.orderNumber,
                                                      listingTitle: order.listingTitle,
                                                    ),
                                                  ),
                                                );
                                              } else if (context.mounted) {
                                                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not start chat session.')));
                                              }
                                            },
                                          ),
                                        ),
                                      ],
                                    ),
                                    if (canCancel) ...[
                                      const SizedBox(height: 12),
                                      OutlinedButton.icon(
                                        style: OutlinedButton.styleFrom(
                                          foregroundColor: Colors.redAccent,
                                          side: const BorderSide(color: Colors.redAccent),
                                          padding: const EdgeInsets.symmetric(vertical: 16),
                                        ),
                                        icon: const Icon(Icons.cancel_outlined, size: 18),
                                        label: const Text('Cancel item request', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
                                        onPressed: provider.isActionLoading
                                            ? null
                                            : () async {
                                                final confirm = await showDialog<bool>(
                                                  context: context,
                                                  builder: (ctx) => AlertDialog(
                                                    backgroundColor: const Color(0xFF1E293B),
                                                    title: const Text('Cancel request?', style: TextStyle(color: Colors.white)),
                                                    content: const Text(
                                                      'This will cancel this item request. This cannot be undone.',
                                                      style: TextStyle(color: Colors.white70),
                                                    ),
                                                    actions: [
                                                      TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Keep', style: TextStyle(color: Colors.white54))),
                                                      TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Cancel request', style: TextStyle(color: Colors.redAccent))),
                                                    ],
                                                  ),
                                                );
                                                if (confirm != true || !context.mounted) return;
                                                final ok = await provider.cancelOrder(order.id);
                                                if (!context.mounted) return;
                                                if (ok) {
                                                  ScaffoldMessenger.of(context).showSnackBar(
                                                    const SnackBar(content: Text('Order cancelled.'), backgroundColor: Colors.green),
                                                  );
                                                  Provider.of<OrderProvider>(context, listen: false).fetchOrders(silent: true);
                                                } else {
                                                  ScaffoldMessenger.of(context).showSnackBar(
                                                    SnackBar(content: Text(provider.errorMessage ?? 'Failed to cancel order'), backgroundColor: Colors.redAccent),
                                                  );
                                                }
                                              },
                                      ),
                                    ],
                                    if (canExtendBuyout) ...[
                                      const SizedBox(height: 12),
                                      Row(
                                        children: [
                                          Expanded(
                                            child: ElevatedButton(
                                              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF6C63FF), padding: const EdgeInsets.symmetric(vertical: 16)),
                                              onPressed: () => _showExtensionBottomSheet(context, provider),
                                              child: const FittedBox(fit: BoxFit.scaleDown, child: Text('Extend Rental', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold))),
                                            ),
                                          ),
                                          const SizedBox(width: 12),
                                          Expanded(
                                            child: ElevatedButton(
                                              style: ElevatedButton.styleFrom(backgroundColor: Colors.white10, padding: const EdgeInsets.symmetric(vertical: 16)),
                                              onPressed: () => _showBuyoutBottomSheet(context, provider),
                                              child: const FittedBox(fit: BoxFit.scaleDown, child: Text('Buyout Item', style: TextStyle(color: Colors.white))),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ],
                                );
                              },
                            ),
                            const SizedBox(height: 32),
                          ],
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  bool _shouldShowGroupPhotoSection(OrderDetailProvider provider) {
    if (provider.imageRequestsByOrderId.isNotEmpty) return true;
    return widget.ordersInGroup.any((o) {
      final compact = o.status.trim().toLowerCase().replaceAll(RegExp(r'\s+'), '_');
      return compact == 'pending' ||
          compact == 'confirmed' ||
          compact == 'in_transit' ||
          compact == 'awaiting_vendor_acceptance' ||
          compact == 'pending_vendor_acceptance';
    });
  }

  Future<void> _requestPhotos(
    OrderDetailProvider provider,
    List<String> orderIds,
  ) async {
    if (orderIds.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Select at least one item.')),
      );
      return;
    }
    final result = await provider.createImageRequests(orderIds);
    if (!mounted) return;
    await provider.fetchGroupImageRequests(
      widget.ordersInGroup.map((o) => o.id).toList(),
    );
    if (!mounted) return;
    _syncPhotoSelection(provider);
    final message = result.succeeded == 0
        ? (provider.errorMessage ?? 'Failed to request photos.')
        : result.succeeded == 1
            ? 'Photo request sent to the supplier.'
            : 'Photo request sent to suppliers for ${result.succeeded} products.';
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: result.succeeded == 0 ? Colors.redAccent : null,
      ),
    );
  }

  Color _getStatusColor(String status) {
    final s = status.toLowerCase();
    if (s == 'active') return Colors.greenAccent;
    if (s == 'pending' || s == 'confirmed' || s.contains('transit')) return Colors.orangeAccent;
    if (s == 'cancelled' || s == 'canceled') return Colors.grey;
    if (s == 'bought_out') return Colors.purpleAccent;
    return Colors.white70;
  }

  Widget _buildTimeline(String status, String orderType) {
    final s = status.toLowerCase();
    final isBuy = orderType.toLowerCase() == 'buy';
    
    int currentIndex = 1;
    if (s == 'confirmed') currentIndex = 2;
    if (s.contains('transit')) currentIndex = 3;
    if (s == 'delivered') currentIndex = 4;
    if (s == 'active') currentIndex = 5;
    if (s == 'returned' || s == 'bought_out') currentIndex = 6;

    final steps = isBuy ? ['Order Placed', 'Vendor Confirmed', 'Out for Delivery', 'Delivered & Purchased'] 
                        : ['Order Placed', 'Vendor Confirmed', 'Out for Delivery', 'Delivered', 'Rental Active', 'Returned'];

    return Column(
      children: List.generate(steps.length, (index) {
        final isDone = index < currentIndex - 1;
        final isCurrent = index == currentIndex - 1;
        
        Color dotColor;
        Widget? icon;
        
        if (isDone && !isCurrent) {
          dotColor = Colors.white; // Or dark grey in dark mode
          icon = const Icon(Icons.check, size: 14, color: Colors.black);
        } else if (isCurrent) {
          dotColor = const Color(0xFF10B981); // Emerald Green
          icon = Container(width: 8, height: 8, decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle));
        } else {
          dotColor = Colors.transparent;
        }

        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Column(
              children: [
                Container(
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(
                    color: dotColor,
                    shape: BoxShape.circle,
                    border: Border.all(color: isDone || isCurrent ? dotColor : Colors.white24, width: 2),
                  ),
                  child: Center(child: icon),
                ),
                if (index < steps.length - 1)
                  Container(
                    width: 2,
                    height: 40,
                    color: Colors.white10,
                  ),
              ],
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      steps[index],
                      style: TextStyle(
                        color: isDone || isCurrent ? Colors.white : Colors.white54,
                        fontSize: 16,
                      ),
                    ),
                    if (isCurrent && steps[index] == 'Rental Active')
                      const Padding(
                        padding: EdgeInsets.only(top: 4.0),
                        child: Text('Rental is currently active', style: TextStyle(color: Color(0xFF10B981), fontSize: 12)),
                      ),
                  ],
                ),
              ),
            ),
          ],
        );
      }),
    );
  }

}

class _GroupVendorPhotoRequestCard extends StatelessWidget {
  final List<OrderModel> items;
  final Map<String, OrderImageRequestModel> requestsByOrderId;
  final Set<String> selectedIds;
  final bool loading;
  final bool busy;
  final void Function(String orderId, bool selected) onToggle;
  final VoidCallback onSelectAll;
  final VoidCallback onClear;
  final Future<void> Function() onRequestAll;
  final Future<void> Function() onRequestSelected;

  const _GroupVendorPhotoRequestCard({
    required this.items,
    required this.requestsByOrderId,
    required this.selectedIds,
    required this.loading,
    required this.busy,
    required this.onToggle,
    required this.onSelectAll,
    required this.onClear,
    required this.onRequestAll,
    required this.onRequestSelected,
  });

  bool _canRequest(String status) {
    final compact = status.trim().toLowerCase().replaceAll(RegExp(r'\s+'), '_');
    return compact == 'pending' || compact == 'confirmed' || compact == 'in_transit';
  }

  void _preview(BuildContext context, OrderImageModel image) {
    showDialog<void>(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.black,
        insetPadding: const EdgeInsets.all(16),
        child: Stack(
          children: [
            InteractiveViewer(
              child: AspectRatio(
                aspectRatio: 1,
                child: Image.network(
                  image.fileUrl,
                  fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) => const Center(
                    child: Icon(Icons.broken_image_outlined, color: Colors.white54, size: 48),
                  ),
                ),
              ),
            ),
            Positioned(
              top: 4,
              right: 4,
              child: IconButton(
                onPressed: () => Navigator.pop(ctx),
                icon: const Icon(Icons.close, color: Colors.white),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final eligible = items
        .where((o) => _canRequest(o.status) && !requestsByOrderId.containsKey(o.id))
        .toList();
    final withRequest = items.where((o) => requestsByOrderId.containsKey(o.id)).toList();
    final multi = items.length > 1;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Request photos from your supplier',
            style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 6),
          Text(
            multi
                ? 'Sent to each product’s supplier (vendor) — not BlinksMed support. Choose products or request all. Up to 5 photos per item.'
                : 'Sent to the supplier for this product — not BlinksMed support chat below. Up to 5 photos.',
            style: const TextStyle(color: Colors.white54, fontSize: 12, height: 1.35),
          ),
          const SizedBox(height: 14),
          if (loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Row(
                children: [
                  SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF6C63FF)),
                  ),
                  SizedBox(width: 10),
                  Text('Loading photo requests…', style: TextStyle(color: Colors.white54, fontSize: 13)),
                ],
              ),
            )
          else ...[
            if (eligible.isNotEmpty) ...[
              if (multi) ...[
                Row(
                  children: [
                    TextButton(
                      onPressed: busy ? null : onSelectAll,
                      child: const Text('Select all', style: TextStyle(color: Color(0xFF6C63FF), fontSize: 12)),
                    ),
                    TextButton(
                      onPressed: busy ? null : onClear,
                      child: const Text('Clear', style: TextStyle(color: Colors.white54, fontSize: 12)),
                    ),
                  ],
                ),
                ...eligible.map((item) {
                  final checked = selectedIds.contains(item.id);
                  return CheckboxListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    value: checked,
                    activeColor: const Color(0xFF6C63FF),
                    checkColor: Colors.white,
                    title: Text(item.listingTitle, style: const TextStyle(color: Colors.white, fontSize: 13)),
                    subtitle: Text(
                      item.status.replaceAll('_', ' '),
                      style: const TextStyle(color: Colors.white54, fontSize: 11),
                    ),
                    onChanged: busy ? null : (v) => onToggle(item.id, v == true),
                  );
                }),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF6C63FF)),
                        onPressed: busy ? null : () => onRequestAll(),
                        icon: busy
                            ? const SizedBox(
                                width: 14,
                                height: 14,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : const Icon(Icons.photo_library_outlined, size: 16, color: Colors.white),
                        label: Text('Request all from suppliers (${eligible.length})', style: const TextStyle(color: Colors.white, fontSize: 12)),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.white,
                          side: const BorderSide(color: Colors.white24),
                        ),
                        onPressed: busy || selectedIds.isEmpty ? null : () => onRequestSelected(),
                        icon: const Icon(Icons.check_box_outlined, size: 16),
                        label: Text('Selected (${selectedIds.length})', style: const TextStyle(fontSize: 12)),
                      ),
                    ),
                  ],
                ),
              ] else
                OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    side: const BorderSide(color: Colors.white24),
                    padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
                  ),
                  onPressed: busy ? null : () => onRequestSelected(),
                  icon: busy
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white70),
                        )
                      : const Icon(Icons.photo_library_outlined, size: 18),
                  label: Text(busy ? 'Sending…' : 'Request photos from supplier'),
                ),
              const SizedBox(height: 16),
            ],
            if (withRequest.isEmpty && eligible.isEmpty)
              const Text(
                'You can request supplier photos after a supplier accepts each product.',
                style: TextStyle(color: Colors.white54, fontSize: 13),
              ),
            if (withRequest.isNotEmpty) ...[
              Text(
                multi
                    ? 'Supplier photos for this order'
                    : 'Supplier photos received',
                style: const TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 10),
              ...withRequest.map((item) {
                final images = requestsByOrderId[item.id]?.images ?? const <OrderImageModel>[];
                return Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (multi)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Text(
                            '${item.listingTitle} · ${images.isEmpty ? 'Waiting on supplier' : '${images.length}/5'}',
                            style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                          ),
                        ),
                      if (images.isEmpty)
                        const Text(
                          'Request sent to the supplier — photos not uploaded yet.',
                          style: TextStyle(color: Colors.white54, fontSize: 12),
                        )
                      else
                        GridView.builder(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: images.length,
                          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 3,
                            mainAxisSpacing: 8,
                            crossAxisSpacing: 8,
                          ),
                          itemBuilder: (context, index) {
                            final image = images[index];
                            return Material(
                              color: Colors.white.withValues(alpha: 0.06),
                              borderRadius: BorderRadius.circular(10),
                              clipBehavior: Clip.antiAlias,
                              child: InkWell(
                                onTap: () => _preview(context, image),
                                child: Image.network(
                                  image.fileUrl,
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, __, ___) => const Center(
                                    child: Icon(Icons.broken_image_outlined, color: Colors.white38),
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                    ],
                  ),
                );
              }),
            ],
          ],
        ],
      ),
    );
  }
}

class _MedicalReferenceCard extends StatelessWidget {
  final OrderModel order;

  const _MedicalReferenceCard({required this.order});

  @override
  Widget build(BuildContext context) {
    final doctorName = order.doctorName?.trim();
    final specialization = order.doctorSpecialization?.trim();
    final uniqueCode = order.doctorUniqueCode?.trim();
    final contact = order.doctorContactNumber?.trim();
    final hospitalName = order.hospitalName?.trim();
    final hospitalCity = order.hospitalCity?.trim();

    String? doctorValue;
    if (doctorName != null && doctorName.isNotEmpty) {
      doctorValue = specialization != null && specialization.isNotEmpty
          ? '$doctorName — $specialization'
          : doctorName;
    }

    String? hospitalValue;
    if (hospitalName != null && hospitalName.isNotEmpty) {
      hospitalValue = hospitalCity != null && hospitalCity.isNotEmpty
          ? '$hospitalName ($hospitalCity)'
          : hospitalName;
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Medical reference',
            style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 16),
          if (doctorValue != null) _labeledRow('Doctor', doctorValue),
          if (uniqueCode != null && uniqueCode.isNotEmpty) ...[
            if (doctorValue != null) const SizedBox(height: 12),
            _labeledRow(
              'Unique ID',
              uniqueCode,
              valueStyle: const TextStyle(
                color: Color(0xFF2DD4BF),
                fontSize: 14,
                fontWeight: FontWeight.w700,
                fontFamily: 'monospace',
                letterSpacing: 1.2,
              ),
            ),
          ],
          if (contact != null && contact.isNotEmpty) ...[
            const SizedBox(height: 12),
            _labeledRow('Contact', contact),
          ],
          if (hospitalValue != null) ...[
            const SizedBox(height: 12),
            _labeledRow('Hospital', hospitalValue),
          ],
        ],
      ),
    );
  }

  Widget _labeledRow(String label, String value, {TextStyle? valueStyle}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: const TextStyle(
            color: Colors.white54,
            fontSize: 10,
            fontWeight: FontWeight.bold,
            letterSpacing: 1.2,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: valueStyle ??
              const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600),
        ),
      ],
    );
  }
}
