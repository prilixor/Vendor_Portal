-- ----------------------------------------------------
-- Day-based rental duration pricing plans (per product)
-- + order snapshot columns for selected plan
-- ----------------------------------------------------

-- ----------------------------------------------------
-- 1. common_portal_db
-- ----------------------------------------------------
\c common_portal_db

CREATE TABLE IF NOT EXISTS public.product_rental_pricing_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    duration_label varchar(100) NOT NULL,
    duration_days int NOT NULL,
    normal_price numeric(12, 2) NOT NULL DEFAULT 0,
    discount_type varchar(20) NOT NULL DEFAULT 'none',
    discount_value numeric(12, 2) NOT NULL DEFAULT 0,
    final_rental_price numeric(12, 2) NOT NULL DEFAULT 0,
    is_recommended boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    sort_order int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_rental_plans_duration_days CHECK (duration_days > 0),
    CONSTRAINT chk_rental_plans_prices CHECK (
        normal_price >= 0
        AND discount_value >= 0
        AND final_rental_price >= 0
    ),
    CONSTRAINT chk_rental_plans_discount_type CHECK (
        discount_type IN ('none', 'fixed', 'percentage')
    )
);

CREATE INDEX IF NOT EXISTS ix_product_rental_pricing_plans_product_id
    ON public.product_rental_pricing_plans(product_id);

CREATE INDEX IF NOT EXISTS ix_product_rental_pricing_plans_product_active_sort
    ON public.product_rental_pricing_plans(product_id, is_active, sort_order);


-- ----------------------------------------------------
-- 2. vendor_portal_db (legacy dual-write catalog copy)
-- ----------------------------------------------------
\c vendor_portal_db

CREATE TABLE IF NOT EXISTS public.product_rental_pricing_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    duration_label varchar(100) NOT NULL,
    duration_days int NOT NULL,
    normal_price numeric(12, 2) NOT NULL DEFAULT 0,
    discount_type varchar(20) NOT NULL DEFAULT 'none',
    discount_value numeric(12, 2) NOT NULL DEFAULT 0,
    final_rental_price numeric(12, 2) NOT NULL DEFAULT 0,
    is_recommended boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    sort_order int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_rental_plans_duration_days CHECK (duration_days > 0),
    CONSTRAINT chk_rental_plans_prices CHECK (
        normal_price >= 0
        AND discount_value >= 0
        AND final_rental_price >= 0
    ),
    CONSTRAINT chk_rental_plans_discount_type CHECK (
        discount_type IN ('none', 'fixed', 'percentage')
    )
);

CREATE INDEX IF NOT EXISTS ix_product_rental_pricing_plans_product_id
    ON public.product_rental_pricing_plans(product_id);

CREATE INDEX IF NOT EXISTS ix_product_rental_pricing_plans_product_active_sort
    ON public.product_rental_pricing_plans(product_id, is_active, sort_order);


-- ----------------------------------------------------
-- 3. customer_portal_db — snapshot on orders
-- ----------------------------------------------------
\c customer_portal_db

ALTER TABLE public.customer_rental_orders
    ADD COLUMN IF NOT EXISTS rental_pricing_plan_id uuid NULL,
    ADD COLUMN IF NOT EXISTS rental_duration_label varchar(100) NULL,
    ADD COLUMN IF NOT EXISTS rental_duration_days int NULL,
    ADD COLUMN IF NOT EXISTS rental_normal_price numeric(12, 2) NULL,
    ADD COLUMN IF NOT EXISTS rental_discount_type varchar(20) NULL,
    ADD COLUMN IF NOT EXISTS rental_discount_value numeric(12, 2) NULL,
    ADD COLUMN IF NOT EXISTS rental_final_price numeric(12, 2) NULL;
