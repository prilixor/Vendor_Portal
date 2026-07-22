-- ===============================================
-- MASTER FRESH DB SETUP (Admin/Common/Vendor/Customer)
-- DESTRUCTIVE: drops and recreates the four standard databases.
-- Covers full portal flows: catalog, orders, chat, medical, chemicals,
-- variants/inventory, assets, favorites, refresh tokens, Admin RBAC.
-- Run with psql (NOT pgAdmin query editor).
-- Working directory must be the Prilixor.VendorPortal project root
-- so that \i paths below resolve.
-- ===============================================

\set ON_ERROR_STOP on
\echo 'Starting fresh multi-db setup...'

-- 1) Terminate active connections
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname IN ('admin_portal_db','common_portal_db','vendor_portal_db','customer_portal_db')
  AND pid <> pg_backend_pid();

-- 2) Drop databases
DROP DATABASE IF EXISTS admin_portal_db;
DROP DATABASE IF EXISTS common_portal_db;
DROP DATABASE IF EXISTS vendor_portal_db;
DROP DATABASE IF EXISTS customer_portal_db;

-- 3) Create databases
CREATE DATABASE admin_portal_db;
CREATE DATABASE common_portal_db;
CREATE DATABASE vendor_portal_db;
CREATE DATABASE customer_portal_db;

\echo 'Databases created.'

-- 4) Apply full schema per database
\echo 'Applying admin schema...'
\c admin_portal_db
\i './Prilixor.VendorPortal.Infrastructure/Database/Scripts/Schema/040_admin_portal_full_schema.sql'

\echo 'Applying common schema...'
\c common_portal_db
\i './Prilixor.VendorPortal.Infrastructure/Database/Scripts/Schema/041_common_portal_full_schema.sql'

\echo 'Applying vendor schema...'
\c vendor_portal_db
\i './Prilixor.VendorPortal.Infrastructure/Database/Scripts/Schema/042_vendor_portal_full_schema.sql'

\echo 'Applying customer schema...'
\c customer_portal_db
\i './Prilixor.VendorPortal.Infrastructure/Database/Scripts/Schema/043_customer_portal_full_schema.sql'

-- 5) Post-full Schema incrementals
\echo 'Applying Schema incrementals...'

\c customer_portal_db
\i './Prilixor.VendorPortal.Infrastructure/Database/Scripts/Schema/044_customer_address_geolocation.sql'
\i './Prilixor.VendorPortal.Infrastructure/Database/Scripts/Schema/045_customer_order_pricing_breakdown.sql'
\i './Prilixor.VendorPortal.Infrastructure/Database/Scripts/Schema/046_customer_dispatch_split_and_buy.sql'
\i './Prilixor.VendorPortal.Infrastructure/Database/Scripts/Schema/049_customer_chat_and_preferences.sql'
\i './Prilixor.VendorPortal.Infrastructure/Database/Scripts/Schema/051_rental_extensions_buyouts.sql'
\i './Prilixor.VendorPortal.Infrastructure/Database/Scripts/Migrations/026_add_customer_favorites.sql'

\c common_portal_db
\i './Prilixor.VendorPortal.Infrastructure/Database/Scripts/Schema/047_admin_product_price_master_and_backfill.sql'
\i './Prilixor.VendorPortal.Infrastructure/Database/Scripts/Schema/048_common_product_images.sql'

-- Medical: hospitals/doctors on common, doctor refs on customer (script self-\c)
\i './Prilixor.VendorPortal.Infrastructure/Database/Scripts/Schema/053_medical_directory_schema.sql'

-- Chemical properties on common + vendor (script has no hard \c)
\c common_portal_db
\i './Prilixor.VendorPortal.Infrastructure/Database/Scripts/Schema/054_chemical_properties.sql'
\c vendor_portal_db
\i './Prilixor.VendorPortal.Infrastructure/Database/Scripts/Schema/048_common_product_images.sql'
\i './Prilixor.VendorPortal.Infrastructure/Database/Scripts/Schema/054_chemical_properties.sql'

-- Hybrid assets: guarded sections; run on both vendor and customer
\c vendor_portal_db
\i './Prilixor.VendorPortal.Infrastructure/Database/Scripts/Schema/050_hybrid_asset_tracking.sql'
\c customer_portal_db
\i './Prilixor.VendorPortal.Infrastructure/Database/Scripts/Schema/050_hybrid_asset_tracking.sql'

\c admin_portal_db
\i './Prilixor.VendorPortal.Infrastructure/Database/Scripts/Schema/052_refresh_tokens.sql'

-- 6) Feature migrations (scripts may \c themselves)
\echo 'Applying feature migrations...'

\i './Prilixor.VendorPortal.Infrastructure/Database/Scripts/Migrations/055_add_is_chemical_to_product_categories.sql'
\i './Prilixor.VendorPortal.Infrastructure/Database/Scripts/Migrations/056_add_vendor_pricing_and_sizing_chart.sql'

-- Schema 055 depends on vendor_product_assets (050) + product_variants (056)
\i './Prilixor.VendorPortal.Infrastructure/Database/Scripts/Schema/055_vendor_product_assets_variant.sql'

\i './Prilixor.VendorPortal.Infrastructure/Database/Scripts/Migrations/057_add_vendor_variant_inventory.sql'

-- 7) Admin RBAC + SuperAdmin protection (required for BootstrapSuperAdmin)
\echo 'Applying Admin RBAC / SuperAdmin migrations...'

\c admin_portal_db
\i './Prilixor.VendorPortal.Infrastructure/Database/Scripts/Migrations/058_admin_rbac.sql'
\i './Prilixor.VendorPortal.Infrastructure/Database/Scripts/Migrations/060_customer_impersonation.sql'
\i './Prilixor.VendorPortal.Infrastructure/Database/Scripts/Migrations/061_superadmin_protection.sql'
\i './Prilixor.VendorPortal.Infrastructure/Database/Scripts/Migrations/062_admin_doctor_references.sql'

\c customer_portal_db
\i './Prilixor.VendorPortal.Infrastructure/Database/Scripts/Migrations/059_customer_orders_placed_by_admin.sql'

\echo 'All schemas and migrations applied successfully.'
\echo 'Coverage: admin/common/vendor/customer, medical, chemicals, variants, assets, favorites, RBAC.'
\echo 'Next: enable BootstrapSuperAdmin in appsettings, start the API once, then disable bootstrap.'
