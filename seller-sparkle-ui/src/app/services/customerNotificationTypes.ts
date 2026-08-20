/** Phase 1 customer portal notification_type values (matches backend CustomerNotificationTypes). */
export const CUSTOMER_NOTIFICATION_TYPES_PHASE1 = [
  "general",
  "welcome",
  "order_pending",
  "order_cancelled",
  "support_chat_reply",
] as const;

export type CustomerNotificationTypePhase1 = (typeof CUSTOMER_NOTIFICATION_TYPES_PHASE1)[number];

const BADGE_SUCCESS = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200";
const BADGE_WARNING = "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
const BADGE_PAYMENT = "bg-orange-100 text-orange-900 dark:bg-orange-950/40 dark:text-orange-200";
const BADGE_INFO = "bg-sky-100 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200";
const BADGE_SUPPORT = "bg-violet-100 text-violet-900 dark:bg-violet-950/40 dark:text-violet-200";
const BADGE_DANGER = "bg-destructive/15 text-destructive dark:bg-destructive/20";
const BADGE_MUTED = "bg-muted text-muted-foreground";

type NotificationBadgeMeta = { label: string; className: string };

const BADGE_META: Record<string, NotificationBadgeMeta> = {
  welcome: { label: "Welcome", className: BADGE_INFO },
  order_pending: { label: "Pending", className: BADGE_WARNING },
  order_cancelled: { label: "Cancelled", className: BADGE_MUTED },
  order_expiring_soon: { label: "Expiring", className: BADGE_WARNING },
  support_chat_reply: { label: "Support", className: BADGE_SUPPORT },
  order_confirmed: { label: "Confirmed", className: BADGE_SUCCESS },
  order_awaiting_payment: { label: "Payment due", className: BADGE_PAYMENT },
  order_status_updated: { label: "Updated", className: BADGE_INFO },
  order_dispatch_failed: { label: "Failed", className: BADGE_DANGER },
  order_photos_requested: { label: "Photos", className: BADGE_INFO },
  back_in_stock: { label: "Back in stock", className: BADGE_SUCCESS },
};

function normalizeNotificationType(notificationType: string | undefined | null): string {
  return notificationType?.trim().toLowerCase() ?? "";
}

/**
 * Short label for the type pill; returns null when no badge should show (e.g. general).
 */
export function customerNotificationTypeBadgeLabel(notificationType: string | undefined | null): string | null {
  const t = normalizeNotificationType(notificationType);
  if (!t || t === "general") return null;
  if (t in BADGE_META) return BADGE_META[t].label;
  const words = t.replace(/_/g, " ").replace(/^order /, "");
  return words.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Semantic colors so status pills are easy to scan on mobile. */
export function customerNotificationTypeBadgeClass(notificationType: string | undefined | null): string {
  const t = normalizeNotificationType(notificationType);
  if (t in BADGE_META) return BADGE_META[t].className;
  if (t.includes("fail") || t.includes("reject")) return BADGE_DANGER;
  if (t.includes("cancel")) return BADGE_MUTED;
  if (t.includes("payment") || t.includes("await")) return BADGE_PAYMENT;
  if (t.includes("pending") || t.includes("expir")) return BADGE_WARNING;
  if (t.includes("confirm") || t.includes("stock") || t.includes("active")) return BADGE_SUCCESS;
  if (t.includes("support") || t.includes("chat")) return BADGE_SUPPORT;
  if (t.includes("transit")) return "bg-violet-100 text-violet-900 dark:bg-violet-950/40 dark:text-violet-200";
  return BADGE_INFO;
}
