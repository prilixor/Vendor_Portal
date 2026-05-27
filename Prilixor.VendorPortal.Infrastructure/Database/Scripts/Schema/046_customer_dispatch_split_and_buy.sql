-- Add order_type + dispatch statuses + vendor offers for split-dispatch flow
-- Run on: customer_portal_db (or whichever DB hosts customer_rental_orders)

ALTER TABLE IF EXISTS public.customer_rental_orders
    ADD COLUMN IF NOT EXISTS order_type varchar(20) NOT NULL DEFAULT 'rent';

ALTER TABLE IF EXISTS public.customer_rental_orders
    DROP CONSTRAINT IF EXISTS chk_customer_rental_orders_status;

ALTER TABLE IF EXISTS public.customer_rental_orders
    ADD CONSTRAINT chk_customer_rental_orders_status
    CHECK (status IN ('pending', 'awaiting_vendor_acceptance', 'confirmed', 'in_transit', 'active', 'returned', 'cancelled', 'dispatch_failed'));

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'customer_rental_orders'
          AND column_name = 'rental_days'
    ) THEN
        ALTER TABLE public.customer_rental_orders
            DROP CONSTRAINT IF EXISTS customer_rental_orders_rental_days_check;

        ALTER TABLE public.customer_rental_orders
            ADD CONSTRAINT customer_rental_orders_rental_days_check CHECK (rental_days >= 0);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_customer_rental_orders_listing_period_status
    ON public.customer_rental_orders(vendor_product_listing_id, start_date, end_date, status);

CREATE TABLE IF NOT EXISTS public.customer_order_vendor_offers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_rental_order_id uuid NOT NULL REFERENCES public.customer_rental_orders(id),
    vendor_id uuid NOT NULL,
    vendor_product_listing_id uuid NOT NULL,
    offer_rank int NOT NULL CHECK (offer_rank > 0),
    status varchar(30) NOT NULL DEFAULT 'pending',
    expires_at timestamptz NOT NULL,
    responded_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL,
    created_by uuid NULL,
    updated_by uuid NULL,
    CONSTRAINT chk_customer_order_vendor_offers_status
        CHECK (status IN ('pending', 'accepted', 'rejected', 'expired'))
);

CREATE INDEX IF NOT EXISTS ix_customer_order_vendor_offers_vendor_pending
    ON public.customer_order_vendor_offers(vendor_id, status, expires_at);
CREATE INDEX IF NOT EXISTS ix_customer_order_vendor_offers_order_id
    ON public.customer_order_vendor_offers(customer_rental_order_id);
