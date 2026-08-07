-- Migration: Allow draft-until-paid status on customer rental orders.
-- Run on: customer_portal_db

\c customer_portal_db

ALTER TABLE public.customer_rental_orders
    DROP CONSTRAINT IF EXISTS chk_customer_rental_orders_status;

ALTER TABLE public.customer_rental_orders
    ADD CONSTRAINT chk_customer_rental_orders_status
    CHECK (status IN (
        'pending',
        'awaiting_payment',
        'awaiting_vendor_acceptance',
        'confirmed',
        'in_transit',
        'active',
        'returned',
        'bought_out',
        'cancelled',
        'dispatch_failed'
    ));
