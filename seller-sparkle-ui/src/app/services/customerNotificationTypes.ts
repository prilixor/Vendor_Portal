/** Phase 1 customer portal notification_type values (matches backend CustomerNotificationTypes). */
export const CUSTOMER_NOTIFICATION_TYPES_PHASE1 = [
  "general",
  "welcome",
  "order_pending",
  "order_cancelled",
] as const;

export type CustomerNotificationTypePhase1 = (typeof CUSTOMER_NOTIFICATION_TYPES_PHASE1)[number];

const PHASE1_BADGE_LABELS: Record<Exclude<CustomerNotificationTypePhase1, "general">, string> = {
  welcome: "Welcome",
  order_pending: "Order pending",
  order_cancelled: "Order cancelled",
};

/**
 * Short label for the type pill; returns null when no badge should show (e.g. general).
 */
export function customerNotificationTypeBadgeLabel(notificationType: string | undefined | null): string | null {
  const t = notificationType?.trim().toLowerCase() ?? "";
  if (!t || t === "general") return null;
  if (t in PHASE1_BADGE_LABELS) {
    return PHASE1_BADGE_LABELS[t as keyof typeof PHASE1_BADGE_LABELS];
  }
  return t.replace(/_/g, " ");
}
