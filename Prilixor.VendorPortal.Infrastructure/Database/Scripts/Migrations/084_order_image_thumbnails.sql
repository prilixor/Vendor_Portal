-- ----------------------------------------------------
-- 084: Order photo thumbnails for option tiles
-- Stores a ~400px JPEG beside the original so order pages load tiles quickly.
-- Click/preview still uses stored_reference (full image).
-- Run on: customer_portal_db
-- pgAdmin Query Tool ignores \c — open this script on customer_portal_db.
-- Existing rows stay NULL until the next GET/upload generates a thumb.
-- ----------------------------------------------------

SELECT current_database() AS connected_database;

DO $$
BEGIN
    IF to_regclass('public.customer_order_images') IS NULL THEN
        RAISE EXCEPTION
            '084 must run on customer_portal_db. This session is connected to "%" which has no customer_order_images.',
            current_database();
    END IF;
END $$;

ALTER TABLE public.customer_order_images
    ADD COLUMN IF NOT EXISTS thumbnail_stored_reference text NULL;

COMMENT ON COLUMN public.customer_order_images.thumbnail_stored_reference IS
    'Optional ~400px JPEG for option-grid tiles. Preview/lightbox uses stored_reference.';
