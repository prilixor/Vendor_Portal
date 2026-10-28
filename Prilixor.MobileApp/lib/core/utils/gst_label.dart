String _formatPercent(num percent) {
  final rounded = (percent.toDouble() * 100).round() / 100;
  final whole = rounded.truncateToDouble();
  if ((rounded - whole).abs() < 0.001) return whole.toInt().toString();
  return rounded
      .toStringAsFixed(2)
      .replaceFirst(RegExp(r'0+$'), '')
      .replaceFirst(RegExp(r'\.$'), '');
}

/// Label for a GST amount row. Omits the rate when the API did not send one.
String formatGstLabel(num? percent) {
  if (percent == null) return 'GST';
  return 'GST (${_formatPercent(percent)}%)';
}

/// Slab label used under a combined GST total, e.g. "12%".
String formatGstSlabLabel(num? percent) {
  if (percent == null) return 'GST';
  return '${_formatPercent(percent)}%';
}

class GstAmountLine {
  final num? gstPercent;
  final num gstAmount;

  const GstAmountLine({this.gstPercent, required this.gstAmount});
}

class GstSummaryBreakup {
  final String key;
  final String label;
  final double amount;

  const GstSummaryBreakup({
    required this.key,
    required this.label,
    required this.amount,
  });
}

class GstSummaryView {
  final String label;
  final double amount;
  final List<GstSummaryBreakup> breakup;

  const GstSummaryView({
    required this.label,
    required this.amount,
    this.breakup = const [],
  });
}

/// Checkout tax row. One rate stays a single line ("GST (18%)").
/// Mixed rates collapse to one GST total with a slab breakup underneath.
GstSummaryView? buildGstSummary(num gstAmount, List<GstAmountLine> lines) {
  final rows = lines.where((line) => line.gstAmount > 0).toList();
  final summed = rows.fold<double>(0, (sum, line) => sum + line.gstAmount.toDouble());
  final amount = gstAmount > 0 ? gstAmount.toDouble() : summed;
  if (amount <= 0) return null;
  if (rows.length > 1) {
    return GstSummaryView(
      label: 'GST',
      amount: amount,
      breakup: [
        for (var i = 0; i < rows.length; i++)
          GstSummaryBreakup(
            key: '${rows[i].gstPercent ?? 'gst'}-$i',
            label: formatGstSlabLabel(rows[i].gstPercent),
            amount: rows[i].gstAmount.toDouble(),
          ),
      ],
    );
  }
  return GstSummaryView(
    label: formatGstLabel(rows.isEmpty ? null : rows.first.gstPercent),
    amount: amount,
  );
}
