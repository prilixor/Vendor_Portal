-- Migration: Add Rental Order Extensions and Buyouts
-- Run on: customer_portal_db_new

ALTER TABLE public.customer_rental_orders ADD COLUMN IF NOT EXISTS is_extended boolean NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS public.customer_rental_orders
    DROP CONSTRAINT IF EXISTS chk_customer_rental_orders_status;

ALTER TABLE IF EXISTS public.customer_rental_orders
    ADD CONSTRAINT chk_customer_rental_orders_status
    CHECK (status IN ('pending', 'awaiting_vendor_acceptance', 'confirmed', 'in_transit', 'active', 'returned', 'bought_out', 'cancelled', 'dispatch_failed'));

CREATE TABLE IF NOT EXISTS public.customer_rental_order_extensions (
    id uuid NOT NULL,
    customer_rental_order_id uuid NOT NULL,
    original_end_date date NOT NULL,
    new_end_date date NOT NULL,
    additional_days integer NOT NULL,
    extension_amount numeric NOT NULL,
    service_fee_amount numeric NOT NULL,
    gst_amount numeric NOT NULL,
    total_amount numeric NOT NULL,
    status varchar(50) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    is_deleted boolean NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    CONSTRAINT "PK_customer_rental_order_extensions" PRIMARY KEY (id),
    CONSTRAINT fk_customer_rental_order_extensions_order
        FOREIGN KEY (customer_rental_order_id) REFERENCES public.customer_rental_orders (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IX_customer_rental_order_extensions_customer_rental_order_id" 
    ON public.customer_rental_order_extensions (customer_rental_order_id);

CREATE TABLE IF NOT EXISTS public.customer_rental_order_buyouts (
    id uuid NOT NULL,
    customer_rental_order_id uuid NOT NULL,
    base_buyout_amount numeric NOT NULL,
    rent_deduction_amount numeric NOT NULL,
    service_fee_amount numeric NOT NULL,
    gst_amount numeric NOT NULL,
    total_amount numeric NOT NULL,
    status varchar(50) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    is_deleted boolean NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    CONSTRAINT "PK_customer_rental_order_buyouts" PRIMARY KEY (id),
    CONSTRAINT fk_customer_rental_order_buyouts_order
        FOREIGN KEY (customer_rental_order_id) REFERENCES public.customer_rental_orders (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "IX_customer_rental_order_buyouts_customer_rental_order_id" 
    ON public.customer_rental_order_buyouts (customer_rental_order_id);
