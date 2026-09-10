-- ----------------------------------------------------
-- Migration: 075_website_home_hero_slides.sql
-- Target Database: common_portal_db
-- Description: Admin-named homepage hero slideshow (max 5 images with labels)
-- Execution: psql -d common_portal_db -f 075_website_home_hero_slides.sql
-- ----------------------------------------------------

\c common_portal_db

CREATE TABLE IF NOT EXISTS public.website_home_hero_slides (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    home_content_id uuid NOT NULL REFERENCES public.website_home_content(id) ON DELETE CASCADE,
    label varchar(80) NOT NULL,
    image_url text NOT NULL,
    sort_order int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    is_deleted boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS ix_website_home_hero_slides_sort
    ON public.website_home_hero_slides(home_content_id, sort_order)
    WHERE is_deleted = false;
