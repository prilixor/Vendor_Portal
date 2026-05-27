-- Adds admin product image master table for common and vendor portal DBs.
-- Run on: common_portal_db_new (mandatory)
-- Run on: vendor_portal_db_new (optional but recommended for mirrored product schema parity)

CREATE TABLE IF NOT EXISTS public.product_images (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL,
    image_url text NOT NULL,
    display_order integer NOT NULL DEFAULT 1,
    is_primary boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'products'
    ) THEN
        BEGIN
            ALTER TABLE public.product_images
                ADD CONSTRAINT fk_product_images_product
                FOREIGN KEY (product_id) REFERENCES public.products(id);
        EXCEPTION WHEN duplicate_object THEN
            NULL;
        END;
    END IF;
END $$;

DO $$
BEGIN
    BEGIN
        ALTER TABLE public.product_images
            ADD CONSTRAINT chk_product_images_display_order CHECK (display_order > 0);
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
END $$;

CREATE INDEX IF NOT EXISTS ix_product_images_product_id
    ON public.product_images(product_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_product_images_primary_per_product
    ON public.product_images(product_id)
    WHERE is_primary = true AND is_deleted = false;
