-- Fresh full schema for customer_portal_db
-- Run on: customer_portal_db

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email varchar(255) NOT NULL UNIQUE,
    password_hash text NOT NULL,
    full_name varchar(200) NOT NULL DEFAULT '',
    phone varchar(30) NULL,
    email_verified boolean NOT NULL DEFAULT TRUE,
    last_login_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL
);

CREATE INDEX IF NOT EXISTS ix_customers_email ON public.customers(email);
CREATE INDEX IF NOT EXISTS ix_customers_created_at ON public.customers(created_at);

CREATE TABLE IF NOT EXISTS public.customer_addresses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid NOT NULL REFERENCES public.customers(id),
    label varchar(100) NULL,
    line_1 varchar(500) NOT NULL,
    city varchar(120) NOT NULL,
    state varchar(120) NOT NULL,
    postal varchar(30) NOT NULL,
    latitude numeric(9,6) NULL,
    longitude numeric(9,6) NULL,
    is_default boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL,
    created_by uuid NULL,
    updated_by uuid NULL
);

CREATE INDEX IF NOT EXISTS ix_customer_addresses_customer_id
    ON public.customer_addresses(customer_id);

CREATE TABLE IF NOT EXISTS public.customer_rental_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number varchar(40) NOT NULL UNIQUE,
    customer_id uuid NOT NULL REFERENCES public.customers(id),
    vendor_product_listing_id uuid NOT NULL,
    customer_address_id uuid NULL REFERENCES public.customer_addresses(id),
    quantity int NOT NULL DEFAULT 1 CHECK (quantity > 0),
    rental_days int NOT NULL CHECK (rental_days >= 0),
    order_type varchar(20) NOT NULL DEFAULT 'rent',
    delivery_option varchar(40) NOT NULL DEFAULT 'standard',
    status varchar(40) NOT NULL DEFAULT 'pending',
    subtotal_amount decimal(12, 2) NOT NULL,
    deposit_amount decimal(12, 2) NOT NULL DEFAULT 0,
    service_fee_amount decimal(12, 2) NOT NULL DEFAULT 0,
    distance_fee_amount decimal(12, 2) NOT NULL DEFAULT 0,
    express_fee_amount decimal(12, 2) NOT NULL DEFAULT 0,
    gst_amount decimal(12, 2) NOT NULL DEFAULT 0,
    total_amount decimal(12, 2) NOT NULL,
    start_date date NULL,
    end_date date NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL,
    created_by uuid NULL,
    updated_by uuid NULL,
    CONSTRAINT chk_customer_rental_orders_status
        CHECK (status IN ('pending', 'awaiting_vendor_acceptance', 'confirmed', 'in_transit', 'active', 'returned', 'cancelled', 'dispatch_failed'))
);

CREATE INDEX IF NOT EXISTS ix_customer_rental_orders_customer_id
    ON public.customer_rental_orders(customer_id);
CREATE INDEX IF NOT EXISTS ix_customer_rental_orders_listing_id
    ON public.customer_rental_orders(vendor_product_listing_id);
CREATE INDEX IF NOT EXISTS ix_customer_rental_orders_order_number
    ON public.customer_rental_orders(order_number);
CREATE INDEX IF NOT EXISTS ix_customer_rental_orders_listing_period_status
    ON public.customer_rental_orders(vendor_product_listing_id, start_date, end_date, status);

CREATE TABLE IF NOT EXISTS public.customer_order_vendor_offers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_rental_order_id uuid NOT NULL REFERENCES public.customer_rental_orders(id),
    vendor_id uuid NOT NULL,
    vendor_product_listing_id uuid NOT NULL,
    offer_rank int NOT NULL CHECK (offer_rank > 0),
    status varchar(30) NOT NULL DEFAULT 'pending',
    expires_at timestamptz NOT NULL,
    responded_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL,
    created_by uuid NULL,
    updated_by uuid NULL,
    CONSTRAINT chk_customer_order_vendor_offers_status
        CHECK (status IN ('pending', 'accepted', 'rejected', 'expired'))
);

CREATE INDEX IF NOT EXISTS ix_customer_order_vendor_offers_vendor_pending
    ON public.customer_order_vendor_offers(vendor_id, status, expires_at);
CREATE INDEX IF NOT EXISTS ix_customer_order_vendor_offers_order_id
    ON public.customer_order_vendor_offers(customer_rental_order_id);

CREATE TABLE IF NOT EXISTS public.customer_notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid NOT NULL REFERENCES public.customers(id),
    title varchar(300) NOT NULL,
    body text NOT NULL,
    notification_type varchar(80) NOT NULL DEFAULT 'general',
    related_order_id uuid NULL REFERENCES public.customer_rental_orders(id) ON DELETE SET NULL,
    read_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL
);

CREATE INDEX IF NOT EXISTS ix_customer_notifications_customer_id
    ON public.customer_notifications(customer_id);
CREATE INDEX IF NOT EXISTS ix_customer_notifications_customer_created
    ON public.customer_notifications(customer_id, created_at DESC);
