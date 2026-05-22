-- Creates dedicated databases for phased portal separation.
--
-- Run while connected to maintenance DB "postgres" as a role with CREATEDB privileges.
-- These CREATE DATABASE statements are intentionally separate from schema migration.
--
-- Example:
--   psql -U postgres -d postgres -f 031_create_admin_vendor_common_databases.sql
--
-- Note:
-- - If a database already exists, PostgreSQL will throw a harmless error.
-- - Existing application behavior remains unchanged until connection strings are switched.

CREATE DATABASE admin_portal_db
    WITH OWNER postgres
    ENCODING 'UTF8'
    TEMPLATE template0;

CREATE DATABASE vendor_portal_db
    WITH OWNER postgres
    ENCODING 'UTF8'
    TEMPLATE template0;

CREATE DATABASE common_portal_db
    WITH OWNER postgres
    ENCODING 'UTF8'
    TEMPLATE template0;
