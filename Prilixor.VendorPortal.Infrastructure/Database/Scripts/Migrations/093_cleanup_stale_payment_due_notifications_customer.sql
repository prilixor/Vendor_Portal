-- One-time cleanup of stale "Payment due" alerts - CUSTOMER portal database.
-- Target database: customer_portal_db
-- Execution: psql -d customer_portal_db -f 093_cleanup_stale_payment_due_notifications_customer.sql
-- Safe to run more than once. Nothing is hard-deleted (rows are soft-deleted).
--
-- Older versions created an "awaiting payment / Payment due" alert as soon as a checkout draft
-- was made and never removed it, so customers saw "Payment due" next to orders that were later
-- cancelled or already paid. New code only creates these alerts for admin payment links and
-- removes them when the order is cancelled or paid. This script clears the old leftovers.
--
-- Kept: alerts whose order is STILL awaiting payment (the customer can still pay it).
-- Removed: alerts whose order is cancelled, paid/moved on, or no longer exists.

BEGIN;

-- Preview (how many rows will be cleaned up).
SELECT count(*) AS stale_payment_due_alerts
FROM public.customer_notifications n
LEFT JOIN public.customer_rental_orders o ON o.id = n.related_order_id
WHERE n.notification_type = 'order_awaiting_payment'
  AND n.is_deleted = false
  AND (
        o.id IS NULL
        OR o.is_deleted = true
        OR lower(replace(o.status, ' ', '_')) <> 'awaiting_payment'
      );

UPDATE public.customer_notifications n
SET is_deleted = true,
    deleted_at = now(),
    updated_at = now()
FROM public.customer_notifications n2
LEFT JOIN public.customer_rental_orders o ON o.id = n2.related_order_id
WHERE n.id = n2.id
  AND n.notification_type = 'order_awaiting_payment'
  AND n.is_deleted = false
  AND (
        o.id IS NULL
        OR o.is_deleted = true
        OR lower(replace(o.status, ' ', '_')) <> 'awaiting_payment'
      );

COMMIT;
