import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/providers/order_provider.dart';
import '../../core/models/order_model.dart';
import 'order_detail_screen.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<OrderProvider>(context, listen: false).fetchOrders();
    });
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<OrderProvider>(context);

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        title: const Text('My Rentals', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF0F172A),
        elevation: 0,
      ),
      body: provider.isLoading && provider.orders.isEmpty
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF6C63FF)))
          : provider.errorMessage != null
              ? Center(child: Text(provider.errorMessage!, style: const TextStyle(color: Colors.redAccent)))
              : RefreshIndicator(
                  color: const Color(0xFF6C63FF),
                  onRefresh: provider.fetchOrders,
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Dashboard Stats Section
                        Row(
                          children: [
                            Expanded(
                              child: _buildStatCard(
                                'Active rentals',
                                provider.activeRentalsCount.toString(),
                                '\$${provider.activeRentalsTotal.toStringAsFixed(0)} in flight',
                                true,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: _buildStatCard(
                                'Upcoming deliveries',
                                provider.upcomingDeliveriesCount.toString(),
                                'Pending & in transit',
                                true,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 24),
                        
                        // Recent Activity / Orders List
                        const Text('Recent Activity', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
                        const SizedBox(height: 12),
                        
                        if (provider.orders.isEmpty)
                          const Center(
                            child: Padding(
                              padding: EdgeInsets.all(40.0),
                              child: Text('No orders found.', style: TextStyle(color: Colors.white54, fontSize: 16)),
                            ),
                          )
                        else ...[
                          Builder(
                            builder: (context) {
                              final Map<String, List<OrderModel>> groups = {};
                              for (var order in provider.orders) {
                                String baseOrder = order.orderNumber;
                                if (baseOrder.contains('-')) {
                                  final parts = baseOrder.split('-');
                                  if (parts.length >= 3) {
                                    baseOrder = parts.sublist(0, 3).join('-');
                                  }
                                }
                                groups.putIfAbsent(baseOrder, () => []).add(order);
                              }
                              final groupKeys = groups.keys.toList();
                              
                              return ListView.separated(
                                shrinkWrap: true,
                                physics: const NeverScrollableScrollPhysics(),
                                itemCount: groupKeys.length,
                                separatorBuilder: (context, index) => const SizedBox(height: 12),
                                itemBuilder: (context, index) {
                                  final orderGroup = groups[groupKeys[index]]!;
                                  return _buildOrderGroupCard(context, groupKeys[index], orderGroup);
                                },
                              );
                            },
                          ),
                        ]
                      ],
                    ),
                  ),
                ),
    );
  }

  Widget _buildStatCard(String title, String value, String subtitle, bool isLive) {
    return Container(
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
              Expanded(child: Text(title, style: const TextStyle(color: Colors.white70, fontSize: 12), maxLines: 1, overflow: TextOverflow.ellipsis)),
              if (isLive)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.white10,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text('Live', style: TextStyle(color: Colors.white, fontSize: 10)),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Text(value, style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          Text(subtitle, style: const TextStyle(color: Colors.white54, fontSize: 11), maxLines: 1, overflow: TextOverflow.ellipsis),
        ],
      ),
    );
  }

  Widget _buildOrderGroupCard(BuildContext context, String baseOrderNumber, List<OrderModel> ordersInGroup) {
    final double groupTotal = ordersInGroup.fold(0.0, (sum, order) => sum + order.totalAmount);
    final String placedOn = ordersInGroup.first.startDate ?? 'Unknown';

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('ORDER GROUP', style: TextStyle(color: Colors.white54, fontSize: 11, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 4),
                      Text(baseOrderNumber, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text('Placed On: $placedOn', style: const TextStyle(color: Colors.white70, fontSize: 12)),
                    const SizedBox(height: 4),
                    Text('Total Paid: \$${groupTotal.toStringAsFixed(0)}', style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold)),
                  ],
                ),
              ],
            ),
          ),
          const Divider(color: Colors.white10, height: 1),
          ...ordersInGroup.asMap().entries.map((entry) {
            final index = entry.key;
            final order = entry.value;
            return Column(
              children: [
                _buildItemTile(context, order, ordersInGroup),
                if (index < ordersInGroup.length - 1)
                  const Divider(color: Colors.white10, height: 1, indent: 16, endIndent: 16),
              ],
            );
          }),
        ],
      ),
    );
  }

  Widget _buildItemTile(BuildContext context, OrderModel order, List<OrderModel> ordersInGroup) {
    return InkWell(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(builder: (context) => OrderDetailScreen(orderNumber: order.orderNumber, ordersInGroup: ordersInGroup)),
        );
      },
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: const Color(0xFF0F172A),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.white10),
                image: order.listingPrimaryImageUrl != null
                    ? DecorationImage(image: NetworkImage(order.listingPrimaryImageUrl!), fit: BoxFit.cover)
                    : null,
              ),
              child: order.listingPrimaryImageUrl == null
                  ? const Icon(Icons.inventory_2_outlined, color: Colors.white24)
                  : null,
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    order.listingTitle,
                    style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Period: ${order.startDate ?? ''} → ${order.endDate ?? ''} • Qty: ${order.quantity}',
                    style: const TextStyle(color: Colors.white54, fontSize: 12),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.blue.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(color: Colors.blue.withOpacity(0.2)),
                        ),
                        child: Text(
                          order.orderType.toUpperCase(),
                          style: const TextStyle(color: Colors.blueAccent, fontSize: 10, fontWeight: FontWeight.bold),
                        ),
                      ),
                      _buildStatusBadge(order.status),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text('\$${order.totalAmount.toStringAsFixed(0)}', style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold)),
                const SizedBox(height: 4),
                const Text('Details >', style: TextStyle(color: Color(0xFF6C63FF), fontSize: 12, fontWeight: FontWeight.w600)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
    Color bgColor;
    Color textColor;

    switch (status.toLowerCase()) {
      case 'active':
        bgColor = Colors.green.withOpacity(0.2);
        textColor = Colors.greenAccent;
        break;
      case 'pending':
      case 'confirmed':
      case 'in transit':
        bgColor = Colors.orange.withOpacity(0.2);
        textColor = Colors.orangeAccent;
        break;
      case 'completed':
      case 'bought_out':
        bgColor = Colors.blue.withOpacity(0.2);
        textColor = Colors.lightBlueAccent;
        break;
      default:
        bgColor = Colors.white10;
        textColor = Colors.white70;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        status.toUpperCase(),
        style: TextStyle(color: textColor, fontSize: 10, fontWeight: FontWeight.bold),
      ),
    );
  }
}
