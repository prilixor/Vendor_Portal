-- Add map coordinates for customer addresses (distance-based delivery pricing support)
-- Run on: customer_portal_db (or whichever DB hosts customer_addresses)

ALTER TABLE IF EXISTS public.customer_addresses
    ADD COLUMN IF NOT EXISTS latitude numeric(9,6) NULL,
    ADD COLUMN IF NOT EXISTS longitude numeric(9,6) NULL;
