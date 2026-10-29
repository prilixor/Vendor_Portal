-- ----------------------------------------------------
-- Migration: 088_customer_order_cancellation_refunds.sql
-- Target Database: customer_portal_db
-- Description: Admin review and refund for a paid product that was cancelled or dispatch failed.
-- Execution: psql -d customer_portal_db -f 088_customer_order_cancellation_refunds.sql
-- ----------------------------------------------------

\c customer_portal_db

CREATE TABLE IF NOT EXISTS public.customer_order_cancellation_refunds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_rental_order_id uuid NOT NULL REFERENCES public.customer_rental_orders(id),
    outcome varchar(32) NOT NULL,
    actor_role varchar(20) NOT NULL,
    actor_label varchar(240) NOT NULL,
    paid_amount numeric(12,2) NOT NULL,
    original_paid_amount numeric(12,2) NOT NULL,
    extension_paid_amount numeric(12,2) NOT NULL,
    charge_amount numeric(12,2) NOT NULL,
    charge_reason varchar(500) NULL,
    refund_amount numeric(12,2) NOT NULL,
    refunded_online_amount numeric(12,2) NOT NULL DEFAULT 0,
    status varchar(32) NOT NULL,
    has_online_payment boolean NOT NULL DEFAULT false,
    refund_method varchar(20) NULL,
    razorpay_payment_id varchar(64) NULL,
    razorpay_refund_id varchar(240) NULL,
    refund_reference varchar(240) NULL,
    refunded_at timestamptz NULL,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NULL,
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL,

    CONSTRAINT ck_customer_order_cancellation_refunds_amounts CHECK (
        paid_amount >= 0
        AND original_paid_amount >= 0
        AND extension_paid_amount >= 0
        AND original_paid_amount + extension_paid_amount = paid_amount
        AND charge_amount >= 0
        AND charge_amount <= paid_amount
        AND refund_amount = paid_amount - charge_amount
        AND refunded_online_amount >= 0
        AND refunded_online_amount <= refund_amount
    ),
    CONSTRAINT ck_customer_order_cancellation_refunds_status CHECK (
        status IN ('pending_review', 'refunding', 'refunded', 'settled')
    ),
    CONSTRAINT ck_customer_order_cancellation_refunds_outcome CHECK (
        outcome IN ('cancelled', 'dispatch_failed')
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_customer_order_cancellation_refunds_order
    ON public.customer_order_cancellation_refunds (customer_rental_order_id)
    WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_customer_order_cancellation_refunds_pending
    ON public.customer_order_cancellation_refunds (created_at DESC)
    WHERE is_deleted = false AND status = 'pending_review';

COMMENT ON TABLE public.customer_order_cancellation_refunds IS
    'Admin review of a paid cancelled or dispatch-failed product. Customer refund is the captured payment minus an optional charge.';
