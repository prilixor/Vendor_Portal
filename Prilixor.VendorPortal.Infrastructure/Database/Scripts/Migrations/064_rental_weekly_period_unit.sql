-- ----------------------------------------------------
-- 064: Weekly rent rates + rental period unit on orders
-- Daily rent columns remain (UI/Excel may hide them).
--
-- Safe for Prod: ADD COLUMN IF NOT EXISTS + backfill only
-- where weekly is still 0 and daily > 0.
--
-- Backfill rule (change multiplier if business wants):
--   weekly_rent        = daily_rent * 3
--   vendor_weekly_rent = vendor_daily_rent * 3
-- ----------------------------------------------------

-- ====================================================
-- 1) common_portal_db — catalog products
-- ====================================================
\c common_portal_db

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS weekly_rent numeric(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS vendor_weekly_rent numeric(12, 2) NOT NULL DEFAULT 0;

-- Backfill weekly from daily (existing products)
UPDATE public.products
SET weekly_rent = ROUND(daily_rent * 3, 2)
WHERE COALESCE(weekly_rent, 0) = 0
  AND COALESCE(daily_rent, 0) > 0;

UPDATE public.products
SET vendor_weekly_rent = ROUND(vendor_daily_rent * 3, 2)
WHERE COALESCE(vendor_weekly_rent, 0) = 0
  AND COALESCE(vendor_daily_rent, 0) > 0;

-- ====================================================
-- 2) vendor_portal_db — products + listings
-- ====================================================
\c vendor_portal_db

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS weekly_rent numeric(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS vendor_weekly_rent numeric(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.vendor_product_listings
    ADD COLUMN IF NOT EXISTS weekly_rent numeric(12, 2) NOT NULL DEFAULT 0;

UPDATE public.products
SET weekly_rent = ROUND(daily_rent * 3, 2)
WHERE COALESCE(weekly_rent, 0) = 0
  AND COALESCE(daily_rent, 0) > 0;

UPDATE public.products
SET vendor_weekly_rent = ROUND(vendor_daily_rent * 3, 2)
WHERE COALESCE(vendor_weekly_rent, 0) = 0
  AND COALESCE(vendor_daily_rent, 0) > 0;

UPDATE public.vendor_product_listings
SET weekly_rent = ROUND(daily_rent * 3, 2)
WHERE COALESCE(weekly_rent, 0) = 0
  AND COALESCE(daily_rent, 0) > 0;

-- ====================================================
-- 3) customer_portal_db — order period unit
-- ====================================================
\c customer_portal_db

ALTER TABLE public.customer_rental_orders
    ADD COLUMN IF NOT EXISTS rental_period_unit varchar(16) NOT NULL DEFAULT 'day';

ALTER TABLE public.customer_rental_orders
    DROP CONSTRAINT IF EXISTS chk_customer_rental_orders_period_unit;

ALTER TABLE public.customer_rental_orders
    ADD CONSTRAINT chk_customer_rental_orders_period_unit
        CHECK (rental_period_unit IN ('day', 'week', 'month'));

-- Existing orders stay unit = 'day' (column default). No amount backfill needed.
