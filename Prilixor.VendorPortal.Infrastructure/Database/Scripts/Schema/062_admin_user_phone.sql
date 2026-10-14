-- Migration: Admin user mobile + verification timestamp
-- Run on: admin_portal_db (admin_users)

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
