-- Add admin-managed pricing policy columns to products.
-- Run on: common_portal_db (or whichever DB hosts public.products)

ALTER TABLE IF EXISTS public.products
    ADD COLUMN IF NOT EXISTS daily_rent numeric(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS monthly_rent numeric(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS security_deposit numeric(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS buy_price numeric(12, 2) NULL,
    ADD COLUMN IF NOT EXISTS gst_percent numeric(5, 2) NOT NULL DEFAULT 18,
    ADD COLUMN IF NOT EXISTS is_rent_enabled boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS is_buy_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE IF EXISTS public.products
    DROP CONSTRAINT IF EXISTS chk_products_amounts;

ALTER TABLE IF EXISTS public.products
    ADD CONSTRAINT chk_products_amounts
    CHECK (
        daily_rent >= 0
        AND monthly_rent >= 0
        AND security_deposit >= 0
        AND (buy_price IS NULL OR buy_price >= 0)
    );

ALTER TABLE IF EXISTS public.products
    DROP CONSTRAINT IF EXISTS chk_products_gst_percent;

ALTER TABLE IF EXISTS public.products
    ADD CONSTRAINT chk_products_gst_percent
    CHECK (gst_percent >= 0 AND gst_percent <= 100);

-- Backfill from vendor listing prices when vendor_product_listings
-- is present in the same database (legacy/single-db setups).
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'vendor_product_listings'
    ) THEN
        WITH listing_agg AS (
            SELECT
                vpl.product_id,
                MIN(vpl.daily_rent) AS daily_rent,
                MIN(vpl.monthly_rent) AS monthly_rent,
                MIN(vpl.security_deposit) AS security_deposit
            FROM public.vendor_product_listings vpl
            WHERE NOT COALESCE(vpl.is_deleted, false)
            GROUP BY vpl.product_id
        )
        UPDATE public.products p
        SET
            daily_rent = COALESCE(NULLIF(p.daily_rent, 0), la.daily_rent, 0),
            monthly_rent = COALESCE(NULLIF(p.monthly_rent, 0), la.monthly_rent, 0),
            security_deposit = COALESCE(NULLIF(p.security_deposit, 0), la.security_deposit, 0),
            buy_price = COALESCE(p.buy_price, la.daily_rent * 30),
            updated_at = now()
        FROM listing_agg la
        WHERE p.id = la.product_id
          AND NOT COALESCE(p.is_deleted, false);
    END IF;
END $$;
