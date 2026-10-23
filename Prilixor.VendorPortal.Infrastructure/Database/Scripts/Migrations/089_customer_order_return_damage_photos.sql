-- ----------------------------------------------------
-- Migration: 089_customer_order_return_damage_photos.sql
-- Target Database: customer_portal_db
-- Description: Optional damage photos (up to 3) on a product return claim.
-- Execution: psql -d customer_portal_db -f 089_customer_order_return_damage_photos.sql
-- ----------------------------------------------------

\c customer_portal_db

ALTER TABLE public.customer_order_returns
    ADD COLUMN IF NOT EXISTS damage_image_paths text NULL;

COMMENT ON COLUMN public.customer_order_returns.damage_image_paths IS
    'JSON array of up to 3 stored damage-photo references. Optional evidence for a vendor damage charge.';
