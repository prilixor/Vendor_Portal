import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/models/vendor_catalog_model.dart';
import '../../core/providers/vendor_catalog_provider.dart';

class TrackSerialScreen extends StatefulWidget {
  const TrackSerialScreen({super.key});

  @override
  State<TrackSerialScreen> createState() => _TrackSerialScreenState();
}

class _TrackSerialScreenState extends State<TrackSerialScreen> {
  final _tagController = TextEditingController();
  TrackedAsset? _result;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _tagController.dispose();
    super.dispose();
  }

  Future<void> _track() async {
    final tag = _tagController.text.trim();
    if (tag.isEmpty) return;

    final vendorId =
        Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;

    setState(() {
      _loading = true;
      _error = null;
      _result = null;
    });

    final provider =
        Provider.of<VendorCatalogProvider>(context, listen: false);
    final result = await provider.trackAsset(vendorId: vendorId, assetTag: tag);
    if (!mounted) return;
    setState(() {
      _loading = false;
      _result = result;
      _error = result == null ? provider.error : null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Track serial number')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'Look up a serial or batch number across your inventory.',
            style: TextStyle(color: Colors.white54, fontSize: 13),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _tagController,
            style: const TextStyle(color: Colors.white),
            textInputAction: TextInputAction.search,
            onSubmitted: (_) => _track(),
            decoration: InputDecoration(
              labelText: 'Serial / batch tag',
              labelStyle: const TextStyle(color: Colors.white54),
              filled: true,
              fillColor: const Color(0xFF1E293B),
              border: const OutlineInputBorder(borderSide: BorderSide.none),
              suffixIcon: IconButton(
                onPressed: _loading ? null : _track,
                icon: const Icon(Icons.search, color: Color(0xFF6C63FF)),
              ),
            ),
          ),
          const SizedBox(height: 16),
          if (_loading)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: CircularProgressIndicator(color: Color(0xFF6C63FF)),
              ),
            )
          else if (_error != null)
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.redAccent.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.redAccent.withValues(alpha: 0.4)),
              ),
              child: Text(_error!, style: const TextStyle(color: Colors.redAccent)),
            )
          else if (_result != null)
            _TrackedAssetCard(asset: _result!),
        ],
      ),
    );
  }
}

class _TrackedAssetCard extends StatelessWidget {
  final TrackedAsset asset;

  const _TrackedAssetCard({required this.asset});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            asset.assetTag,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          _Row(label: 'Product', value: asset.productName),
          _Row(label: 'Status', value: asset.status),
          if (asset.condition != null && asset.condition!.isNotEmpty)
            _Row(label: 'Condition', value: asset.condition!),
          if (asset.currentOrderNumber != null &&
              asset.currentOrderNumber!.isNotEmpty)
            _Row(label: 'Order', value: asset.currentOrderNumber!),
          if (asset.currentCustomerName != null &&
              asset.currentCustomerName!.isNotEmpty)
            _Row(label: 'Customer', value: asset.currentCustomerName!),
          if (asset.dueDate != null && asset.dueDate!.isNotEmpty)
            _Row(label: 'Due', value: asset.dueDate!),
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  final String label;
  final String value;

  const _Row({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 90,
            child: Text(label, style: const TextStyle(color: Colors.white54, fontSize: 13)),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}
