import 'package:flutter_test/flutter_test.dart';
import 'package:prilixor_mobile/core/utils/gst_label.dart';

void main() {
  test('keeps a single rate on one GST line', () {
    final summary = buildGstSummary(494, const [
      GstAmountLine(gstPercent: 18, gstAmount: 494),
    ]);
    expect(summary?.label, 'GST (18%)');
    expect(summary?.amount, 494);
    expect(summary?.breakup, isEmpty);
  });

  test('collapses mixed rates into one total with a slab breakup', () {
    final summary = buildGstSummary(894, const [
      GstAmountLine(gstPercent: 12, gstAmount: 400),
      GstAmountLine(gstPercent: 18, gstAmount: 494),
    ]);
    expect(summary?.label, 'GST');
    expect(summary?.amount, 894);
    expect(summary?.breakup.map((line) => line.label).toList(), ['12%', '18%']);
    expect(summary?.breakup.map((line) => line.amount).toList(), [400, 494]);
  });

  test('hides the row when there is no GST', () {
    expect(buildGstSummary(0, const []), isNull);
    expect(formatGstLabel(null), 'GST');
  });
}
