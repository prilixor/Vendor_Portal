\c common_portal_db

ALTER TABLE public.product_categories
ADD COLUMN IF NOT EXISTS is_chemical boolean NOT NULL DEFAULT false;
