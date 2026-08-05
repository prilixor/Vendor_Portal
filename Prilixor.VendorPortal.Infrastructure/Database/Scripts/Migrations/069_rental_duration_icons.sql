-- ----------------------------------------------------
-- Rental duration icons (Good / Better / Best Value / Maximum Savings)
-- + billing_cycles on masters
-- + per-product icon snapshot columns on pricing plans
-- ----------------------------------------------------

\c common_portal_db

CREATE TABLE IF NOT EXISTS public.rental_duration_icons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(100) NOT NULL,
    value_tier varchar(32) NOT NULL DEFAULT 'good',
    image_url text NOT NULL,
    thumbnail_url text NULL,
    sort_order int NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL,
    CONSTRAINT chk_rental_duration_icons_tier
        CHECK (value_tier IN ('good', 'better', 'best_value', 'maximum_savings'))
);

CREATE INDEX IF NOT EXISTS ix_rental_duration_icons_active_sort
    ON public.rental_duration_icons(is_active, sort_order)
    WHERE is_deleted = false;

-- Seed default tier icons (files live under wwwroot/uploads/vendors/common/rental-icons/)
INSERT INTO public.rental_duration_icons (id, name, value_tier, image_url, thumbnail_url, sort_order, is_active)
SELECT v.id, v.name, v.value_tier, v.image_url, v.thumbnail_url, v.sort_order, v.is_active
FROM (VALUES
    ('019f9000-0001-7000-8000-000000000001'::uuid, 'Good', 'good',
     'uploads/vendors/common/rental-icons/good.png', NULL, 1, true),
    ('019f9000-0001-7000-8000-000000000002'::uuid, 'Better', 'better',
     'uploads/vendors/common/rental-icons/better.png', NULL, 2, true),
    ('019f9000-0001-7000-8000-000000000003'::uuid, 'Best Value', 'best_value',
     'uploads/vendors/common/rental-icons/best-value.png', NULL, 3, true),
    ('019f9000-0001-7000-8000-000000000004'::uuid, 'Maximum Savings', 'maximum_savings',
     'uploads/vendors/common/rental-icons/maximum-savings.png', NULL, 4, true)
) AS v(id, name, value_tier, image_url, thumbnail_url, sort_order, is_active)
WHERE NOT EXISTS (
    SELECT 1 FROM public.rental_duration_icons x
    WHERE x.is_deleted = false AND x.value_tier = v.value_tier
);

ALTER TABLE public.rental_duration_masters
    ADD COLUMN IF NOT EXISTS billing_cycles numeric(8,2) NOT NULL DEFAULT 0;

UPDATE public.rental_duration_masters
SET billing_cycles = ROUND((duration_days::numeric / 28.0), 2)
WHERE billing_cycles = 0 OR billing_cycles IS NULL;

-- Prefer billing-cycle naming for known seeded day lengths (only when still month/day labels)
UPDATE public.rental_duration_masters SET duration_label = '0.25 Billing Cycles', billing_cycles = 0.25
WHERE duration_days = 7 AND duration_label IN ('7 Days');
UPDATE public.rental_duration_masters SET duration_label = '0.5 Billing Cycles', billing_cycles = 0.50
WHERE duration_days = 14 AND duration_label IN ('14 Days');
UPDATE public.rental_duration_masters SET duration_label = '0.75 Billing Cycles', billing_cycles = 0.75
WHERE duration_days = 21 AND duration_label IN ('21 Days');
UPDATE public.rental_duration_masters SET duration_label = '1 Billing Cycle', billing_cycles = 1.00
WHERE duration_days = 28 AND duration_label IN ('1 Month');
UPDATE public.rental_duration_masters SET duration_label = '1.25 Billing Cycles', billing_cycles = 1.25
WHERE duration_days = 35 AND duration_label IN ('1.5 Months');
UPDATE public.rental_duration_masters SET duration_label = '2 Billing Cycles', billing_cycles = 2.00
WHERE duration_days = 60 AND duration_label IN ('2 Months');
UPDATE public.rental_duration_masters SET duration_label = '3 Billing Cycles', billing_cycles = 3.00
WHERE duration_days = 90 AND duration_label IN ('3 Months');
UPDATE public.rental_duration_masters SET duration_label = '4 Billing Cycles', billing_cycles = 4.00
WHERE duration_days = 120 AND duration_label IN ('4 Months');
UPDATE public.rental_duration_masters SET duration_label = '6 Billing Cycles', billing_cycles = 6.00
WHERE duration_days = 180 AND duration_label IN ('6 Months');

