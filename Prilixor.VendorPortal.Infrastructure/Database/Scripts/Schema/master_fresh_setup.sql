-- ===============================================
-- MASTER FRESH DB SETUP (Admin/Common/Vendor/Customer)
-- Run with psql (NOT pgAdmin query editor)
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

-- 5) Optional post-full incrementals (safe/idempotent)
\echo 'Applying optional incrementals...'

\c common_portal_db
\i './Prilixor.VendorPortal.Infrastructure/Database/Scripts/Schema/047_admin_product_price_master_and_backfill.sql'

\c customer_portal_db
\i './Prilixor.VendorPortal.Infrastructure/Database/Scripts/Schema/044_customer_address_geolocation.sql'
\i './Prilixor.VendorPortal.Infrastructure/Database/Scripts/Schema/045_customer_order_pricing_breakdown.sql'
\i './Prilixor.VendorPortal.Infrastructure/Database/Scripts/Schema/046_customer_dispatch_split_and_buy.sql'

\echo 'All schemas applied successfully.'
