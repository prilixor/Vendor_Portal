-- Customer portal schema (customers, addresses, rental orders).
--
-- Apply on the database pointed to by ConnectionStrings:CustomerPortalConnection.
-- That may be a dedicated database or the same PostgreSQL database as the vendor app
-- (when CustomerPortalConnection is unset / defaults to DefaultConnection).
--
-- vendor_product_listing_id is UUID only — no FK to vendor_product_listings (listings live in the vendor DbContext).
--
-- Dedicated DB setup example:
--   1. psql -U postgres -d postgres -f 028_create_customer_portal_database.sql
--   2. psql -U postgres -d customer_portal_db -f 029_customer_portal_database_schema.sql

-- Customer accounts (B2C renter portal)
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(200) NOT NULL DEFAULT '',
    phone VARCHAR(30) NULL,
    email_verified BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ NULL,
    deleted_by UUID NULL
);

CREATE INDEX IF NOT EXISTS ix_customers_email ON public.customers(email);
CREATE INDEX IF NOT EXISTS ix_customers_created_at ON public.customers(created_at);

CREATE TABLE IF NOT EXISTS public.customer_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id),
    label VARCHAR(100) NULL,
    line_1 VARCHAR(500) NOT NULL,
    city VARCHAR(120) NOT NULL,
    state VARCHAR(120) NOT NULL,
    postal VARCHAR(30) NOT NULL,
    latitude NUMERIC(9,6) NULL,
    longitude NUMERIC(9,6) NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ NULL,
    deleted_by UUID NULL,
    created_by UUID NULL,
    updated_by UUID NULL
);

CREATE INDEX IF NOT EXISTS ix_customer_addresses_customer_id ON public.customer_addresses(customer_id);

CREATE TABLE IF NOT EXISTS public.customer_rental_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(40) NOT NULL UNIQUE,
    customer_id UUID NOT NULL REFERENCES public.customers(id),
    vendor_product_listing_id UUID NOT NULL,
    customer_address_id UUID NULL REFERENCES public.customer_addresses(id),
    quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    rental_days INT NOT NULL CHECK (rental_days >= 0),
    order_type VARCHAR(20) NOT NULL DEFAULT 'rent',
    delivery_option VARCHAR(40) NOT NULL DEFAULT 'standard',
    status VARCHAR(40) NOT NULL DEFAULT 'pending',
    subtotal_amount DECIMAL(12, 2) NOT NULL,
    deposit_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    service_fee_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    distance_fee_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    express_fee_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    gst_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL,
    start_date DATE NULL,
    end_date DATE NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ NULL,
    deleted_by UUID NULL,
    created_by UUID NULL,
    updated_by UUID NULL,
    CONSTRAINT chk_customer_rental_orders_status CHECK (
        status IN ('pending', 'awaiting_vendor_acceptance', 'confirmed', 'in_transit', 'active', 'returned', 'cancelled', 'dispatch_failed')
    )
);

CREATE INDEX IF NOT EXISTS ix_customer_rental_orders_customer_id ON public.customer_rental_orders(customer_id);
CREATE INDEX IF NOT EXISTS ix_customer_rental_orders_listing_id ON public.customer_rental_orders(vendor_product_listing_id);
CREATE INDEX IF NOT EXISTS ix_customer_rental_orders_order_number ON public.customer_rental_orders(order_number);
CREATE INDEX IF NOT EXISTS ix_customer_rental_orders_listing_period_status ON public.customer_rental_orders(vendor_product_listing_id, start_date, end_date, status);

CREATE TABLE IF NOT EXISTS public.customer_order_vendor_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_rental_order_id UUID NOT NULL REFERENCES public.customer_rental_orders(id),
    vendor_id UUID NOT NULL,
    vendor_product_listing_id UUID NOT NULL,
    offer_rank INT NOT NULL CHECK (offer_rank > 0),
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMPTZ NOT NULL,
    responded_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ NULL,
    deleted_by UUID NULL,
    created_by UUID NULL,
    updated_by UUID NULL,
    CONSTRAINT chk_customer_order_vendor_offers_status CHECK (
        status IN ('pending', 'accepted', 'rejected', 'expired')
    )
);

CREATE INDEX IF NOT EXISTS ix_customer_order_vendor_offers_vendor_pending
    ON public.customer_order_vendor_offers(vendor_id, status, expires_at);
CREATE INDEX IF NOT EXISTS ix_customer_order_vendor_offers_order_id
    ON public.customer_order_vendor_offers(customer_rental_order_id);
