-- ----------------------------------------------------
-- Global rental duration master (label + days)
-- Used by Admin Product Pricing with per-product daily rate + discount
-- ----------------------------------------------------

\c common_portal_db

CREATE TABLE IF NOT EXISTS public.rental_duration_masters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    duration_label varchar(100) NOT NULL,
    duration_days int NOT NULL,
    sort_order int NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL,
    CONSTRAINT chk_rental_duration_masters_days CHECK (duration_days > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_rental_duration_masters_days_active
    ON public.rental_duration_masters(duration_days)
    WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_rental_duration_masters_active_sort
    ON public.rental_duration_masters(is_active, sort_order)
    WHERE is_deleted = false;

ALTER TABLE public.product_rental_pricing_plans
    ADD COLUMN IF NOT EXISTS rental_duration_master_id uuid NULL
        REFERENCES public.rental_duration_masters(id) ON DELETE SET NULL;

-- Seed common durations (skip if any rows already exist)
INSERT INTO public.rental_duration_masters (id, duration_label, duration_days, sort_order, is_active)
SELECT * FROM (VALUES
    (gen_random_uuid(), '7 Days', 7, 1, true),
    (gen_random_uuid(), '14 Days', 14, 2, true),
    (gen_random_uuid(), '21 Days', 21, 3, true),
    (gen_random_uuid(), '1 Month', 28, 4, true),
    (gen_random_uuid(), '1.5 Months', 35, 5, true),
    (gen_random_uuid(), '2 Months', 60, 6, true),
    (gen_random_uuid(), '3 Months', 90, 7, true),
    (gen_random_uuid(), '4 Months', 120, 8, true),
    (gen_random_uuid(), '6 Months', 180, 9, true)
) AS v(id, duration_label, duration_days, sort_order, is_active)
WHERE NOT EXISTS (SELECT 1 FROM public.rental_duration_masters WHERE is_deleted = false);


\c vendor_portal_db

CREATE TABLE IF NOT EXISTS public.rental_duration_masters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    duration_label varchar(100) NOT NULL,
    duration_days int NOT NULL,
    sort_order int NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL,
    CONSTRAINT chk_rental_duration_masters_days CHECK (duration_days > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_rental_duration_masters_days_active
    ON public.rental_duration_masters(duration_days)
    WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_rental_duration_masters_active_sort
    ON public.rental_duration_masters(is_active, sort_order)
    WHERE is_deleted = false;

ALTER TABLE public.product_rental_pricing_plans
    ADD COLUMN IF NOT EXISTS rental_duration_master_id uuid NULL;

INSERT INTO public.rental_duration_masters (id, duration_label, duration_days, sort_order, is_active)
SELECT * FROM (VALUES
    (gen_random_uuid(), '7 Days', 7, 1, true),
    (gen_random_uuid(), '14 Days', 14, 2, true),
    (gen_random_uuid(), '21 Days', 21, 3, true),
    (gen_random_uuid(), '1 Month', 28, 4, true),
    (gen_random_uuid(), '1.5 Months', 35, 5, true),
    (gen_random_uuid(), '2 Months', 60, 6, true),
    (gen_random_uuid(), '3 Months', 90, 7, true),
    (gen_random_uuid(), '4 Months', 120, 8, true),
    (gen_random_uuid(), '6 Months', 180, 9, true)
) AS v(id, duration_label, duration_days, sort_order, is_active)
WHERE NOT EXISTS (SELECT 1 FROM public.rental_duration_masters WHERE is_deleted = false);
