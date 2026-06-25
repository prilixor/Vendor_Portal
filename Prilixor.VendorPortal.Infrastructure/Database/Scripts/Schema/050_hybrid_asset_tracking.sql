-- Migration: Add hybrid asset tracking tables
-- Run on: vendor_portal_db_new

CREATE TABLE IF NOT EXISTS public.vendor_product_assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_product_listing_id uuid NOT NULL,
    asset_tag varchar(100) NOT NULL,
    status varchar(50) NOT NULL,
    condition varchar(200) NULL,
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL,
    
    CONSTRAINT fk_vendor_product_assets_listing
        FOREIGN KEY (vendor_product_listing_id) REFERENCES public.vendor_product_listings(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_vendor_product_assets_listing_tag 
    ON public.vendor_product_assets(vendor_product_listing_id, asset_tag);
    
CREATE INDEX IF NOT EXISTS ix_vendor_product_assets_listing 
    ON public.vendor_product_assets(vendor_product_listing_id);

-- Run on: customer_portal_db_new

CREATE TABLE IF NOT EXISTS public.customer_rental_order_assets (
    customer_rental_order_id uuid NOT NULL,
    vendor_product_asset_id uuid NOT NULL,
    
    PRIMARY KEY (customer_rental_order_id, vendor_product_asset_id),
    
    CONSTRAINT fk_customer_rental_order_assets_order
        FOREIGN KEY (customer_rental_order_id) REFERENCES public.customer_rental_orders(id)
);
