-- ============================================================
-- 057: Add vendor_variant_inventory table
-- Tracks per-SKU (variant-level) stock for chemical listings.
-- Each row = one vendor listing + one product variant (size).
-- ============================================================

\c vendor_portal_db

CREATE TABLE IF NOT EXISTS public.vendor_variant_inventory (
    id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_product_listing_id   uuid        NOT NULL REFERENCES public.vendor_product_listings(id) ON DELETE CASCADE,
    product_variant_id          uuid        NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
    total_quantity              int         NOT NULL DEFAULT 0,
    available_quantity          int         NOT NULL DEFAULT 0,
    reserved_quantity           int         NOT NULL DEFAULT 0,
    created_at                  timestamptz NOT NULL DEFAULT now(),
    updated_at                  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_vendor_variant_inventory_listing_variant
        UNIQUE (vendor_product_listing_id, product_variant_id),
    CONSTRAINT chk_vendor_variant_inventory_quantities
        CHECK (total_quantity >= 0 AND available_quantity >= 0 AND reserved_quantity >= 0)
);

CREATE INDEX IF NOT EXISTS ix_vendor_variant_inventory_listing_id
    ON public.vendor_variant_inventory(vendor_product_listing_id);

CREATE INDEX IF NOT EXISTS ix_vendor_variant_inventory_variant_id
    ON public.vendor_variant_inventory(product_variant_id);
