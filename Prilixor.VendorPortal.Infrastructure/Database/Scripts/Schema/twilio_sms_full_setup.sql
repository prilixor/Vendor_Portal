-- =============================================================================
-- Twilio / SMS full DB setup (idempotent)
-- Consolidates Schema scripts: 059, 060, 061, 062, 063, 064, 065
-- (040 admin fresh schema already includes admin phone columns for new installs)
--
-- Databases involved:
--   1) vendor_portal_db   — vendor phone verify + SMS pref + platform_sms_settings
--   2) customer_portal_db — customer phone/email OTP support + uniqueness
--   3) admin_portal_db    — admin phone columns (unused by product; email-only admins)
--
-- How to run:
--   A) Preferred: .\twilio_sms_full_setup.ps1 (applies each section to the right DB)
--   B) Manual: connect to each DB and run the matching SECTION below
--
-- Safe to re-run. Does not overwrite an existing platform_sms_settings row's toggles
-- after first insert (new rows default all transactional SMS OFF; OTP uses Verify).
-- =============================================================================

-- #############################################################################
-- SECTION 1 — vendor_portal_db
-- Source: 059_vendor_phone_verification_and_sms.sql + 065_platform_sms_settings.sql
-- #############################################################################

-- >>> CONNECT: vendor_portal_db

ALTER TABLE IF EXISTS public.vendors
    ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS ix_vendors_phone_verified_at
    ON public.vendors (phone_verified_at)
    WHERE phone_verified_at IS NOT NULL;

ALTER TABLE IF EXISTS public.vendor_notification_preferences
    ADD COLUMN IF NOT EXISTS sms_notifications_enabled boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.platform_sms_settings (
    id uuid PRIMARY KEY,
    transactional_sms_enabled boolean NOT NULL DEFAULT false,
    customer_order_placed boolean NOT NULL DEFAULT false,
    customer_order_confirmed boolean NOT NULL DEFAULT false,
    customer_order_cancelled boolean NOT NULL DEFAULT false,
    customer_order_status_updated boolean NOT NULL DEFAULT false,
    customer_order_dispatch_failed boolean NOT NULL DEFAULT false,
    customer_order_expiring boolean NOT NULL DEFAULT false,
    vendor_new_order boolean NOT NULL DEFAULT false,
    vendor_account_approved boolean NOT NULL DEFAULT false,
    vendor_account_rejected boolean NOT NULL DEFAULT false,
    vendor_account_suspended boolean NOT NULL DEFAULT false,
    vendor_account_banned boolean NOT NULL DEFAULT false,
    vendor_account_reactivated boolean NOT NULL DEFAULT false,
    vendor_bank_verified boolean NOT NULL DEFAULT false,
    vendor_document_verified boolean NOT NULL DEFAULT false,
    vendor_service_area_updated boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NULL,
    is_deleted boolean NOT NULL DEFAULT false
);

ALTER TABLE public.platform_sms_settings
    ALTER COLUMN transactional_sms_enabled SET DEFAULT false,
    ALTER COLUMN customer_order_placed SET DEFAULT false,
    ALTER COLUMN customer_order_confirmed SET DEFAULT false,
    ALTER COLUMN customer_order_cancelled SET DEFAULT false,
    ALTER COLUMN customer_order_status_updated SET DEFAULT false,
    ALTER COLUMN customer_order_dispatch_failed SET DEFAULT false,
    ALTER COLUMN customer_order_expiring SET DEFAULT false,
    ALTER COLUMN vendor_new_order SET DEFAULT false,
    ALTER COLUMN vendor_account_approved SET DEFAULT false,
    ALTER COLUMN vendor_account_rejected SET DEFAULT false,
    ALTER COLUMN vendor_account_suspended SET DEFAULT false,
    ALTER COLUMN vendor_account_banned SET DEFAULT false,
    ALTER COLUMN vendor_account_reactivated SET DEFAULT false,
    ALTER COLUMN vendor_bank_verified SET DEFAULT false,
    ALTER COLUMN vendor_document_verified SET DEFAULT false,
    ALTER COLUMN vendor_service_area_updated SET DEFAULT false;

INSERT INTO public.platform_sms_settings (
    id,
    transactional_sms_enabled,
    customer_order_placed,
    customer_order_confirmed,
    customer_order_cancelled,
    customer_order_status_updated,
    customer_order_dispatch_failed,
    customer_order_expiring,
    vendor_new_order,
    vendor_account_approved,
    vendor_account_rejected,
    vendor_account_suspended,
    vendor_account_banned,
    vendor_account_reactivated,
    vendor_bank_verified,
    vendor_document_verified,
    vendor_service_area_updated
)
SELECT
    gen_random_uuid(),
    false, false, false, false, false, false, false,
    false, false, false, false, false, false, false, false, false
WHERE NOT EXISTS (
    SELECT 1 FROM public.platform_sms_settings WHERE COALESCE(is_deleted, false) = false
);

-- #############################################################################
-- SECTION 2 — customer_portal_db
-- Source: 060 + 061 + 063 + 064
-- #############################################################################

-- >>> CONNECT: customer_portal_db

ALTER TABLE IF EXISTS public.customers
    ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS ix_customers_phone_verified_at
    ON public.customers (phone_verified_at)
    WHERE phone_verified_at IS NOT NULL;

ALTER TABLE IF EXISTS public.customer_notification_preferences
    ADD COLUMN IF NOT EXISTS sms_notifications_enabled boolean NOT NULL DEFAULT true;

-- Email OR phone registration
ALTER TABLE IF EXISTS public.customers
    ALTER COLUMN email DROP NOT NULL;

ALTER TABLE IF EXISTS public.customers
    ADD COLUMN IF NOT EXISTS email_verification_token varchar(255) NULL,
    ADD COLUMN IF NOT EXISTS email_verification_token_expires_at timestamptz NULL;

ALTER TABLE IF EXISTS public.customers
    DROP CONSTRAINT IF EXISTS customers_email_key;

DROP INDEX IF EXISTS ux_customers_email;
DROP INDEX IF EXISTS customers_email_key;

-- Clear duplicate phones (keep earliest) before unique index
WITH ranked_phone AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY btrim(phone)
            ORDER BY created_at ASC NULLS LAST, id ASC
        ) AS rn
    FROM public.customers
    WHERE phone IS NOT NULL
      AND btrim(phone) <> ''
      AND COALESCE(is_deleted, false) = false
)
UPDATE public.customers c
SET
    phone = NULL,
    phone_verified_at = NULL
FROM ranked_phone r
WHERE c.id = r.id
  AND r.rn > 1;

-- Unique email / phone (active rows; case/trim insensitive email)
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

CREATE INDEX IF NOT EXISTS ix_customers_email_verification_token
    ON public.customers (email_verification_token)
    WHERE email_verification_token IS NOT NULL;

-- #############################################################################
-- SECTION 3 — admin_portal_db
-- Source: 062_admin_user_phone.sql (columns also present in 040 fresh schema)
-- Note: Admin product is email-only; columns kept for schema compatibility.
-- #############################################################################

-- >>> CONNECT: admin_portal_db

ALTER TABLE IF EXISTS public.admin_users
    ADD COLUMN IF NOT EXISTS phone varchar(20) NULL,
    ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_admin_users_phone_active
    ON public.admin_users (phone)
    WHERE phone IS NOT NULL
      AND btrim(phone) <> ''
      AND COALESCE(is_deleted, false) = false;

CREATE INDEX IF NOT EXISTS ix_admin_users_phone_verified_at
    ON public.admin_users (phone_verified_at)
    WHERE phone_verified_at IS NOT NULL;
