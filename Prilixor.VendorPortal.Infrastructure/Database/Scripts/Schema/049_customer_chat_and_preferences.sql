-- Migration: Add customer notification preferences and customer-vendor chat tables
-- Run on: customer_portal_db

CREATE TABLE IF NOT EXISTS public.customer_notification_preferences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid NOT NULL UNIQUE REFERENCES public.customers(id) ON DELETE CASCADE,
    order_status_updates_enabled boolean NOT NULL DEFAULT true,
    expiration_reminders_enabled boolean NOT NULL DEFAULT true,
    deposit_refunds_enabled boolean NOT NULL DEFAULT true,
    direct_messages_enabled boolean NOT NULL DEFAULT true,
    marketing_emails_enabled boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL
);

CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    vendor_id uuid NOT NULL, -- No foreign key reference because vendor resides in a separate database (vendor_portal_db)
    order_id uuid NULL REFERENCES public.customer_rental_orders(id) ON DELETE SET NULL,
    subject varchar(500) NOT NULL,
    last_message_at timestamptz NOT NULL DEFAULT now(),
    is_closed boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL
);

CREATE INDEX IF NOT EXISTS ix_chat_sessions_customer_id ON public.chat_sessions(customer_id);
CREATE INDEX IF NOT EXISTS ix_chat_sessions_vendor_id ON public.chat_sessions(vendor_id);
CREATE INDEX IF NOT EXISTS ix_chat_sessions_order_id ON public.chat_sessions(order_id);

CREATE TABLE IF NOT EXISTS public.chat_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_session_id uuid NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    sender_type varchar(30) NOT NULL, -- 'Customer' or 'Vendor'
    message_text text NOT NULL,
    sent_at timestamptz NOT NULL DEFAULT now(),
    is_read boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL
);

CREATE INDEX IF NOT EXISTS ix_chat_messages_chat_session_id ON public.chat_messages(chat_session_id);
CREATE INDEX IF NOT EXISTS ix_chat_messages_sent_at ON public.chat_messages(sent_at);
