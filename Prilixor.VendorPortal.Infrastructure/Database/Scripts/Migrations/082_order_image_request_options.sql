-- ----------------------------------------------------
-- 082: Order image request options
-- Customer asks for photos; vendor uploads under Option 1 / 2 / 3
-- (count is configured in appsettings OrderImageRequest:OptionCount).
-- Optional description per option (max 500 characters by default).
-- Run on: customer_portal_db
-- pgAdmin Query Tool ignores \c — open this script on customer_portal_db, not customer_portal_db_new.
-- psql: \c customer_portal_db
-- ----------------------------------------------------

SELECT current_database() AS connected_database;

DO $$
BEGIN
    IF to_regclass('public.customer_order_image_requests') IS NULL THEN
        RAISE EXCEPTION
            '082 must run on customer_portal_db. This session is connected to "%" which has no customer_order_image_requests. In pgAdmin, close this query window, right-click customer_portal_db → Query Tool, then run 082 again. If this database is a fresh copy, run Schema/058_vendor_order_image_requests.sql first.',
            current_database();
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.customer_order_image_request_options (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id uuid NOT NULL REFERENCES public.customer_order_image_requests(id),
    option_number int NOT NULL,
    description varchar(2000) NULL,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_customer_order_image_request_options_number
    ON public.customer_order_image_request_options(request_id, option_number)
    WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_customer_order_image_request_options_request
    ON public.customer_order_image_request_options(request_id)
    WHERE is_deleted = false;

ALTER TABLE public.customer_order_images
    ADD COLUMN IF NOT EXISTS option_id uuid NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_customer_order_images_option'
    ) THEN
        ALTER TABLE public.customer_order_images
            ADD CONSTRAINT fk_customer_order_images_option
            FOREIGN KEY (option_id) REFERENCES public.customer_order_image_request_options(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_customer_order_images_option_id
    ON public.customer_order_images(option_id)
    WHERE is_deleted = false;

COMMENT ON TABLE public.customer_order_image_request_options IS
    'Labeled photo slots (Option 1, Option 2, …) on a customer order image request.';
