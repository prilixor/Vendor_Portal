import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/models/vendor_catalog_model.dart';
import '../../core/theme.dart';

/// Compact "N sizes" control on an inventory card. Tap opens a sheet so the
/// list stays scannable and each size is easy to read.
class ChemicalSizeStockDisclosure extends StatelessWidget {
  final List<ChemicalSizeStock> sizes;
  final String? productName;

  const ChemicalSizeStockDisclosure({
    super.key,
    required this.sizes,
    this.productName,
  });

  @override
  Widget build(BuildContext context) {
    final visible = sizes.where((size) => size.label.trim().isNotEmpty).toList();
    if (visible.isEmpty) return const SizedBox.shrink();

    final count = visible.length;
    final label = '$count ${count == 1 ? 'size' : 'sizes'}';
    final colors = context.appColors;

    return Padding(
      padding: const EdgeInsets.only(top: 2),
      child: InkWell(
        onTap: () => showChemicalSizeStockSheet(
          context,
          sizes: visible,
          productName: productName,
        ),
        borderRadius: BorderRadius.circular(6),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 2),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: colors.accent,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  height: 1.1,
                ),
              ),
              Icon(Icons.chevron_right_rounded, size: 14, color: colors.accent),
            ],
          ),
        ),
      ),
    );
  }
}

void showChemicalSizeStockSheet(
  BuildContext context, {
  required List<ChemicalSizeStock> sizes,
  String? productName,
}) {
  final colors = context.appColors;
  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    backgroundColor: colors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
    builder: (ctx) {
      final screenHeight = MediaQuery.sizeOf(ctx).height;
      // About three size cards. More sizes scroll inside this height
      // so the sheet does not cover the stock tiles.
      final maxListHeight = math.min(220.0, screenHeight * 0.34);
      final countLabel = sizes.length == 1
          ? 'Stock for this packaging size.'
          : 'Stock for ${sizes.length} packaging sizes.';
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                productName?.trim().isNotEmpty == true ? productName!.trim() : 'Packaging sizes',
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: colors.textPrimary,
                  fontWeight: FontWeight.w800,
                  fontSize: 18,
                  height: 1.25,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                countLabel,
                style: TextStyle(
                  color: colors.textMuted,
                  fontSize: 13,
                  height: 1.35,
                ),
              ),
              const SizedBox(height: 16),
              ConstrainedBox(
                constraints: BoxConstraints(maxHeight: maxListHeight),
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: sizes.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (_, index) => ChemicalSizeStockCard(size: sizes[index]),
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
}

/// Full-width size rows for the inventory detail screen.
class ChemicalSizeStockTable extends StatelessWidget {
  final List<ChemicalSizeStock> sizes;

  const ChemicalSizeStockTable({super.key, required this.sizes});

  @override
  Widget build(BuildContext context) {
    final visible = sizes.where((size) => size.label.trim().isNotEmpty).toList();
    if (visible.isEmpty) return const SizedBox.shrink();
    return Column(
      children: [
        for (var i = 0; i < visible.length; i++) ...[
          if (i > 0) const SizedBox(height: 10),
          ChemicalSizeStockCard(size: visible[i]),
        ],
      ],
    );
  }
}

class ChemicalSizeStockCard extends StatelessWidget {
  final ChemicalSizeStock size;

  const ChemicalSizeStockCard({super.key, required this.size});

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: colors.surfaceElevated,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: colors.border),
      ),
      child: Row(
        children: [
          Expanded(
            flex: 4,
            child: Text(
              size.label,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: colors.textPrimary,
                fontSize: 14,
                fontWeight: FontWeight.w800,
                height: 1.2,
              ),
            ),
          ),
          _SizeMetric(label: 'Total', value: size.total, color: colors.textPrimary),
          _SizeMetric(label: 'Available', value: size.available, color: colors.success),
          _SizeMetric(label: 'Reserved', value: size.reserved, color: colors.warning),
        ],
      ),
    );
  }
}

class _SizeMetric extends StatelessWidget {
  final String label;
  final int value;
  final Color color;

  const _SizeMetric({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 72,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: context.appColors.textMuted,
              fontSize: 10,
              fontWeight: FontWeight.w600,
              height: 1.1,
            ),
          ),
          Text(
            '$value',
            style: TextStyle(
              color: color,
              fontSize: 14,
              fontWeight: FontWeight.w800,
              height: 1.15,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}
