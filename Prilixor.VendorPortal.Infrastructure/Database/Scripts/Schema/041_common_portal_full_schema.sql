-- Fresh full schema for common_portal_db
-- Run on: common_portal_db

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.product_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category_name varchar(150) NOT NULL UNIQUE,
    prescription_required boolean NOT NULL DEFAULT false,
    deposit_required boolean NOT NULL DEFAULT false,
    installation_required boolean NOT NULL DEFAULT false,
    is_chemical boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL
);

CREATE INDEX IF NOT EXISTS ix_product_categories_is_active
    ON public.product_categories(is_active);

CREATE TABLE IF NOT EXISTS public.products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id uuid NOT NULL,
    product_name varchar(255) NOT NULL,
    brand_name varchar(255) NULL,
    model_name varchar(255) NULL,
    short_description varchar(500) NULL,
    long_description text NULL,
    daily_rent numeric(12, 2) NOT NULL DEFAULT 0,
    monthly_rent numeric(12, 2) NOT NULL DEFAULT 0,
    security_deposit numeric(12, 2) NOT NULL DEFAULT 0,
    buy_price numeric(12, 2) NULL,
    gst_percent numeric(5, 2) NOT NULL DEFAULT 18,
    is_rent_enabled boolean NOT NULL DEFAULT true,
    is_buy_enabled boolean NOT NULL DEFAULT true,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL,
    CONSTRAINT fk_products_category
        FOREIGN KEY (category_id) REFERENCES public.product_categories(id),
    CONSTRAINT chk_products_amounts
        CHECK (daily_rent >= 0 AND monthly_rent >= 0 AND security_deposit >= 0 AND (buy_price IS NULL OR buy_price >= 0)),
    CONSTRAINT chk_products_gst_percent
        CHECK (gst_percent >= 0 AND gst_percent <= 100)
);

CREATE INDEX IF NOT EXISTS ix_products_category_id
    ON public.products(category_id);

CREATE INDEX IF NOT EXISTS ix_products_is_active
    ON public.products(is_active);

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
    deleted_by uuid NULL,
    CONSTRAINT fk_product_images_product
        FOREIGN KEY (product_id) REFERENCES public.products(id),
    CONSTRAINT chk_product_images_display_order CHECK (display_order > 0)
);

CREATE INDEX IF NOT EXISTS ix_product_images_product_id
    ON public.product_images(product_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_product_images_primary_per_product
    ON public.product_images(product_id)
    WHERE is_primary = true AND is_deleted = false;
