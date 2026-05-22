-- Fresh full schema for common_portal_db
-- Run on: common_portal_db

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.product_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category_name varchar(150) NOT NULL UNIQUE,
    prescription_required boolean NOT NULL DEFAULT false,
    deposit_required boolean NOT NULL DEFAULT false,
    installation_required boolean NOT NULL DEFAULT false,
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
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL,
    CONSTRAINT fk_products_category
        FOREIGN KEY (category_id) REFERENCES public.product_categories(id)
);

CREATE INDEX IF NOT EXISTS ix_products_category_id
    ON public.products(category_id);

CREATE INDEX IF NOT EXISTS ix_products_is_active
    ON public.products(is_active);
