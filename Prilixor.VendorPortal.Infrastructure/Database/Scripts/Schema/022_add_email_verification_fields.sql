-- Migration: Add email verification token fields to vendors table
-- This migration adds support for email verification flow with tokens

-- Add the email verification token and expiry columns if they don't exist
alter table if exists public.vendors
add column if not exists email_verification_token text null,
add column if not exists verification_token_expiry_utc timestamptz null,
add column if not exists terms_accepted_at timestamptz null;

-- Create index on email_verification_token for faster lookups
create index if not exists ix_vendors_email_verification_token on public.vendors(email_verification_token) 
where email_verification_token is not null;

-- Create index on email_verified for faster filtering
create index if not exists ix_vendors_email_verified on public.vendors(email_verified);
