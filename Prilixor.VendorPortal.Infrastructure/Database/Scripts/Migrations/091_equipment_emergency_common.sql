-- Equipment Emergency feature - complete script for the COMMON (shared catalog) database.
-- Target database: common_portal_db
-- Execution: psql -d common_portal_db -f 091_equipment_emergency_common.sql
-- Safe to run more than once. Run the matching _vendor and _customer scripts on their databases too.
--
-- Includes:
--   1. Category flag     product_categories.emergency_support_enabled
--   2. Product override  products.emergency_support  (NULL = follow category, true = always, false = never)

BEGIN;

ALTER TABLE public.product_categories
    ADD COLUMN IF NOT EXISTS emergency_support_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS emergency_support boolean NULL;

COMMIT;