ALTER TABLE public.product_rental_pricing_plans
    ADD COLUMN IF NOT EXISTS billing_cycles numeric(8,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS rental_duration_icon_id uuid NULL
        REFERENCES public.rental_duration_icons(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS icon_url text NULL,
    ADD COLUMN IF NOT EXISTS icon_thumbnail_url text NULL,
    ADD COLUMN IF NOT EXISTS value_tier varchar(32) NULL,
    ADD COLUMN IF NOT EXISTS icon_name varchar(100) NULL;

UPDATE public.product_rental_pricing_plans p
SET billing_cycles = COALESCE(
    (SELECT m.billing_cycles FROM public.rental_duration_masters m WHERE m.id = p.rental_duration_master_id),
    ROUND((p.duration_days::numeric / 28.0), 2)
)
WHERE p.billing_cycles = 0;


\c vendor_portal_db

CREATE TABLE IF NOT EXISTS public.rental_duration_icons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(100) NOT NULL,
    value_tier varchar(32) NOT NULL DEFAULT 'good',
    image_url text NOT NULL,
    thumbnail_url text NULL,
    sort_order int NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL,
    CONSTRAINT chk_rental_duration_icons_tier
        CHECK (value_tier IN ('good', 'better', 'best_value', 'maximum_savings'))
);

CREATE INDEX IF NOT EXISTS ix_rental_duration_icons_active_sort
    ON public.rental_duration_icons(is_active, sort_order)
    WHERE is_deleted = false;

-- Seed default tier icons (files live under wwwroot/uploads/vendors/common/rental-icons/)
INSERT INTO public.rental_duration_icons (id, name, value_tier, image_url, thumbnail_url, sort_order, is_active)
SELECT v.id, v.name, v.value_tier, v.image_url, v.thumbnail_url, v.sort_order, v.is_active
FROM (VALUES
    ('019f9000-0001-7000-8000-000000000001'::uuid, 'Good', 'good',
     'uploads/vendors/common/rental-icons/good.png', NULL, 1, true),
    ('019f9000-0001-7000-8000-000000000002'::uuid, 'Better', 'better',
     'uploads/vendors/common/rental-icons/better.png', NULL, 2, true),
    ('019f9000-0001-7000-8000-000000000003'::uuid, 'Best Value', 'best_value',
     'uploads/vendors/common/rental-icons/best-value.png', NULL, 3, true),
    ('019f9000-0001-7000-8000-000000000004'::uuid, 'Maximum Savings', 'maximum_savings',
     'uploads/vendors/common/rental-icons/maximum-savings.png', NULL, 4, true)
) AS v(id, name, value_tier, image_url, thumbnail_url, sort_order, is_active)
WHERE NOT EXISTS (
    SELECT 1 FROM public.rental_duration_icons x
    WHERE x.is_deleted = false AND x.value_tier = v.value_tier
);

ALTER TABLE public.rental_duration_masters
    ADD COLUMN IF NOT EXISTS billing_cycles numeric(8,2) NOT NULL DEFAULT 0;

UPDATE public.rental_duration_masters
SET billing_cycles = ROUND((duration_days::numeric / 28.0), 2)
WHERE billing_cycles = 0 OR billing_cycles IS NULL;

UPDATE public.rental_duration_masters SET duration_label = '0.25 Billing Cycles', billing_cycles = 0.25
WHERE duration_days = 7 AND duration_label IN ('7 Days');
UPDATE public.rental_duration_masters SET duration_label = '0.5 Billing Cycles', billing_cycles = 0.50
WHERE duration_days = 14 AND duration_label IN ('14 Days');
UPDATE public.rental_duration_masters SET duration_label = '0.75 Billing Cycles', billing_cycles = 0.75
WHERE duration_days = 21 AND duration_label IN ('21 Days');
UPDATE public.rental_duration_masters SET duration_label = '1 Billing Cycle', billing_cycles = 1.00
WHERE duration_days = 28 AND duration_label IN ('1 Month');
UPDATE public.rental_duration_masters SET duration_label = '1.25 Billing Cycles', billing_cycles = 1.25
WHERE duration_days = 35 AND duration_label IN ('1.5 Months');
UPDATE public.rental_duration_masters SET duration_label = '2 Billing Cycles', billing_cycles = 2.00
WHERE duration_days = 60 AND duration_label IN ('2 Months');
UPDATE public.rental_duration_masters SET duration_label = '3 Billing Cycles', billing_cycles = 3.00
WHERE duration_days = 90 AND duration_label IN ('3 Months');
UPDATE public.rental_duration_masters SET duration_label = '4 Billing Cycles', billing_cycles = 4.00
WHERE duration_days = 120 AND duration_label IN ('4 Months');
UPDATE public.rental_duration_masters SET duration_label = '6 Billing Cycles', billing_cycles = 6.00
WHERE duration_days = 180 AND duration_label IN ('6 Months');

ALTER TABLE public.product_rental_pricing_plans
    ADD COLUMN IF NOT EXISTS billing_cycles numeric(8,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS rental_duration_icon_id uuid NULL,
    ADD COLUMN IF NOT EXISTS icon_url text NULL,
    ADD COLUMN IF NOT EXISTS icon_thumbnail_url text NULL,
    ADD COLUMN IF NOT EXISTS value_tier varchar(32) NULL,
    ADD COLUMN IF NOT EXISTS icon_name varchar(100) NULL;

UPDATE public.product_rental_pricing_plans p
SET billing_cycles = COALESCE(
    (SELECT m.billing_cycles FROM public.rental_duration_masters m WHERE m.id = p.rental_duration_master_id),
    ROUND((p.duration_days::numeric / 28.0), 2)
)
WHERE p.billing_cycles = 0;
