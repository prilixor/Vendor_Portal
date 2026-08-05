-- Migration: Route customer order chat to Admin (not Vendor)
-- Run on: customer_portal_db

ALTER TABLE public.chat_sessions
    ADD COLUMN IF NOT EXISTS counterparty_type varchar(30) NOT NULL DEFAULT 'Vendor';

-- Admin order chats keep vendor_id for context only; allow null for non-order admin chats later.
ALTER TABLE public.chat_sessions
    ALTER COLUMN vendor_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS ix_chat_sessions_counterparty_type
    ON public.chat_sessions(counterparty_type);

COMMENT ON COLUMN public.chat_sessions.counterparty_type IS
    'Who the customer chats with: Vendor (legacy) or Admin.';
