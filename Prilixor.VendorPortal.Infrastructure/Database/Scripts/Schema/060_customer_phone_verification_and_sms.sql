-- Migration: Customer phone verification + SMS notification preference
-- Run on: customer_portal_db

alter table if exists public.customers
    add column if not exists phone_verified_at timestamptz null;

create index if not exists ix_customers_phone_verified_at
    on public.customers(phone_verified_at)
    where phone_verified_at is not null;

alter table if exists public.customer_notification_preferences
    add column if not exists sms_notifications_enabled boolean not null default true;
