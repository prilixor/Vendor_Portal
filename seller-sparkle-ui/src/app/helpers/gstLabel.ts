function formatPercent(percent: number): string {
  const rounded = Math.round(percent * 100) / 100;
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function hasPercent(percent: number | null | undefined): percent is number {
  return percent != null && !Number.isNaN(Number(percent));
}

/** Label for a GST amount row. Omits the rate when the API did not send one. */
export function formatGstRateLabel(percent: number | null | undefined): string {
  if (!hasPercent(percent)) return "GST";
  return `GST (${formatPercent(percent)}%)`;
}

/** Slab label used under a combined GST total, e.g. "12%". */
export function formatGstSlabLabel(percent: number | null | undefined): string {
  if (!hasPercent(percent)) return "GST";
  return `${formatPercent(percent)}%`;
}

export type GstSummaryLine = {
  gstPercent?: number | null;
  gstAmount: number;
};

export type GstSummaryView = {
  label: string;
  amount: number;
  breakup: Array<{ key: string; label: string; amount: number }>;
};

/**
 * Checkout tax row. One rate stays a single line ("GST (18%)").
 * Mixed rates collapse to one GST total with a slab breakup underneath.
 */
export function buildGstSummary(gstAmount: number, lines: GstSummaryLine[]): GstSummaryView | null {
  const rows = lines.filter((line) => line.gstAmount > 0);
  const amount = gstAmount > 0 ? gstAmount : rows.reduce((sum, line) => sum + line.gstAmount, 0);
  if (amount <= 0) return null;
  if (rows.length > 1) {
    return {
      label: "GST",
      amount,
      breakup: rows.map((line, index) => ({
        key: `${line.gstPercent ?? "gst"}-${index}`,
        label: formatGstSlabLabel(line.gstPercent),
        amount: line.gstAmount,
      })),
    };
  }
  return {
    label: formatGstRateLabel(rows[0]?.gstPercent),
    amount,
    breakup: [],
  };
}
