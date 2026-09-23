-- ----------------------------------------------------
-- 085: Per-product minimum rental days
-- Null means every duration plan is offered (buy-price cap still applies).
-- A positive value marks shorter duration plans unavailable.
--
-- Run on: common_portal_db (mandatory)
-- Run on: vendor_portal_db (schema parity)
-- ----------------------------------------------------

-- ====================================================
-- 1) common_portal_db
-- ====================================================
\c common_portal_db

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS minimum_rental_days int NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_products_minimum_rental_days'
    ) THEN
        ALTER TABLE public.products
            ADD CONSTRAINT chk_products_minimum_rental_days
            CHECK (minimum_rental_days IS NULL OR minimum_rental_days > 0);
    END IF;
END $$;

-- ====================================================
-- 2) vendor_portal_db
-- ====================================================
\c vendor_portal_db

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS minimum_rental_days int NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_products_minimum_rental_days'
    ) THEN
        ALTER TABLE public.products
            ADD CONSTRAINT chk_products_minimum_rental_days
            CHECK (minimum_rental_days IS NULL OR minimum_rental_days > 0);
    END IF;
END $$;
