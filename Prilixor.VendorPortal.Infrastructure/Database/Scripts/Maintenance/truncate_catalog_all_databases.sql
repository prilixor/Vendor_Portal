-- =============================================================================
-- TRUNCATE CATALOG — All 4 databases (Prilixor / Blinksmed)
-- =============================================================================
-- Removes ALL Categories & Products (and related listing/order links).
--
-- DATABASE LAYOUT:
--   admin_portal_db    → Admin users/RBAC only        (NO catalog — skipped)
--   common_portal_db   → Master catalog (primary)     ✓ CLEAN
--   vendor_portal_db   → Legacy catalog mirror +      ✓ CLEAN
--                        vendor listings/inventory
--   customer_portal_db → Orders/favorites (UUID refs) ✓ CLEAN (optional links)
--
-- HOW TO RUN (psql — recommended):
--   cd Prilixor.VendorPortal
--   psql -U postgres -h YOUR_HOST -d postgres ^
--     -f Prilixor.VendorPortal.Infrastructure/Database/Scripts/Maintenance/truncate_catalog_all_databases.sql
--
-- pgAdmin: connect to each database and run the matching STEP block only.
--
-- BACKUP FIRST:
--   pg_dump -h HOST -U USER -F c -f backup_admin.dump admin_portal_db
--   pg_dump -h HOST -U USER -F c -f backup_common.dump common_portal_db
--   pg_dump -h HOST -U USER -F c -f backup_vendor.dump vendor_portal_db
--   pg_dump -h HOST -U USER -F c -f backup_customer.dump customer_portal_db
--
-- WARNING: Irreversible.
-- =============================================================================

\set ON_ERROR_STOP on

\echo '========== PREVIEW COUNTS (before delete) =========='

\echo '--- customer_portal_db ---'
\c customer_portal_db
SELECT 'customer_rental_orders' AS tbl, COUNT(*)::bigint AS cnt FROM public.customer_rental_orders
UNION ALL SELECT 'customer_order_vendor_offers', COUNT(*) FROM public.customer_order_vendor_offers;

DO $$
BEGIN
  IF to_regclass('public.customer_favorites') IS NOT NULL THEN
    RAISE NOTICE 'customer_favorites: %', (SELECT COUNT(*) FROM public.customer_favorites);
  END IF;
  IF to_regclass('public.customer_rental_order_assets') IS NOT NULL THEN
    RAISE NOTICE 'customer_rental_order_assets: %', (SELECT COUNT(*) FROM public.customer_rental_order_assets);
  END IF;
END $$;

\echo '--- vendor_portal_db ---'
\c vendor_portal_db
SELECT 'product_categories' AS tbl, COUNT(*)::bigint AS cnt FROM public.product_categories
UNION ALL SELECT 'products', COUNT(*) FROM public.products
UNION ALL SELECT 'product_images', COUNT(*) FROM public.product_images
UNION ALL SELECT 'vendor_product_listings', COUNT(*) FROM public.vendor_product_listings;

DO $$
BEGIN
  IF to_regclass('public.product_variants') IS NOT NULL THEN
    RAISE NOTICE 'product_variants: %', (SELECT COUNT(*) FROM public.product_variants);
  END IF;
  IF to_regclass('public.chemical_properties') IS NOT NULL THEN
    RAISE NOTICE 'chemical_properties: %', (SELECT COUNT(*) FROM public.chemical_properties);
  END IF;
END $$;

\echo '--- common_portal_db ---'
\c common_portal_db
SELECT 'product_categories' AS tbl, COUNT(*)::bigint AS cnt FROM public.product_categories
UNION ALL SELECT 'products', COUNT(*) FROM public.products
UNION ALL SELECT 'product_images', COUNT(*) FROM public.product_images;

DO $$
BEGIN
  IF to_regclass('public.product_variants') IS NOT NULL THEN
    RAISE NOTICE 'product_variants: %', (SELECT COUNT(*) FROM public.product_variants);
  END IF;
  IF to_regclass('public.chemical_properties') IS NOT NULL THEN
    RAISE NOTICE 'chemical_properties: %', (SELECT COUNT(*) FROM public.chemical_properties);
  END IF;
END $$;

