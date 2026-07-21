import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/models/vendor_catalog_model.dart';

/// Per-packaging-size stock inputs — used when creating chemical listings and editing inventory.
class ChemicalVariantStockFields extends StatefulWidget {
  final List<ChemicalVariantStockRow> rows;
  final ValueChanged<List<ChemicalVariantStockRow>> onChanged;
  final bool readOnly;

  const ChemicalVariantStockFields({
    super.key,
    required this.rows,
    required this.onChanged,
    this.readOnly = false,
  });

  @override
  State<ChemicalVariantStockFields> createState() =>
      _ChemicalVariantStockFieldsState();
}

class _ChemicalVariantStockFieldsState extends State<ChemicalVariantStockFields> {
  final Map<String, TextEditingController> _controllers = {};

  @override
  void initState() {
    super.initState();
    _syncControllers();
  }

  @override
  void didUpdateWidget(covariant ChemicalVariantStockFields oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.rows.length != widget.rows.length ||
        oldWidget.rows.map((r) => r.productVariantId).join() !=
            widget.rows.map((r) => r.productVariantId).join()) {
      _syncControllers();
    } else {
      for (final row in widget.rows) {
        final controller = _controllers[row.productVariantId];
        if (controller != null && controller.text != '${row.total}') {
          controller.text = '${row.total}';
        }
      }
    }
  }

  void _syncControllers() {
    final ids = widget.rows.map((r) => r.productVariantId).toSet();
    for (final id in _controllers.keys.toList()) {
      if (!ids.contains(id)) {
        _controllers[id]?.dispose();
        _controllers.remove(id);
      }
    }
    for (final row in widget.rows) {
      _controllers.putIfAbsent(
        row.productVariantId,
        () => TextEditingController(text: '${row.total}'),
      );
    }
  }

  @override
  void dispose() {
    for (final c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  void _updateTotal(int index, String value) {
    final parsed = int.tryParse(value.trim()) ?? 0;
    final next = widget.rows
        .map(
          (row) => ChemicalVariantStockRow(
            productVariantId: row.productVariantId,
            sku: row.sku,
            sizeLabel: row.sizeLabel,
            total: row.total,
            reserved: row.reserved,
            available: row.available,
          ),
        )
        .toList();
    next[index].setTotal(parsed < 0 ? 0 : parsed);
    widget.onChanged(next);
  }

  @override
  Widget build(BuildContext context) {
    if (widget.rows.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFF1E293B),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Colors.white12),
        ),
        child: const Text(
          'No packaging sizes found. Ask Admin to add sizes (e.g. 1L, 5L) for this chemical.',
          style: TextStyle(color: Colors.white54, fontSize: 13),
        ),
      );
    }

    return Column(
      children: [
        for (var i = 0; i < widget.rows.length; i++) ...[
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFF1E293B),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.white12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${widget.rows[i].sizeLabel} · ${widget.rows[i].sku}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                if (widget.readOnly)
                  Text(
                    'Total ${widget.rows[i].total} · Reserved ${widget.rows[i].reserved} · Available ${widget.rows[i].available}',
                    style: const TextStyle(color: Colors.white54, fontSize: 13),
                  )
                else
                  TextField(
                    controller: _controllers[widget.rows[i].productVariantId],
                    keyboardType: TextInputType.number,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      labelText: 'Total units',
                      labelStyle: const TextStyle(color: Colors.white54),
                      filled: true,
                      fillColor: const Color(0xFF0F172A),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: BorderSide.none,
                      ),
                    ),
                    onChanged: (v) => _updateTotal(i, v),
                  ),
                if (!widget.readOnly && widget.rows[i].reserved > 0) ...[
                  const SizedBox(height: 6),
                  Text(
                    'Reserved ${widget.rows[i].reserved} · Available ${widget.rows[i].available}',
                    style: const TextStyle(color: Colors.white54, fontSize: 12),
                  ),
                ],
              ],
            ),
          ),
          if (i < widget.rows.length - 1) const SizedBox(height: 8),
        ],
      ],
    );
  }
}
