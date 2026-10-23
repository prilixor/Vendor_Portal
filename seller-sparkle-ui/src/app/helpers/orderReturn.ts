export interface OrderReturnApi {
  depositAmount: number;
  damageAmount: number;
  damageReason?: string | null;
  refundAmount: number;
  status: string;
  refundedAt?: string | null;
  refundReference?: string | null;
  hasOnlinePayment: boolean;
  damageImageUrls?: string[] | null;
}

export function formatInr(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const hasPaise = Math.abs(rounded % 1) > 0.001;
  return rounded.toLocaleString("en-IN", {
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: hasPaise ? 2 : 0,
  });
}

export function vendorClaimLabel(row: OrderReturnApi | null | undefined): string | null {
  if (!row) return null;
  if (row.damageAmount > 0) {
    const claim = `Damage claim ₹${formatInr(row.damageAmount)}`;
    return row.status === "pending_refund" || row.status === "refunding"
      ? `${claim} · with admin`
      : claim;
  }
  return "No damage";
}

export function customerRefundChip(row: OrderReturnApi | null | undefined): string | null {
  if (!row) return null;
  if (row.refundAmount > 0) {
    const amount = `Refund ₹${formatInr(row.refundAmount)}`;
    return row.status === "refunded" ? amount : `${amount} processing`;
  }
  if (row.damageAmount > 0) return `Damage ₹${formatInr(row.damageAmount)}`;
  return null;
}

export function adminRefundChip(row: OrderReturnApi | null | undefined): string | null {
  if (!row) return null;
  if (row.refundAmount > 0 && row.status === "refunded") return `Refunded ₹${formatInr(row.refundAmount)}`;
  if (row.refundAmount > 0) return `Refund due ₹${formatInr(row.refundAmount)}`;
  if (row.damageAmount > 0) return `Damage ₹${formatInr(row.damageAmount)}`;
  return null;
}

export function customerRefundSummary(rows: Array<OrderReturnApi | null | undefined>): string | null {
  let received = 0;
  let processing = 0;
  for (const row of rows) {
    if (!row || row.refundAmount <= 0) continue;
    if (row.status === "refunded") received += row.refundAmount;
    else if (row.status === "pending_refund" || row.status === "refunding") processing += row.refundAmount;
  }
  if (received <= 0 && processing <= 0) return null;
  if (received > 0 && processing > 0) {
    return `Refunds ₹${formatInr(received)} received · ₹${formatInr(processing)} processing`;
  }
  if (received > 0) return `Refunds ₹${formatInr(received)} received`;
  return `Refunds ₹${formatInr(processing)} processing`;
}
