-- Harden customer email uniqueness (case/trim insensitive).
-- Also adds phone uniqueness for active rows.
-- Run on: customer_portal_db
--
-- If this fails with "could not create unique index", clean duplicates first, e.g.:
--   SELECT lower(btrim(email)) AS e, count(*) FROM customers
--   WHERE email IS NOT NULL AND COALESCE(is_deleted,false)=false
--   GROUP BY 1 HAVING count(*) > 1;

DROP INDEX IF EXISTS ux_customers_email_active;

CREATE UNIQUE INDEX IF NOT EXISTS ux_customers_email_active
    ON public.customers (lower(btrim(email)))
    WHERE email IS NOT NULL
      AND btrim(email) <> ''
      AND COALESCE(is_deleted, false) = false;

DROP INDEX IF EXISTS ux_customers_phone_active;

CREATE UNIQUE INDEX IF NOT EXISTS ux_customers_phone_active
    ON public.customers (btrim(phone))
    WHERE phone IS NOT NULL
      AND btrim(phone) <> ''
      AND COALESCE(is_deleted, false) = false;
