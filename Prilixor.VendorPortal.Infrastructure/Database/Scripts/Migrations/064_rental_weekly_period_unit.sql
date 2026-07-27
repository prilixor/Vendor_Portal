-- ----------------------------------------------------
-- 064: Weekly rent rates + rental period unit on orders
-- Daily rent columns remain; UI may hide them.
-- ----------------------------------------------------

\c common_portal_db

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS weekly_rent numeric(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS vendor_weekly_rent numeric(12, 2) NOT NULL DEFAULT 0;

\c vendor_portal_db

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS weekly_rent numeric(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS vendor_weekly_rent numeric(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.vendor_product_listings
    ADD COLUMN IF NOT EXISTS weekly_rent numeric(12, 2) NOT NULL DEFAULT 0;

\c customer_portal_db

ALTER TABLE public.customer_rental_orders
    ADD COLUMN IF NOT EXISTS rental_period_unit varchar(16) NOT NULL DEFAULT 'day';

ALTER TABLE public.customer_rental_orders
    DROP CONSTRAINT IF EXISTS chk_customer_rental_orders_period_unit;

ALTER TABLE public.customer_rental_orders
    ADD CONSTRAINT chk_customer_rental_orders_period_unit
        CHECK (rental_period_unit IN ('day', 'week', 'month'));
