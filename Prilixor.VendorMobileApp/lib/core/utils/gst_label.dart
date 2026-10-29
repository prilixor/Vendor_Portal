/// Label for a GST amount row. Omits the rate when the API did not send one.
String formatGstLabel(num? percent) {
  if (percent == null) return 'GST';
  final rounded = (percent.toDouble() * 100).round() / 100;
  final whole = rounded.truncateToDouble();
  final text = (rounded - whole).abs() < 0.001
      ? whole.toInt().toString()
      : rounded
          .toStringAsFixed(2)
          .replaceFirst(RegExp(r'0+$'), '')
          .replaceFirst(RegExp(r'\.$'), '');
  return 'GST ($text%)';
}
