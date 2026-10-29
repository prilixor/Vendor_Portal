-- Admin switch for phone OTP (login, registration, forgot-password SMS, phone verify).
-- Run on: vendor portal DB (platform_sms_settings).
-- Default ON so existing OTP sign-in stays until an admin turns it off.
\c vendor_portal_db
ALTER TABLE public.platform_sms_settings
    ADD COLUMN IF NOT EXISTS phone_otp_enabled boolean NOT NULL DEFAULT true;
