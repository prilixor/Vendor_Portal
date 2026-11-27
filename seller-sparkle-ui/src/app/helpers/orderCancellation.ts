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

/** Who cancelled an order and why. Sent for every cancelled order that has a recorded reason. */
export interface OrderCancelInfoApi {
  cancelledBy: string; // customer | admin | system
  reason: string; // customer_request | admin_cancelled | payment_not_completed | checkout_failed
  label: string;
  cancelledAt?: string | null;
  /** Nothing was paid and the system gave up. Not a real order problem. */
  isUnpaidAbandonment: boolean;
}

/** Short badge for lists, next to the "Cancelled" status. */
export function cancelInfoChip(info: OrderCancelInfoApi | null | undefined): string | null {
  if (!info) return null;
  switch (info.reason) {
    case "customer_request":
      return "By customer";
    case "admin_cancelled":
      return "By admin";
    case "payment_not_completed":
      return "Payment not completed";
    case "checkout_failed":
      return "Payment failed to start";
    default:
      return null;
  }
}

/** Amber for the automatic unpaid cancellation, neutral for a person's decision. */
export function cancelInfoChipClass(info: OrderCancelInfoApi | null | undefined): string {
  return info?.isUnpaidAbandonment
    ? "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
    : "bg-slate-100 text-slate-800 dark:bg-slate-800/60 dark:text-slate-200";
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
