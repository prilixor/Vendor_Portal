import { describe, expect, it } from "vitest";
import { buildGstSummary, formatGstRateLabel } from "./gstLabel";

describe("buildGstSummary", () => {
  it("keeps a single rate on one GST line", () => {
    expect(buildGstSummary(494, [{ gstPercent: 18, gstAmount: 494 }])).toEqual({
      label: "GST (18%)",
      amount: 494,
      breakup: [],
    });
  });

  it("collapses mixed rates into one total with a slab breakup", () => {
    expect(
      buildGstSummary(894, [
        { gstPercent: 12, gstAmount: 400 },
        { gstPercent: 18, gstAmount: 494 },
      ]),
    ).toEqual({
      label: "GST",
      amount: 894,
      breakup: [
        { key: "12-0", label: "12%", amount: 400 },
        { key: "18-1", label: "18%", amount: 494 },
      ],
    });
  });

  it("hides the row when there is no GST", () => {
    expect(buildGstSummary(0, [])).toBeNull();
    expect(formatGstRateLabel(undefined)).toBe("GST");
  });
});
