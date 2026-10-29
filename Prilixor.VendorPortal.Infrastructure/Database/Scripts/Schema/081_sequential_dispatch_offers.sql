-- Sequential nearest-vendor dispatch: queued offers + at most one pending offer per order.
-- Run on: customer_portal_db

\c customer_portal_db

-- Keep the nearest in-flight offer; queue the rest so unique-pending can be applied.
WITH ranked_pending AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY customer_rental_order_id
            ORDER BY offer_rank ASC, created_at ASC
        ) AS rn
    FROM public.customer_order_vendor_offers
    WHERE is_deleted = false
      AND status = 'pending'
)
UPDATE public.customer_order_vendor_offers o
SET status = 'queued',
    updated_at = now()
FROM ranked_pending r
WHERE o.id = r.id
  AND r.rn > 1;

ALTER TABLE public.customer_order_vendor_offers
    DROP CONSTRAINT IF EXISTS chk_customer_order_vendor_offers_status;

ALTER TABLE public.customer_order_vendor_offers
    ADD CONSTRAINT chk_customer_order_vendor_offers_status
        CHECK (status IN ('pending', 'queued', 'accepted', 'rejected', 'expired'));

CREATE UNIQUE INDEX IF NOT EXISTS ux_customer_order_vendor_offers_one_pending
    ON public.customer_order_vendor_offers(customer_rental_order_id)
    WHERE is_deleted = false AND status = 'pending';

CREATE INDEX IF NOT EXISTS ix_customer_order_vendor_offers_order_queued
    ON public.customer_order_vendor_offers(customer_rental_order_id, offer_rank)
    WHERE is_deleted = false AND status = 'queued';
