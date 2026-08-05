-- Migration 070: Track whether Admin has set a vendor service-area radius.
-- New areas default to false (default 5 km until Admin reviews).
-- Existing areas are grandfathered as already reviewed.
-- Run on: vendor_portal_db

\c vendor_portal_db

ALTER TABLE public.vendor_service_areas
    ADD COLUMN IF NOT EXISTS is_radius_set_by_admin boolean NOT NULL DEFAULT false;

-- Existing areas that already use a non-default radius are treated as reviewed.
-- Areas still on the default 5 km remain false so Admin can confirm/set coverage.
UPDATE public.vendor_service_areas
SET is_radius_set_by_admin = true
WHERE COALESCE(is_deleted, false) = false
  AND service_radius_km <> 5;
