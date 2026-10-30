-- ----------------------------------------------------
-- Migration: 090_discount_codes.sql
-- Target Database: customer_portal_db
-- Description: Checkout discount codes, per-order discount snapshot, and redemption holds.
-- Execution: psql -d customer_portal_db -f 090_discount_codes.sql
-- ----------------------------------------------------

\c customer_portal_db

CREATE TABLE IF NOT EXISTS public.discount_codes (
    id uuid PRIMARY KEY,
    code varchar(20) NOT NULL,
    discount_type varchar(20) NOT NULL,
    discount_value numeric(12,2) NOT NULL,
    max_discount_amount numeric(12,2) NULL,
    minimum_item_total numeric(12,2) NULL,
    starts_at timestamptz NULL,
    ends_at timestamptz NULL,
    is_active boolean NOT NULL DEFAULT true,
    max_total_uses int NULL,
    max_uses_per_customer int NULL,
    applies_to varchar(10) NOT NULL DEFAULT 'both',
    show_to_customers boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NULL,
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL,
    CONSTRAINT ck_discount_codes_type CHECK (discount_type IN ('percentage', 'fixed')),
    CONSTRAINT ck_discount_codes_applies_to CHECK (applies_to IN ('rent', 'buy', 'both')),
    CONSTRAINT ck_discount_codes_value CHECK (discount_value > 0),
    CONSTRAINT ck_discount_codes_percent CHECK (discount_type <> 'percentage' OR discount_value <= 100),
    CONSTRAINT ck_discount_codes_cap CHECK (max_discount_amount IS NULL OR max_discount_amount > 0),
    CONSTRAINT ck_discount_codes_minimum CHECK (minimum_item_total IS NULL OR minimum_item_total >= 0),
    CONSTRAINT ck_discount_codes_uses CHECK (
        (max_total_uses IS NULL OR max_total_uses > 0)
        AND (max_uses_per_customer IS NULL OR max_uses_per_customer > 0)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_discount_codes_code
    ON public.discount_codes (upper(code))
    WHERE is_deleted = false;

CREATE TABLE IF NOT EXISTS public.discount_code_products (
    discount_code_id uuid NOT NULL REFERENCES public.discount_codes(id) ON DELETE CASCADE,
    product_id uuid NOT NULL,
    PRIMARY KEY (discount_code_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.discount_code_categories (
    discount_code_id uuid NOT NULL REFERENCES public.discount_codes(id) ON DELETE CASCADE,
    category_id uuid NOT NULL,
    PRIMARY KEY (discount_code_id, category_id)
);

CREATE TABLE IF NOT EXISTS public.discount_code_redemptions (
    id uuid PRIMARY KEY,
    discount_code_id uuid NOT NULL REFERENCES public.discount_codes(id),
    customer_id uuid NOT NULL,
    checkout_session_id uuid NOT NULL REFERENCES public.customer_checkout_sessions(id),
    status varchar(20) NOT NULL,
    discount_amount numeric(12,2) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NULL,
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL,
    CONSTRAINT ck_discount_code_redemptions_status CHECK (status IN ('reserved', 'paid', 'released')),
    CONSTRAINT ck_discount_code_redemptions_amount CHECK (discount_amount >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_discount_code_redemptions_session
    ON public.discount_code_redemptions (checkout_session_id)
    WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_discount_code_redemptions_code_status
    ON public.discount_code_redemptions (discount_code_id, status)
    WHERE is_deleted = false;

ALTER TABLE public.customer_rental_orders
    ADD COLUMN IF NOT EXISTS discount_code_id uuid NULL,
    ADD COLUMN IF NOT EXISTS discount_code varchar(20) NULL,
    ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.customer_checkout_sessions
    ADD COLUMN IF NOT EXISTS discount_code_id uuid NULL,
    ADD COLUMN IF NOT EXISTS discount_code varchar(20) NULL,
    ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) NOT NULL DEFAULT 0;
