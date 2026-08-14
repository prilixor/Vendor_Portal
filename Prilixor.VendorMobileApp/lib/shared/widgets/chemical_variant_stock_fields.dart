import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/models/vendor_catalog_model.dart';
import '../../core/theme.dart';

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
    _syncControllers();
  }

  void _syncControllers() {
    for (final row in widget.rows) {
      final id = row.productVariantId;
      final text = row.total.toString();
      if (!_controllers.containsKey(id)) {
        _controllers[id] = TextEditingController(text: text);
      } else if (_controllers[id]!.text != text) {
        _controllers[id]!.text = text;
      }
    }
  }

  @override
  void dispose() {
    for (final c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  void _updateTotal(int index, String raw) {
    final parsed = int.tryParse(raw.trim()) ?? 0;
    final copy = List<ChemicalVariantStockRow>.from(widget.rows);
    final cur = copy[index];

    final reserved = cur.reserved;
    final newTotal = parsed < reserved ? reserved : parsed;
    final available = newTotal - reserved;

    copy[index] = ChemicalVariantStockRow(
      productVariantId: cur.productVariantId,
      sku: cur.sku,
      sizeLabel: cur.sizeLabel,
      total: newTotal,
      reserved: cur.reserved,
      available: available,
    );
    widget.onChanged(copy);
  }

  @override
  Widget build(BuildContext context) {
    if (widget.rows.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: context.appColors.surfaceElevated,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: context.appColors.border),
        ),
        child: Text(
          'No packaging sizes found. Ask Admin to add sizes (e.g. 1L, 5L) for this chemical.',
          style: TextStyle(color: context.appColors.textMuted, fontSize: 13),
        ),
      );
    }

    return Column(
      children: [
        for (var i = 0; i < widget.rows.length; i++) ...[
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: context.appColors.surfaceElevated,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: context.appColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${widget.rows[i].sizeLabel} · ${widget.rows[i].sku}',
                  style: TextStyle(
                    color: context.appColors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                if (widget.readOnly)
                  Text(
                    'Total ${widget.rows[i].total} · Reserved ${widget.rows[i].reserved} · Available ${widget.rows[i].available}',
                    style: TextStyle(color: context.appColors.textMuted, fontSize: 13),
                  )
                else
                  TextField(
                    controller: _controllers[widget.rows[i].productVariantId],
                    keyboardType: TextInputType.number,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    style: TextStyle(color: context.appColors.textPrimary),
                    decoration: InputDecoration(
                      labelText: 'Total units',
                      labelStyle: TextStyle(color: context.appColors.textMuted),
                      filled: true,
                      fillColor: context.appColors.background,
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
                    style: TextStyle(color: context.appColors.textMuted, fontSize: 12),
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
