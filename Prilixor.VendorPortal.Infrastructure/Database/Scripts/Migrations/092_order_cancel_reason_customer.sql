-- Order cancel reason - complete script for the CUSTOMER portal database.
-- Target database: customer_portal_db
-- Execution: psql -d customer_portal_db -f 092_order_cancel_reason_customer.sql
-- Safe to run more than once.
--
-- Every cancelled order now records who cancelled it and why, so admin, customer and the
-- apps can show a clear label (for example "Cancelled automatically: payment was not completed").
--   cancelled_by  : customer | admin | system
--   cancel_reason : customer_request | admin_cancelled | payment_not_completed | checkout_failed

BEGIN;

ALTER TABLE public.customer_rental_orders
    ADD COLUMN IF NOT EXISTS cancelled_by varchar(20) NULL,
    ADD COLUMN IF NOT EXISTS cancel_reason varchar(40) NULL,
    ADD COLUMN IF NOT EXISTS cancelled_at timestamptz NULL;

-- Fill in what we can for orders cancelled before this script existed.
-- 1) Paid orders keep their refund review row, which already says who cancelled.
UPDATE public.customer_rental_orders o
SET cancelled_by = r.actor_role,
    cancel_reason = CASE r.actor_role
                        WHEN 'customer' THEN 'customer_request'
                        ELSE 'admin_cancelled'
                    END,
    cancelled_at = COALESCE(o.updated_at, o.created_at)
FROM public.customer_order_cancellation_refunds r
WHERE r.customer_rental_order_id = o.id
  AND COALESCE(r.is_deleted, false) = false
  AND r.outcome = 'cancelled'
  AND r.actor_role IN ('customer', 'admin')
  AND lower(o.status) IN ('cancelled', 'canceled')
  AND o.cancelled_by IS NULL;

-- 2) Unpaid orders whose payment session expired or failed were cancelled by the system.
UPDATE public.customer_rental_orders o
SET cancelled_by = 'system',
    cancel_reason = CASE s.status WHEN 'failed' THEN 'checkout_failed' ELSE 'payment_not_completed' END,
    cancelled_at = COALESCE(o.updated_at, o.created_at)
FROM public.customer_checkout_sessions s
WHERE s.id = o.checkout_session_id
  AND s.status IN ('expired', 'failed')
  AND lower(o.status) IN ('cancelled', 'canceled')
  AND o.cancelled_by IS NULL;

COMMIT;
