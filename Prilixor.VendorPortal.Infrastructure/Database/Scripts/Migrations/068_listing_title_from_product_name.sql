-- ----------------------------------------------------
-- Align vendor listing titles with Admin product/chemical names
-- so customers see a consistent catalog name across vendors.
--
-- Run on: vendor_portal_db only
-- (vendor_product_listings lives here; common_portal_db has products
-- but not vendor listings.)
-- ----------------------------------------------------

\c vendor_portal_db

UPDATE public.vendor_product_listings AS vpl
SET listing_title = LEFT(TRIM(p.product_name), 255),
    updated_at = now()
FROM public.products AS p
WHERE vpl.product_id = p.id
  AND COALESCE(p.is_deleted, false) = false
  AND TRIM(COALESCE(p.product_name, '')) <> ''
  AND vpl.listing_title IS DISTINCT FROM LEFT(TRIM(p.product_name), 255);
