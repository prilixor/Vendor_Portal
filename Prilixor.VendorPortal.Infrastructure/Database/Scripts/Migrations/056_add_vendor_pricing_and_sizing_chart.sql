-- ----------------------------------------------------
-- 1. Apply changes to common_portal_db
-- ----------------------------------------------------
\c common_portal_db

ALTER TABLE public.products 
    ADD COLUMN IF NOT EXISTS vendor_daily_rent numeric(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS vendor_monthly_rent numeric(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS vendor_security_deposit numeric(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS vendor_buy_price numeric(12, 2) NULL;

CREATE TABLE IF NOT EXISTS public.product_variants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    sku varchar(100) NOT NULL UNIQUE,
    size_value numeric(12, 4) NOT NULL,
    size_unit varchar(20) NOT NULL,
    vendor_price numeric(12, 2) NOT NULL,
    buy_price numeric(12, 2) NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_product_variants_prices CHECK (vendor_price >= 0 AND buy_price >= 0)
);

CREATE INDEX IF NOT EXISTS ix_product_variants_product_id ON public.product_variants(product_id);


-- ----------------------------------------------------
-- 2. Apply changes to vendor_portal_db
-- ----------------------------------------------------
\c vendor_portal_db

ALTER TABLE public.products 
    ADD COLUMN IF NOT EXISTS vendor_daily_rent numeric(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS vendor_monthly_rent numeric(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS vendor_security_deposit numeric(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS vendor_buy_price numeric(12, 2) NULL;

CREATE TABLE IF NOT EXISTS public.product_variants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    sku varchar(100) NOT NULL UNIQUE,
    size_value numeric(12, 4) NOT NULL,
    size_unit varchar(20) NOT NULL,
    vendor_price numeric(12, 2) NOT NULL,
    buy_price numeric(12, 2) NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_product_variants_prices CHECK (vendor_price >= 0 AND buy_price >= 0)
);

CREATE INDEX IF NOT EXISTS ix_product_variants_product_id ON public.product_variants(product_id);

ALTER TABLE public.vendor_product_listings 
    ADD COLUMN IF NOT EXISTS product_variant_id uuid NULL;

ALTER TABLE public.vendor_product_listings
    ADD CONSTRAINT fk_vendor_product_listings_variant
        FOREIGN KEY (product_variant_id) REFERENCES public.product_variants(id) ON DELETE SET NULL;


-- ----------------------------------------------------
-- 3. Apply changes to customer_portal_db
-- ----------------------------------------------------
\c customer_portal_db

ALTER TABLE public.customer_rental_orders 
    ADD COLUMN IF NOT EXISTS product_variant_id uuid NULL,
    ADD COLUMN IF NOT EXISTS vendor_subtotal_amount numeric(12, 2) NOT NULL DEFAULT 0;
