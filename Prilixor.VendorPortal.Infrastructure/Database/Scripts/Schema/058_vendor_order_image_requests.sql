-- Migration: Customer requests vendor photos for an order (vendor uploads max 5).
-- Run on: customer_portal_db
-- Replaces customer-upload flow from 057 with request → vendor-upload.

\c customer_portal_db

CREATE TABLE IF NOT EXISTS public.customer_order_image_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_rental_order_id uuid NOT NULL REFERENCES public.customer_rental_orders(id),
    customer_id uuid NOT NULL,
    vendor_id uuid NOT NULL,
    status varchar(30) NOT NULL DEFAULT 'open',
    message text NOT NULL DEFAULT 'Customer requested photos for this product. Please upload up to 5 photos so we can proceed.',
    requested_at timestamptz NOT NULL DEFAULT now(),
    closed_at timestamptz NULL,
    closed_reason varchar(50) NULL,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_customer_order_image_requests_open_order
    ON public.customer_order_image_requests(customer_rental_order_id)
    WHERE is_deleted = false AND status = 'open';

CREATE INDEX IF NOT EXISTS ix_customer_order_image_requests_vendor_open
    ON public.customer_order_image_requests(vendor_id)
    WHERE is_deleted = false AND status = 'open';

ALTER TABLE public.customer_order_images
    ADD COLUMN IF NOT EXISTS request_id uuid NULL;

-- Legacy rows from customer-upload (no request_id) stay in the table but are hidden by the
-- new APIs (only open requests are returned). Optional cleanup of orphans:
-- UPDATE public.customer_order_images SET is_deleted = true, deleted_at = now()
-- WHERE request_id IS NULL AND is_deleted = false;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_customer_order_images_request'
    ) THEN
        ALTER TABLE public.customer_order_images
            ADD CONSTRAINT fk_customer_order_images_request
            FOREIGN KEY (request_id) REFERENCES public.customer_order_image_requests(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_customer_order_images_request_id
    ON public.customer_order_images(request_id)
    WHERE is_deleted = false;

COMMENT ON TABLE public.customer_order_image_requests IS
    'Customer system request for vendor photos. Closed+hidden when order delivered, cancelled, or dispatch_failed.';
COMMENT ON TABLE public.customer_order_images IS
    'Vendor-uploaded photos for an order image request. Soft-deleted and removed from S3 when request is closed.';
