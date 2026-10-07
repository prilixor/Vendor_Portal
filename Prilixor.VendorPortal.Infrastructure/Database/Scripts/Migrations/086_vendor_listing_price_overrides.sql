-- Optional per-vendor product prices, plus the admin permission that gates setting them.
-- Catalog product prices stay the default until an admin turns custom pricing on for a listing.

\c vendor_portal_db

CREATE TABLE IF NOT EXISTS public.vendor_listing_price_overrides (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_product_listing_id uuid NOT NULL,
    is_custom_pricing boolean NOT NULL DEFAULT false,
    daily_rent numeric(12, 2) NULL,
    security_deposit numeric(12, 2) NULL,
    buy_price numeric(12, 2) NULL,
    vendor_daily_rent numeric(12, 2) NULL,
    vendor_buy_price numeric(12, 2) NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NULL,
    created_by uuid NULL,
    updated_by uuid NULL,
    CONSTRAINT fk_vendor_listing_price_overrides_listing
        FOREIGN KEY (vendor_product_listing_id) REFERENCES public.vendor_product_listings(id) ON DELETE CASCADE,
    CONSTRAINT uq_vendor_listing_price_overrides_listing
        UNIQUE (vendor_product_listing_id),
    CONSTRAINT chk_vendor_listing_price_overrides_amounts
        CHECK (
            (daily_rent IS NULL OR daily_rent >= 0)
            AND (security_deposit IS NULL OR security_deposit >= 0)
            AND (buy_price IS NULL OR buy_price >= 0)
            AND (vendor_daily_rent IS NULL OR vendor_daily_rent >= 0)
            AND (vendor_buy_price IS NULL OR vendor_buy_price >= 0)
        )
);

CREATE TABLE IF NOT EXISTS public.vendor_listing_variant_price_overrides (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_listing_price_override_id uuid NOT NULL,
    product_variant_id uuid NOT NULL,
    buy_price numeric(12, 2) NOT NULL,
    vendor_price numeric(12, 2) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NULL,
    created_by uuid NULL,
    updated_by uuid NULL,
    CONSTRAINT fk_vendor_listing_variant_prices_override
        FOREIGN KEY (vendor_listing_price_override_id) REFERENCES public.vendor_listing_price_overrides(id) ON DELETE CASCADE,
    CONSTRAINT uq_vendor_listing_variant_prices_variant
        UNIQUE (vendor_listing_price_override_id, product_variant_id),
    CONSTRAINT chk_vendor_listing_variant_prices_amounts
        CHECK (buy_price >= 0 AND vendor_price >= 0)
);

CREATE INDEX IF NOT EXISTS ix_vendor_listing_variant_prices_override
    ON public.vendor_listing_variant_price_overrides(vendor_listing_price_override_id);

\c admin_portal_db

INSERT INTO public.admin_permissions (id, code, name, description, category)
VALUES (
    'b1000000-0000-4000-8000-000000000011',
    'vendors.product_price',
    'Set Vendor Product Price',
    'Set a custom sell and payout price for one vendor listing',
    'Vendors'
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT 'a1000000-0000-4000-8000-000000000001', p.id
FROM public.admin_permissions p
WHERE p.code = 'vendors.product_price'
ON CONFLICT DO NOTHING;
