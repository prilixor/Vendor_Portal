-- ----------------------------------------------------
-- 083: Order image option gallery + customer selection
-- Each option can hold multiple photos (appsettings OrderImageRequest:ImagesPerOption, default 3).
-- Customer picks one option; vendor sees selected_option_id.
-- Run on: customer_portal_db
-- pgAdmin Query Tool ignores \c — open this script on customer_portal_db.
-- ----------------------------------------------------

SELECT current_database() AS connected_database;

DO $$
BEGIN
    IF to_regclass('public.customer_order_image_requests') IS NULL THEN
        RAISE EXCEPTION
            '083 must run on customer_portal_db. This session is connected to "%" which has no customer_order_image_requests.',
            current_database();
    END IF;
END $$;

ALTER TABLE public.customer_order_image_requests
    ADD COLUMN IF NOT EXISTS selected_option_id uuid NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_customer_order_image_requests_selected_option'
    ) THEN
        ALTER TABLE public.customer_order_image_requests
            ADD CONSTRAINT fk_customer_order_image_requests_selected_option
            FOREIGN KEY (selected_option_id) REFERENCES public.customer_order_image_request_options(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_customer_order_image_requests_selected_option
    ON public.customer_order_image_requests(selected_option_id)
    WHERE is_deleted = false AND selected_option_id IS NOT NULL;

COMMENT ON COLUMN public.customer_order_image_requests.selected_option_id IS
    'The single option the customer chose from Option 1 / 2 / 3.';
