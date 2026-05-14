-- Fix: Add missing columns to support_messages that EF Core expects
-- Based on actual DDL: sender_id, updated_at, and updated_by are missing

ALTER TABLE public.support_messages
    ADD COLUMN IF NOT EXISTS sender_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

ALTER TABLE public.support_messages
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE public.support_messages
    ADD COLUMN IF NOT EXISTS updated_by UUID;

CREATE INDEX IF NOT EXISTS ix_support_messages_sender_id ON public.support_messages(sender_id);

-- Also ensure support_tickets has all expected columns
ALTER TABLE public.support_tickets
    ADD COLUMN IF NOT EXISTS updated_by UUID;