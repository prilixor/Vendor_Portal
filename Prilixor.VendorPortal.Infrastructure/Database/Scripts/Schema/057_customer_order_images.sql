-- Migration: Order photo storage (max 5 per request).
-- Run on: customer_portal_db
-- Note: Originally customer-upload; 058 adds request → vendor-upload flow.
-- Keep this table; 058 adds request_id and customer_order_image_requests.

\c customer_portal_db

CREATE TABLE IF NOT EXISTS public.customer_order_images (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_rental_order_id uuid NOT NULL REFERENCES public.customer_rental_orders(id),
    vendor_id uuid NOT NULL,
    stored_reference text NOT NULL,
    original_file_name varchar(255) NULL,
    content_type varchar(100) NULL,
    sort_order int NOT NULL DEFAULT 0,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL
);

CREATE INDEX IF NOT EXISTS ix_customer_order_images_order_id
    ON public.customer_order_images(customer_rental_order_id)
    WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_customer_order_images_vendor_id
    ON public.customer_order_images(vendor_id)
    WHERE is_deleted = false;

COMMENT ON TABLE public.customer_order_images IS
    'Order photos (vendor-uploaded after 058). Soft-deleted and removed from S3 when request is closed (delivered, cancelled, or dispatch_failed).';
