-- Migration: Vendor phone verification + SMS notification preference
-- Run on: vendor_portal_db

alter table if exists public.vendors
    add column if not exists phone_verified_at timestamptz null;

create index if not exists ix_vendors_phone_verified_at
    on public.vendors(phone_verified_at)
    where phone_verified_at is not null;

alter table if exists public.vendor_notification_preferences
    add column if not exists sms_notifications_enabled boolean not null default true;
