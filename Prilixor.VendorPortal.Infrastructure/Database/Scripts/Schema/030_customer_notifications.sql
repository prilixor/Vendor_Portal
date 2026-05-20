-- In-app notifications for customer portal (inbox).
-- Apply on the same database as 029_customer_portal_database_schema.sql (CustomerPortalConnection).
--
-- Phase 1 notification_type values (see Domain Customers.CustomerNotificationTypes):
--   general, welcome, order_pending, order_cancelled

CREATE TABLE IF NOT EXISTS public.customer_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id),
    title VARCHAR(300) NOT NULL,
    body TEXT NOT NULL,
    notification_type VARCHAR(80) NOT NULL DEFAULT 'general',
    related_order_id UUID NULL REFERENCES public.customer_rental_orders(id) ON DELETE SET NULL,
    read_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ NULL,
    deleted_by UUID NULL
);

CREATE INDEX IF NOT EXISTS ix_customer_notifications_customer_id ON public.customer_notifications(customer_id);
CREATE INDEX IF NOT EXISTS ix_customer_notifications_customer_created ON public.customer_notifications(customer_id, created_at DESC);