\echo ''
\echo '========== DELETING (one transaction per database) =========='
\echo 'Abort now (Ctrl+C) if counts look wrong.'
\echo ''

-- =============================================================================
-- STEP 1: customer_portal_db
-- Orders/favorites store vendor_product_listing_id as UUID (no cross-DB FK).
-- Clears orphaned links after catalog wipe. Does NOT delete customers/addresses.
-- =============================================================================

\echo '--- STEP 1: customer_portal_db ---'
\c customer_portal_db

BEGIN;

DO $$ BEGIN
  IF to_regclass('public.customer_rental_order_assets') IS NOT NULL THEN
    DELETE FROM public.customer_rental_order_assets;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.customer_order_doctor_references') IS NOT NULL THEN
    DELETE FROM public.customer_order_doctor_references;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.customer_rental_order_buyouts') IS NOT NULL THEN
    DELETE FROM public.customer_rental_order_buyouts;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.customer_rental_order_extensions') IS NOT NULL THEN
    DELETE FROM public.customer_rental_order_extensions;
  END IF;
END $$;

DELETE FROM public.customer_order_vendor_offers;
DELETE FROM public.customer_rental_orders;

DO $$ BEGIN
  IF to_regclass('public.customer_favorites') IS NOT NULL THEN
    DELETE FROM public.customer_favorites;
  END IF;
END $$;

COMMIT;

-- =============================================================================
-- STEP 2: vendor_portal_db
-- Catalog is mirrored here + vendor listings have FK to products in this DB.
-- =============================================================================

\echo '--- STEP 2: vendor_portal_db ---'
\c vendor_portal_db

BEGIN;

DO $$ BEGIN
  IF to_regclass('public.vendor_variant_inventory') IS NOT NULL THEN
    DELETE FROM public.vendor_variant_inventory;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.vendor_inventory_movements') IS NOT NULL THEN
    DELETE FROM public.vendor_inventory_movements;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.vendor_product_assets') IS NOT NULL THEN
    DELETE FROM public.vendor_product_assets;
  END IF;
END $$;

DELETE FROM public.vendor_inventory;
DELETE FROM public.vendor_product_documents;
DELETE FROM public.vendor_product_images;
DELETE FROM public.vendor_product_listings;

DELETE FROM public.product_images;

DO $$ BEGIN
  IF to_regclass('public.chemical_properties') IS NOT NULL THEN
    DELETE FROM public.chemical_properties;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.product_variants') IS NOT NULL THEN
    DELETE FROM public.product_variants;
  END IF;
END $$;

DELETE FROM public.products;
DELETE FROM public.product_categories;

COMMIT;

-- =============================================================================
-- STEP 3: common_portal_db
-- Master catalog. Doctors/hospitals are NOT touched.
-- =============================================================================

\echo '--- STEP 3: common_portal_db ---'
\c common_portal_db

BEGIN;

DELETE FROM public.product_images;

DO $$ BEGIN
  IF to_regclass('public.chemical_properties') IS NOT NULL THEN
    DELETE FROM public.chemical_properties;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.product_variants') IS NOT NULL THEN
    DELETE FROM public.product_variants;
  END IF;
END $$;

DELETE FROM public.products;
DELETE FROM public.product_categories;

COMMIT;

-- STEP 4: admin_portal_db — no catalog tables, nothing to run

\echo ''
\echo '========== VERIFY (all should be 0) =========='

\c vendor_portal_db
SELECT 'vendor.product_categories' AS check_name, COUNT(*)::bigint AS remaining FROM public.product_categories
UNION ALL SELECT 'vendor.products', COUNT(*) FROM public.products
UNION ALL SELECT 'vendor.vendor_product_listings', COUNT(*) FROM public.vendor_product_listings;

\c common_portal_db
SELECT 'common.product_categories' AS check_name, COUNT(*)::bigint AS remaining FROM public.product_categories
UNION ALL SELECT 'common.products', COUNT(*) FROM public.products;

\c customer_portal_db
SELECT 'customer.customer_rental_orders' AS check_name, COUNT(*)::bigint AS remaining FROM public.customer_rental_orders;

\echo ''
\echo 'SUCCESS. Admin Products page should show 0 categories / 0 equipment.'
\echo 'Re-upload Excel once. Do not retry the same file on errors.'
