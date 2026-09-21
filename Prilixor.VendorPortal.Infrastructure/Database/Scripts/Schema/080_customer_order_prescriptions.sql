-- Schema: customer-uploaded prescription files (image/PDF).
-- Run on: customer_portal_db

\c customer_portal_db

CREATE TABLE IF NOT EXISTS public.customer_order_prescription_files (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_rental_order_id uuid NOT NULL REFERENCES public.customer_rental_orders(id),
    customer_id uuid NOT NULL,
    vendor_id uuid NOT NULL,
    stored_reference text NOT NULL,
    original_file_name varchar(255) NULL,
    content_type varchar(100) NULL,
    sort_order int NOT NULL DEFAULT 0,
    upload_source varchar(20) NOT NULL DEFAULT 'checkout',

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL
);

CREATE INDEX IF NOT EXISTS ix_customer_order_prescription_files_order_id
    ON public.customer_order_prescription_files(customer_rental_order_id)
    WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_customer_order_prescription_files_customer_id
    ON public.customer_order_prescription_files(customer_id)
    WHERE is_deleted = false;
