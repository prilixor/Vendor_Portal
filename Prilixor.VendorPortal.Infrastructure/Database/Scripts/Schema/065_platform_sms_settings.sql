-- Admin-controlled Twilio transactional SMS toggles (single row).
-- Run on: vendor portal DB (same as website_global_settings / ApplicationDbContext).
-- Defaults: ALL transactional events OFF.
-- OTP (register / forgot-password Verify) is NOT gated here — only outbound Messaging SMS.

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

-- If table already existed with true defaults, force column defaults + row to OFF.
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

INSERT INTO public.platform_sms_settings (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (
    SELECT 1 FROM public.platform_sms_settings WHERE COALESCE(is_deleted, false) = false
);

UPDATE public.platform_sms_settings
SET
    transactional_sms_enabled = false,
    customer_order_placed = false,
    customer_order_confirmed = false,
    customer_order_cancelled = false,
    customer_order_status_updated = false,
    customer_order_dispatch_failed = false,
    customer_order_expiring = false,
    vendor_new_order = false,
    vendor_account_approved = false,
    vendor_account_rejected = false,
    vendor_account_suspended = false,
    vendor_account_banned = false,
    vendor_account_reactivated = false,
    vendor_bank_verified = false,
    vendor_document_verified = false,
    vendor_service_area_updated = false,
    updated_at = now()
WHERE COALESCE(is_deleted, false) = false;
