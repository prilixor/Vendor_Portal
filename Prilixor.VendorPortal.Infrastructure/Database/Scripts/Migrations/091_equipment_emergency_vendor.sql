-- Equipment Emergency feature - complete script for the VENDOR portal database.
-- Target database: vendor_portal_db (VendorPortalConnection / ApplicationDbContext)
-- Execution: psql -d vendor_portal_db -f 091_equipment_emergency_vendor.sql
-- Safe to run more than once. Run the matching _customer and _common scripts on their databases too.
--
-- Includes:
--   1. Category flag            product_categories.emergency_support_enabled
--   2. Product override         products.emergency_support  (NULL = follow category, true = always, false = never)
--   3. Admin switch table       platform_emergency_settings ("Also alert the vendor", default off)
--   4. Vendor notification link vendor_notifications.related_order_id (bell opens the exact order)
--   5. Vendor notification fix  sent_at back-filled so the bell list sorts newest first

BEGIN;

-- 1. Category flag
ALTER TABLE public.product_categories
    ADD COLUMN IF NOT EXISTS emergency_support_enabled boolean NOT NULL DEFAULT false;

-- 2. Per-product override
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS emergency_support boolean NULL;

-- 3. Admin "Also alert the vendor" switch (single row)
CREATE TABLE IF NOT EXISTS public.platform_emergency_settings (
    id uuid PRIMARY KEY,
    alert_vendor_enabled boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NULL,
    is_deleted boolean NOT NULL DEFAULT false
);

INSERT INTO public.platform_emergency_settings (id, alert_vendor_enabled)
SELECT gen_random_uuid(), false
WHERE NOT EXISTS (
    SELECT 1 FROM public.platform_emergency_settings WHERE COALESCE(is_deleted, false) = false
);

-- The API connects as "blinksmed" in production, but this script is run as postgres.
-- Without this grant the API fails with "permission denied for table platform_emergency_settings".
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'blinksmed') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_emergency_settings TO blinksmed;
    END IF;
END
$$;

-- 4. Vendor notification -> order link
ALTER TABLE public.vendor_notifications
    ADD COLUMN IF NOT EXISTS related_order_id uuid NULL;

-- 5. Vendor notifications are listed newest first by sent_at. Rows with sent_at = NULL sort first
--    in Postgres (ORDER BY ... DESC puts NULLs first), so old rows appeared above new ones.
UPDATE public.vendor_notifications
SET sent_at = created_at
WHERE sent_at IS NULL;

COMMIT;
