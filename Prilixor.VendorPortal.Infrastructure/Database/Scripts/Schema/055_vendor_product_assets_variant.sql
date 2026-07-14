\c vendor_portal_db

-- Link chemical serials / batch tags to a packaging size (product variant).
ALTER TABLE public.vendor_product_assets
    ADD COLUMN IF NOT EXISTS product_variant_id uuid NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'vendor_product_assets'
          AND constraint_name = 'fk_vendor_product_assets_variant'
    ) THEN
        ALTER TABLE public.vendor_product_assets
            ADD CONSTRAINT fk_vendor_product_assets_variant
            FOREIGN KEY (product_variant_id) REFERENCES public.product_variants(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_vendor_product_assets_product_variant_id
    ON public.vendor_product_assets(product_variant_id);
