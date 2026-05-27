-- Add pricing snapshot columns to customer rental orders (distance/express/GST)
-- Run on: customer_portal_db (or whichever DB hosts customer_rental_orders)

ALTER TABLE IF EXISTS public.customer_rental_orders
    ADD COLUMN IF NOT EXISTS distance_fee_amount numeric(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS express_fee_amount numeric(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS gst_amount numeric(12,2) NOT NULL DEFAULT 0;
