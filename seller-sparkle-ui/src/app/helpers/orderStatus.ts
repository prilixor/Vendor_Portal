/** Full status text for tooltips and accessibility. */
export function formatOrderStatusTitle(status: string): string {
  return status.replace(/_/g, " ");
}

/** Compact list/detail badge label so long statuses stay on one line. */
export function formatOrderStatusLabel(status: string): string {
  const normalized = status.trim().toLowerCase().replace(/_/g, " ");
  if (normalized === "awaiting vendor acceptance" || normalized === "pending vendor acceptance") {
    return "Awaiting";
  }
  if (normalized === "dispatch failed") {
    return "Failed";
  }
  return formatOrderStatusTitle(status);
}

/** Shared small pill sizing used on customer, vendor, and admin order badges. */
export const orderStatusBadgeSizeClass =
  "h-5 whitespace-nowrap px-2 py-0 text-[10px] font-semibold capitalize leading-none";
