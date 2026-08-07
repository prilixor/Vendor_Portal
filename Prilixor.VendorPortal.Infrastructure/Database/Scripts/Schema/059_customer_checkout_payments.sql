-- Migration: Razorpay checkout sessions (draft-until-paid whole-cart payments).
-- Run on: customer_portal_db

\c customer_portal_db

CREATE TABLE IF NOT EXISTS public.customer_checkout_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid NOT NULL REFERENCES public.customers(id),
    source varchar(40) NOT NULL DEFAULT 'customer_web',
    status varchar(30) NOT NULL DEFAULT 'created',
    amount numeric(18,2) NOT NULL,
    currency varchar(10) NOT NULL DEFAULT 'INR',
    razorpay_order_id varchar(80) NULL,
    razorpay_payment_id varchar(80) NULL,
    razorpay_payment_link_id varchar(80) NULL,
    payment_link_url text NULL,
    receipt varchar(80) NULL,
    paid_at timestamptz NULL,
    placed_by_admin_id uuid NULL,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_customer_checkout_sessions_razorpay_order
    ON public.customer_checkout_sessions(razorpay_order_id)
    WHERE razorpay_order_id IS NOT NULL AND is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_customer_checkout_sessions_customer
    ON public.customer_checkout_sessions(customer_id)
    WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_customer_checkout_sessions_status
    ON public.customer_checkout_sessions(status)
    WHERE is_deleted = false;

CREATE TABLE IF NOT EXISTS public.customer_checkout_session_orders (
    checkout_session_id uuid NOT NULL REFERENCES public.customer_checkout_sessions(id),
    customer_rental_order_id uuid NOT NULL REFERENCES public.customer_rental_orders(id),
    PRIMARY KEY (checkout_session_id, customer_rental_order_id)
);

CREATE INDEX IF NOT EXISTS ix_customer_checkout_session_orders_order
    ON public.customer_checkout_session_orders(customer_rental_order_id);

ALTER TABLE public.customer_rental_orders
    ADD COLUMN IF NOT EXISTS checkout_session_id uuid NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_customer_rental_orders_checkout_session'
    ) THEN
        ALTER TABLE public.customer_rental_orders
            ADD CONSTRAINT fk_customer_rental_orders_checkout_session
            FOREIGN KEY (checkout_session_id) REFERENCES public.customer_checkout_sessions(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_customer_rental_orders_checkout_session
    ON public.customer_rental_orders(checkout_session_id)
    WHERE checkout_session_id IS NOT NULL AND is_deleted = false;

COMMENT ON TABLE public.customer_checkout_sessions IS
    'One Razorpay payment for a whole cart; orders stay awaiting_payment until paid.';
