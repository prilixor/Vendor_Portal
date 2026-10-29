function normalizeOrderStatus(status: string): string {
  return status.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
}

/** Full status text for tooltips and accessibility. */
export function formatOrderStatusTitle(status: string): string {
  return status.replace(/_/g, " ");
}

/**
 * Customer surfaces must never reveal the fulfilling vendor — BlinksMed is the
 * only party a customer deals with. Use this for any status shown to customers.
 */
export function formatCustomerOrderStatusTitle(status: string): string {
  const normalized = normalizeOrderStatus(status);
  if (normalized === "dispatch failed") return "Dispatch failed";
  return formatOrderStatusTitle(status).replace(/\bvendors?\b/gi, "BlinksMed");
}

/** Compact customer badge. Dispatch failed stays distinct from a real cancellation. */
export function formatCustomerOrderStatusLabel(status: string): string {
  return formatOrderStatusLabel(status);
}

/** Compact list/detail badge label so long statuses stay on one line. */
export function formatOrderStatusLabel(status: string): string {
  const normalized = normalizeOrderStatus(status);
  if (
    normalized === "awaiting vendor acceptance" ||
    normalized === "pending vendor acceptance" ||
    normalized === "awaiting"
  ) {
    return "Awaiting";
  }
  if (normalized === "dispatch failed") {
    return "Dispatch failed";
  }
  return formatOrderStatusTitle(status);
}

/** Payout is the vendor's earning only after they have accepted the product. */
export function orderShowsVendorPayout(status: string): boolean {
  const normalized = normalizeOrderStatus(status);
  return (
    normalized === "confirmed" ||
    normalized === "in transit" ||
    normalized === "active" ||
    normalized === "returned" ||
    normalized === "bought out" ||
    normalized === "completed"
  );
}

/** Order type pill: Rent / Buy (never RENT / BUY). */
export function formatOrderTypeLabel(orderType: string): string {
  return orderType.toLowerCase().trim() === "buy" ? "Buy" : "Rent";
}

/** Shared small pill sizing used on customer, vendor, and admin order badges. */
export const orderStatusBadgeSizeClass =
  "h-5 whitespace-nowrap px-2 py-0 text-[10px] font-semibold capitalize leading-none";
