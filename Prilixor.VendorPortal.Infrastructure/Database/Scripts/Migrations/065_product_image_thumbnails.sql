-- ----------------------------------------------------
-- 065: Product / listing image thumbnails
-- Adds nullable thumbnail_url alongside image_url.
-- New uploads generate a ~400px JPEG thumb in S3/local.
-- Existing rows stay NULL (UI falls back to image_url).
-- ----------------------------------------------------

-- ====================================================
-- 1) common_portal_db — catalog product images
-- ====================================================
\c common_portal_db

ALTER TABLE public.product_images
    ADD COLUMN IF NOT EXISTS thumbnail_url text NULL;

-- ====================================================
-- 2) vendor_portal_db — catalog + listing images
-- ====================================================
\c vendor_portal_db

ALTER TABLE public.product_images
    ADD COLUMN IF NOT EXISTS thumbnail_url text NULL;

ALTER TABLE public.vendor_product_images
    ADD COLUMN IF NOT EXISTS thumbnail_url text NULL;
