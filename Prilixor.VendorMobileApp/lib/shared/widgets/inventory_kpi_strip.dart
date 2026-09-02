import 'package:flutter/material.dart';

import '../../core/models/vendor_catalog_model.dart';
import '../../core/theme.dart';

class InventoryKpiMetric {
  final String label;
  final int value;
  final Color color;
  final String? tooltip;
  final VoidCallback? onTap;

  const InventoryKpiMetric({
    required this.label,
    required this.value,
    required this.color,
    this.tooltip,
    this.onTap,
  });
}

/// Single-line inventory KPI row — responsive on all phone widths (SS-1 parity).
class InventoryKpiStrip extends StatelessWidget {
  final List<InventoryKpiMetric> metrics;

  const InventoryKpiStrip({super.key, required this.metrics});

  factory InventoryKpiStrip.fromRecord(
    InventoryRecord record,
    BuildContext context,
  ) {
    final colors = context.appColors;
    return InventoryKpiStrip(
      metrics: [
        InventoryKpiMetric(
          label: 'Total',
          value: record.total,
          color: colors.textPrimary,
        ),
        InventoryKpiMetric(
          label: 'Available',
          value: record.available,
          color: const Color(0xFF10B981),
        ),
        InventoryKpiMetric(
          label: 'Reserved',
          value: record.reserved,
          color: const Color(0xFFF59E0B),
        ),
        if (!record.isChemical)
          InventoryKpiMetric(
            label: 'Rented',
            value: record.rented,
            color: const Color(0xFF3B82F6),
          ),
        InventoryKpiMetric(
          label: 'Blocked',
          value: record.blocked,
          color: const Color(0xFFEF4444),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    if (metrics.isEmpty) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.fromLTRB(4, 6, 4, 6),
      decoration: BoxDecoration(
        color: context.appColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: context.appColors.border),
      ),
      child: Row(
        children: [
          for (var i = 0; i < metrics.length; i++) ...[
            if (i > 0)
              Container(
                width: 1,
                height: 40,
                color: context.appColors.border,
              ),
            Expanded(
              child: _InventoryKpiCell(metric: metrics[i]),
            ),
          ],
        ],
      ),
    );
  }
}

class _InventoryKpiCell extends StatelessWidget {
  final InventoryKpiMetric metric;

  const _InventoryKpiCell({required this.metric});

  @override
  Widget build(BuildContext context) {
    final content = Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          height: 13,
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              metric.label,
              maxLines: 1,
              style: TextStyle(
                color: context.appColors.textMuted,
                fontSize: 10,
                fontWeight: FontWeight.w600,
                height: 1.1,
              ),
            ),
          ),
        ),
        const SizedBox(height: 3),
        FittedBox(
          fit: BoxFit.scaleDown,
          child: Text(
            '${metric.value}',
            style: TextStyle(
              color: metric.color,
              fontWeight: FontWeight.w800,
              fontSize: 14,
              height: 1.1,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ),
      ],
    );

    final semanticsLabel = '${metric.label} ${metric.value}';

    if (metric.onTap == null) {
      return Semantics(
        label: semanticsLabel,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 4),
          child: content,
        ),
      );
    }

    return Tooltip(
      message: metric.tooltip ?? '',
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: metric.onTap,
          borderRadius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 4),
            child: Semantics(
              button: true,
              label: '$semanticsLabel. Tap for equipment and chemical counts.',
              child: content,
            ),
          ),
        ),
      ),
    );
  }
}
