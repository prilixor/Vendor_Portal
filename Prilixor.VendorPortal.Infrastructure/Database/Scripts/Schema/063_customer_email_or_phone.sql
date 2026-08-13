-- Customer register: email OR phone
-- - email nullable (phone-only accounts)
-- - email verification token columns (email-only accounts)
-- Run on: customer_portal_db

ALTER TABLE IF EXISTS public.customers
    ALTER COLUMN email DROP NOT NULL;

ALTER TABLE IF EXISTS public.customers
    ADD COLUMN IF NOT EXISTS email_verification_token varchar(255) NULL,
    ADD COLUMN IF NOT EXISTS email_verification_token_expires_at timestamptz NULL;

-- Replace hard unique on email with partial unique (allows multiple NULLs)
ALTER TABLE IF EXISTS public.customers
    DROP CONSTRAINT IF EXISTS customers_email_key;

DROP INDEX IF EXISTS ux_customers_email;
DROP INDEX IF EXISTS customers_email_key;

CREATE UNIQUE INDEX IF NOT EXISTS ux_customers_email_active
    ON public.customers (lower(btrim(email)))
    WHERE email IS NOT NULL
      AND btrim(email) <> ''
      AND COALESCE(is_deleted, false) = false;

CREATE INDEX IF NOT EXISTS ix_customers_email_verification_token
    ON public.customers (email_verification_token)
    WHERE email_verification_token IS NOT NULL;
