/** Label for a GST amount row. Omits the rate when the API did not send one. */
export function formatGstRateLabel(percent: number | null | undefined): string {
  if (percent == null || Number.isNaN(Number(percent))) return "GST";
  const rounded = Math.round(Number(percent) * 100) / 100;
  const text = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `GST (${text}%)`;
}
