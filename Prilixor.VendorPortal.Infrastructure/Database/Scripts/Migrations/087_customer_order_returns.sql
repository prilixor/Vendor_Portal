-- ----------------------------------------------------
-- Migration: 087_customer_order_returns.sql
-- Target Database: customer_portal_db
-- Description: One return inspection and deposit refund per rental product line.
-- Execution: psql -d customer_portal_db -f 087_customer_order_returns.sql
-- ----------------------------------------------------

\c customer_portal_db

CREATE TABLE IF NOT EXISTS public.customer_order_returns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_rental_order_id uuid NOT NULL REFERENCES public.customer_rental_orders(id),
    deposit_amount numeric(12,2) NOT NULL,
    damage_amount numeric(12,2) NOT NULL,
    damage_reason varchar(500) NULL,
    refund_amount numeric(12,2) NOT NULL,
    status varchar(32) NOT NULL,
    refund_method varchar(20) NULL,
    razorpay_payment_id varchar(64) NULL,
    razorpay_refund_id varchar(64) NULL,
    refund_reference varchar(120) NULL,
    refunded_at timestamptz NULL,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NULL,
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL,

    CONSTRAINT ck_customer_order_returns_amounts CHECK (
        deposit_amount >= 0
        AND damage_amount >= 0
        AND damage_amount <= deposit_amount
        AND refund_amount = deposit_amount - damage_amount
    ),
    CONSTRAINT ck_customer_order_returns_status CHECK (
        status IN ('pending_refund', 'refunding', 'refunded', 'settled')
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_customer_order_returns_order
    ON public.customer_order_returns (customer_rental_order_id)
    WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_customer_order_returns_pending
    ON public.customer_order_returns (created_at DESC)
    WHERE is_deleted = false AND status = 'pending_refund';

COMMENT ON TABLE public.customer_order_returns IS
    'Vendor return inspection for one product. Customer refund is that product''s security deposit minus the damage charge.';
