# Fresh Split Database Setup

Use this when you want a clean install with separate databases for Admin, Vendor, Common, and Customer.

## 1) Create databases

Run on maintenance DB (`postgres`):

- `031_create_admin_vendor_common_databases.sql`
- `028_create_customer_portal_database.sql` (if customer DB is not already created)

## 2) Apply full schema per database

Run each script on its target DB:

- `admin_portal_db` -> `040_admin_portal_full_schema.sql`
- `common_portal_db` -> `041_common_portal_full_schema.sql`
- `vendor_portal_db` -> `042_vendor_portal_full_schema.sql`
- `customer_portal_db` -> `043_customer_portal_full_schema.sql`

If your DB names are suffixed (example: `vendor_portal_db_new`, `customer_portal_db_new`), run the same scripts on those renamed DBs and update `appsettings.Development.json` connection strings to match.

## Notes

- Prefer `master_fresh_setup.sql` for a full local bootstrap (includes customer order chat `056`, order images `057`, and vendor photo-request `058`).
- The `04x` scripts are full standalone scripts and replace the need to execute old incremental `001`..`034` during fresh setup.
- On an existing DB that already has `057`, run only `058_vendor_order_image_requests.sql` (do not drop `customer_order_images`).
- `042_vendor_portal_full_schema.sql` includes catalog tables (`product_categories`, `products`) for compatibility with the current staged migration logic.
- If you are doing a strict final split where catalog exists only in Common DB, we can create a follow-up `vendor-only-without-catalog` variant and update FK/read logic accordingly.
- For local development in this branch, `appsettings.Development.json` points to `vendor_portal_db_new` and `customer_portal_db_new` by default.
