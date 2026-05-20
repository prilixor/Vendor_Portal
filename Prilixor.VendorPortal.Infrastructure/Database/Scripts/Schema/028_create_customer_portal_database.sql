-- Creates the dedicated customer portal database.
--
-- Run this while connected to a maintenance database (typically "postgres"), as a role
-- that can create databases (superuser or CREATEDB).
--
-- pgAdmin: open Query Tool on database "postgres" (not your app DB). Prefer autocommit ON,
-- because CREATE DATABASE cannot run inside a transaction block.
--
-- Example:
--   psql -U postgres -d postgres -f 028_create_customer_portal_database.sql
--
-- Then apply schema:
--   psql -U postgres -d customer_portal_db -f 029_customer_portal_database_schema.sql
--
-- Note: If customer_portal_db already exists, this script will fail with a harmless error;
-- skip this step and run 029 only.
--
-- Owner defaults to the PostgreSQL role running this script (same intent as "current user").
-- To force a specific owner, append: OWNER postgres   (use your actual role name)

--CREATE DATABASE customer_portal_db
--    WITH ENCODING 'UTF8'
--    TEMPLATE template0;
--

CREATE DATABASE customer_portal_db
    WITH OWNER postgres
    ENCODING 'UTF8'
    TEMPLATE template0;