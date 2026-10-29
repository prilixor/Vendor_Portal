-- Migration 074
-- Live images come from S3 (bucket rentalmedicalequipments).
-- This script does NOT insert local files like best-value.png — that would break live.
-- It only:
--   1) Keeps existing Best Value + Maximum Savings rows (including their S3 image keys)
--   2) Turns those two ON
--   3) Turns Good + Better OFF and clears them from product plans
--   4) Drops the closed-list CHECK so Admin can add Premium / Good later (upload goes to S3)
-- Run on: common_portal_db, vendor_portal_db

\c common_portal_db

ALTER TABLE public.rental_duration_icons
    DROP CONSTRAINT IF EXISTS chk_rental_duration_icons_tier;

ALTER TABLE public.rental_duration_icons
    ALTER COLUMN value_tier SET DEFAULT 'icon';

-- Keep current S3/local image_url as-is. Only reactivate the two required icons.
UPDATE public.rental_duration_icons
SET is_active = true,
    is_deleted = false,
    deleted_at = NULL,
    updated_at = now()
WHERE value_tier IN ('best_value', 'maximum_savings');

UPDATE public.rental_duration_icons
SET is_active = false,
    updated_at = now()
WHERE is_deleted = false
  AND value_tier IN ('good', 'better');

UPDATE public.product_rental_pricing_plans
SET rental_duration_icon_id = NULL,
    icon_url = NULL,
    icon_thumbnail_url = NULL,
    value_tier = NULL,
    icon_name = NULL,
    updated_at = now()
WHERE value_tier IN ('good', 'better')
   OR rental_duration_icon_id IN (
        SELECT id
        FROM public.rental_duration_icons
        WHERE value_tier IN ('good', 'better')
    );


\c vendor_portal_db

ALTER TABLE public.rental_duration_icons
    DROP CONSTRAINT IF EXISTS chk_rental_duration_icons_tier;

ALTER TABLE public.rental_duration_icons
    ALTER COLUMN value_tier SET DEFAULT 'icon';

UPDATE public.rental_duration_icons
SET is_active = true,
    is_deleted = false,
    deleted_at = NULL,
    updated_at = now()
WHERE value_tier IN ('best_value', 'maximum_savings');

UPDATE public.rental_duration_icons
SET is_active = false,
    updated_at = now()
WHERE is_deleted = false
  AND value_tier IN ('good', 'better');

UPDATE public.product_rental_pricing_plans
SET rental_duration_icon_id = NULL,
    icon_url = NULL,
    icon_thumbnail_url = NULL,
    value_tier = NULL,
    icon_name = NULL,
    updated_at = now()
WHERE value_tier IN ('good', 'better')
   OR rental_duration_icon_id IN (
        SELECT id
        FROM public.rental_duration_icons
        WHERE value_tier IN ('good', 'better')
    );
