import { formatInr, type OrderReturnApi, customerRefundSummary } from "@/app/helpers/orderReturn";

export interface OrderCancellationApi {
  paidAmount: number;
  chargeAmount: number;
  chargeReason?: string | null;
  refundAmount: number;
  status: string;
  outcome: string;
  actorRole: string;
  actorLabel: string;
  refundedAt?: string | null;
  refundReference?: string | null;
  hasOnlinePayment: boolean;
}

export function customerCancellationChip(row: OrderCancellationApi | null | undefined): string | null {
  if (!row) return null;
  if (row.status === "pending_review") return "Refund in review";
  if (row.status === "refunding") return `Refund ₹${formatInr(row.refundAmount)} processing`;
  if (row.status === "refunded" && row.refundAmount > 0) return `Refund ₹${formatInr(row.refundAmount)}`;
  if (row.chargeAmount > 0 && row.refundAmount <= 0) return `Charge ₹${formatInr(row.chargeAmount)}`;
  return null;
}

export function adminCancellationChip(row: OrderCancellationApi | null | undefined): string | null {
  if (!row) return null;
  if (row.status === "pending_review") return "Refund review";
  if (row.status === "refunding") return "Refund sending";
  if (row.status === "refunded" && row.refundAmount > 0) return `Refunded ₹${formatInr(row.refundAmount)}`;
  if (row.refundAmount <= 0) return "No refund";
  return `Refund ₹${formatInr(row.refundAmount)}`;
}

export function combinedRefundSummary(
  returns: Array<OrderReturnApi | null | undefined>,
  cancellations: Array<OrderCancellationApi | null | undefined>,
): string | null {
  const extra: OrderReturnApi[] = [];
  for (const row of cancellations) {
    if (!row || row.refundAmount <= 0) continue;
    const status = row.status === "refunded"
      ? "refunded"
      : row.status === "pending_review" || row.status === "refunding"
        ? "pending_refund"
        : "settled";
    extra.push({
      depositAmount: row.paidAmount,
      damageAmount: row.chargeAmount,
      refundAmount: row.refundAmount,
      status,
      hasOnlinePayment: row.hasOnlinePayment,
    });
  }
  return customerRefundSummary([...returns, ...extra]);
}
