-- Fresh full schema for vendor_portal_db
-- Run on: vendor_portal_db
--
-- Note:
-- - This is a standalone script for the vendor portal schema.
-- - It includes catalog tables for current compatibility during staged split rollout.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.vendors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email varchar(255) NOT NULL UNIQUE,
    password_hash text NOT NULL,
    support_phone varchar(20) NULL,
    email_verified boolean NOT NULL DEFAULT false,
    email_verification_token text NULL,
    verification_token_expiry_utc timestamptz NULL,
    terms_accepted_at timestamptz NULL,
    account_status varchar(30) NOT NULL DEFAULT 'pending',
    registration_stage varchar(40) NOT NULL DEFAULT 'email_registered',
    last_login_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL,
    CONSTRAINT chk_vendors_account_status
        CHECK (account_status IN ('pending', 'active', 'suspended', 'banned', 'rejected')),
    CONSTRAINT chk_vendors_registration_stage
        CHECK (registration_stage IN ('email_registered', 'profile_pending', 'documents_pending', 'under_review', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS ix_vendors_account_status ON public.vendors(account_status);
CREATE INDEX IF NOT EXISTS ix_vendors_registration_stage ON public.vendors(registration_stage);
CREATE INDEX IF NOT EXISTS ix_vendors_created_at ON public.vendors(created_at);
CREATE INDEX IF NOT EXISTS ix_vendors_email_verification_token
    ON public.vendors(email_verification_token)
    WHERE email_verification_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_vendors_email_verified ON public.vendors(email_verified);
CREATE UNIQUE INDEX IF NOT EXISTS uq_vendors_support_phone_active
    ON public.vendors(support_phone)
    WHERE support_phone IS NOT NULL AND is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_vendors_support_phone ON public.vendors(support_phone);

CREATE TABLE IF NOT EXISTS public.vendor_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id uuid NOT NULL UNIQUE,
    business_name varchar(255) NOT NULL,
    owner_name varchar(255) NOT NULL,
    support_phone varchar(20) NOT NULL,
    gst_number varchar(50) NULL,
    address_line_1 varchar(255) NOT NULL,
    address_line_2 varchar(255) NULL,
    city varchar(100) NOT NULL,
    state varchar(100) NOT NULL,
    postal_code varchar(20) NOT NULL,
    latitude numeric(10, 7) NULL,
    longitude numeric(10, 7) NULL,
    onboarding_completed boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL,
    CONSTRAINT fk_vendor_profiles_vendor
        FOREIGN KEY (vendor_id) REFERENCES public.vendors(id)
);

CREATE INDEX IF NOT EXISTS ix_vendor_profiles_vendor_id ON public.vendor_profiles(vendor_id);
CREATE INDEX IF NOT EXISTS ix_vendor_profiles_city_state ON public.vendor_profiles(city, state);

CREATE TABLE IF NOT EXISTS public.vendor_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id uuid NOT NULL,
    document_type varchar(50) NOT NULL,
    file_url text NOT NULL,
    document_number varchar(100) NULL,
    verification_status varchar(30) NOT NULL DEFAULT 'pending',
    rejection_reason text NULL,
    verified_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL,
    CONSTRAINT fk_vendor_documents_vendor
        FOREIGN KEY (vendor_id) REFERENCES public.vendors(id),
    CONSTRAINT chk_vendor_documents_verification_status
        CHECK (verification_status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS ix_vendor_documents_vendor_id ON public.vendor_documents(vendor_id);
CREATE INDEX IF NOT EXISTS ix_vendor_documents_status ON public.vendor_documents(verification_status);
CREATE INDEX IF NOT EXISTS ix_vendor_documents_vendor_status ON public.vendor_documents(vendor_id, verification_status);

CREATE TABLE IF NOT EXISTS public.vendor_verification_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id uuid NOT NULL,
    review_status varchar(30) NOT NULL DEFAULT 'pending',
    submitted_at timestamptz NOT NULL DEFAULT now(),
    reviewed_at timestamptz NULL,
    reviewed_by uuid NULL,
    rejection_reason text NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL,
    CONSTRAINT fk_vendor_verification_requests_vendor
        FOREIGN KEY (vendor_id) REFERENCES public.vendors(id),
    CONSTRAINT chk_vendor_verification_requests_status
        CHECK (review_status IN ('pending', 'under_review', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS ix_vendor_verification_requests_vendor_id ON public.vendor_verification_requests(vendor_id);
CREATE INDEX IF NOT EXISTS ix_vendor_verification_requests_status ON public.vendor_verification_requests(review_status);
CREATE INDEX IF NOT EXISTS ix_vendor_verification_requests_submitted_at ON public.vendor_verification_requests(submitted_at DESC);

CREATE TABLE IF NOT EXISTS public.vendor_bank_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id uuid NOT NULL,
    account_holder_name varchar(255) NOT NULL,
    bank_name varchar(255) NOT NULL,
    account_number varchar(100) NOT NULL,
    branch_name varchar(255) NULL,
    ifsc_code varchar(20) NOT NULL,
    verification_status varchar(30) NOT NULL DEFAULT 'pending',
    verified_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL,
    CONSTRAINT fk_vendor_bank_accounts_vendor
        FOREIGN KEY (vendor_id) REFERENCES public.vendors(id),
    CONSTRAINT chk_vendor_bank_accounts_verification_status
        CHECK (verification_status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS ix_vendor_bank_accounts_vendor_id ON public.vendor_bank_accounts(vendor_id);

CREATE TABLE IF NOT EXISTS public.vendor_service_areas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id uuid NOT NULL,
    area_name varchar(150) NOT NULL,
    city varchar(100) NOT NULL,
    center_latitude numeric(10, 7) NOT NULL,
    center_longitude numeric(10, 7) NOT NULL,
    service_radius_km numeric(8, 2) NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL,
    CONSTRAINT fk_vendor_service_areas_vendor
        FOREIGN KEY (vendor_id) REFERENCES public.vendors(id),
    CONSTRAINT chk_vendor_service_areas_radius CHECK (service_radius_km > 0)
);

CREATE INDEX IF NOT EXISTS ix_vendor_service_areas_vendor_id ON public.vendor_service_areas(vendor_id);
CREATE INDEX IF NOT EXISTS ix_vendor_service_areas_city_active ON public.vendor_service_areas(city, is_active);

CREATE TABLE IF NOT EXISTS public.vendor_working_hours (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id uuid NOT NULL,
    day_of_week smallint NOT NULL,
    is_open boolean NOT NULL DEFAULT true,
    open_time time NULL,
    close_time time NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL,
    CONSTRAINT fk_vendor_working_hours_vendor
        FOREIGN KEY (vendor_id) REFERENCES public.vendors(id),
    CONSTRAINT uq_vendor_working_hours_vendor_day
        UNIQUE (vendor_id, day_of_week),
    CONSTRAINT chk_vendor_working_hours_day CHECK (day_of_week BETWEEN 0 AND 6),
    CONSTRAINT chk_vendor_working_hours_time
        CHECK (
            (is_open = false AND open_time IS NULL AND close_time IS NULL) OR
            (is_open = true AND open_time IS NOT NULL AND close_time IS NOT NULL AND open_time < close_time)
        )
);

CREATE INDEX IF NOT EXISTS ix_vendor_working_hours_vendor_id ON public.vendor_working_hours(vendor_id);

CREATE TABLE IF NOT EXISTS public.vendor_availability_overrides (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id uuid NOT NULL,
    override_date date NOT NULL,
    is_available boolean NOT NULL DEFAULT false,
    start_time time NULL,
    end_time time NULL,
    reason varchar(255) NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL,
    CONSTRAINT fk_vendor_availability_overrides_vendor
        FOREIGN KEY (vendor_id) REFERENCES public.vendors(id),
    CONSTRAINT uq_vendor_availability_overrides_vendor_date
        UNIQUE (vendor_id, override_date),
    CONSTRAINT chk_vendor_availability_overrides_time
        CHECK (
            (is_available = false AND start_time IS NULL AND end_time IS NULL) OR
            (is_available = true AND start_time IS NOT NULL AND end_time IS NOT NULL AND start_time < end_time)
        )
);

CREATE INDEX IF NOT EXISTS ix_vendor_availability_overrides_vendor_id ON public.vendor_availability_overrides(vendor_id);
CREATE INDEX IF NOT EXISTS ix_vendor_availability_overrides_date ON public.vendor_availability_overrides(override_date);

-- Compatibility catalog during staged migration
CREATE TABLE IF NOT EXISTS public.product_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category_name varchar(150) NOT NULL UNIQUE,
    prescription_required boolean NOT NULL DEFAULT false,
    deposit_required boolean NOT NULL DEFAULT false,
    installation_required boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL
);

CREATE INDEX IF NOT EXISTS ix_product_categories_is_active ON public.product_categories(is_active);

CREATE TABLE IF NOT EXISTS public.products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id uuid NOT NULL,
    product_name varchar(255) NOT NULL,
    brand_name varchar(255) NULL,
    model_name varchar(255) NULL,
    short_description varchar(500) NULL,
    long_description text NULL,
    daily_rent numeric(12, 2) NOT NULL DEFAULT 0,
    monthly_rent numeric(12, 2) NOT NULL DEFAULT 0,
    security_deposit numeric(12, 2) NOT NULL DEFAULT 0,
    buy_price numeric(12, 2) NULL,
    gst_percent numeric(5, 2) NOT NULL DEFAULT 18,
    is_rent_enabled boolean NOT NULL DEFAULT true,
    is_buy_enabled boolean NOT NULL DEFAULT true,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL,
    CONSTRAINT fk_products_category
        FOREIGN KEY (category_id) REFERENCES public.product_categories(id),
    CONSTRAINT chk_products_amounts
        CHECK (daily_rent >= 0 AND monthly_rent >= 0 AND security_deposit >= 0 AND (buy_price IS NULL OR buy_price >= 0)),
    CONSTRAINT chk_products_gst_percent
        CHECK (gst_percent >= 0 AND gst_percent <= 100)
);

CREATE INDEX IF NOT EXISTS ix_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS ix_products_is_active ON public.products(is_active);

CREATE TABLE IF NOT EXISTS public.product_images (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL,
    image_url text NOT NULL,
    display_order integer NOT NULL DEFAULT 1,
    is_primary boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL,
    CONSTRAINT fk_product_images_product
        FOREIGN KEY (product_id) REFERENCES public.products(id),
    CONSTRAINT chk_product_images_display_order CHECK (display_order > 0)
);

CREATE INDEX IF NOT EXISTS ix_product_images_product_id ON public.product_images(product_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_images_primary_per_product
    ON public.product_images(product_id)
    WHERE is_primary = true AND is_deleted = false;

CREATE TABLE IF NOT EXISTS public.vendor_product_listings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id uuid NOT NULL,
    product_id uuid NOT NULL,
    listing_title varchar(255) NOT NULL,
    daily_rent numeric(12, 2) NOT NULL,
    monthly_rent numeric(12, 2) NOT NULL,
    security_deposit numeric(12, 2) NOT NULL DEFAULT 0,
    available_quantity integer NOT NULL DEFAULT 0,
    listing_status varchar(30) NOT NULL DEFAULT 'draft',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL,
    CONSTRAINT fk_vendor_product_listings_vendor
        FOREIGN KEY (vendor_id) REFERENCES public.vendors(id),
    CONSTRAINT fk_vendor_product_listings_product
        FOREIGN KEY (product_id) REFERENCES public.products(id),
    CONSTRAINT uq_vendor_product_listings_vendor_product
        UNIQUE (vendor_id, product_id),
    CONSTRAINT chk_vendor_product_listings_listing_status
        CHECK (listing_status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'inactive', 'blocked')),
    CONSTRAINT chk_vendor_product_listings_amounts
        CHECK (daily_rent >= 0 AND monthly_rent >= 0 AND security_deposit >= 0),
    CONSTRAINT chk_vendor_product_listings_quantity
        CHECK (available_quantity >= 0)
);

CREATE INDEX IF NOT EXISTS ix_vendor_product_listings_vendor_id ON public.vendor_product_listings(vendor_id);
CREATE INDEX IF NOT EXISTS ix_vendor_product_listings_product_id ON public.vendor_product_listings(product_id);
CREATE INDEX IF NOT EXISTS ix_vendor_product_listings_status ON public.vendor_product_listings(listing_status);

CREATE TABLE IF NOT EXISTS public.vendor_product_images (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_product_listing_id uuid NOT NULL,
    image_url text NOT NULL,
    display_order integer NOT NULL DEFAULT 1,
    is_primary boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL,
    CONSTRAINT fk_vendor_product_images_listing
        FOREIGN KEY (vendor_product_listing_id) REFERENCES public.vendor_product_listings(id),
    CONSTRAINT chk_vendor_product_images_display_order CHECK (display_order > 0)
);

CREATE INDEX IF NOT EXISTS ix_vendor_product_images_listing_id ON public.vendor_product_images(vendor_product_listing_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_vendor_product_images_primary_per_listing
    ON public.vendor_product_images(vendor_product_listing_id)
    WHERE is_primary = true AND is_deleted = false;

CREATE TABLE IF NOT EXISTS public.vendor_product_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_product_listing_id uuid NOT NULL,
    document_type varchar(50) NOT NULL,
    file_url text NOT NULL,
    verification_status varchar(30) NOT NULL DEFAULT 'pending',
    rejection_reason text NULL,
    verified_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL,
    CONSTRAINT fk_vendor_product_documents_listing
        FOREIGN KEY (vendor_product_listing_id) REFERENCES public.vendor_product_listings(id),
    CONSTRAINT chk_vendor_product_documents_verification_status
        CHECK (verification_status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS ix_vendor_product_documents_listing_id ON public.vendor_product_documents(vendor_product_listing_id);

CREATE TABLE IF NOT EXISTS public.vendor_inventory (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_product_listing_id uuid NOT NULL UNIQUE,
    total_quantity integer NOT NULL DEFAULT 0,
    available_quantity integer NOT NULL DEFAULT 0,
    reserved_quantity integer NOT NULL DEFAULT 0,
    rented_quantity integer NOT NULL DEFAULT 0,
    blocked_quantity integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL,
    CONSTRAINT fk_vendor_inventory_listing
        FOREIGN KEY (vendor_product_listing_id) REFERENCES public.vendor_product_listings(id),
    CONSTRAINT chk_vendor_inventory_non_negative
        CHECK (
            total_quantity >= 0 AND
            available_quantity >= 0 AND
            reserved_quantity >= 0 AND
            rented_quantity >= 0 AND
            blocked_quantity >= 0
        ),
    CONSTRAINT chk_vendor_inventory_bucket_sum
        CHECK (available_quantity + reserved_quantity + rented_quantity + blocked_quantity <= total_quantity)
);

CREATE INDEX IF NOT EXISTS ix_vendor_inventory_listing_id ON public.vendor_inventory(vendor_product_listing_id);

CREATE TABLE IF NOT EXISTS public.vendor_inventory_movements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_inventory_id uuid NOT NULL,
    movement_type varchar(40) NOT NULL,
    quantity integer NOT NULL,
    reference_type varchar(50) NULL,
    reference_id uuid NULL,
    notes text NULL,
    event_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL,
    CONSTRAINT fk_vendor_inventory_movements_inventory
        FOREIGN KEY (vendor_inventory_id) REFERENCES public.vendor_inventory(id),
    CONSTRAINT chk_vendor_inventory_movements_type
        CHECK (movement_type IN ('stock_added', 'stock_removed', 'reserved', 'reservation_released', 'rented', 'returned', 'blocked', 'unblocked', 'corrected')),
    CONSTRAINT chk_vendor_inventory_movements_quantity CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS ix_vendor_inventory_movements_inventory_id ON public.vendor_inventory_movements(vendor_inventory_id);
CREATE INDEX IF NOT EXISTS ix_vendor_inventory_movements_created_at ON public.vendor_inventory_movements(created_at DESC);

CREATE TABLE IF NOT EXISTS public.vendor_notification_preferences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id uuid NOT NULL UNIQUE,
    email_notifications_enabled boolean NOT NULL DEFAULT true,
    push_notifications_enabled boolean NOT NULL DEFAULT true,
    new_order_notifications boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL,
    CONSTRAINT fk_vendor_notification_preferences_vendor
        FOREIGN KEY (vendor_id) REFERENCES public.vendors(id)
);

CREATE INDEX IF NOT EXISTS ix_vendor_notification_preferences_vendor_id ON public.vendor_notification_preferences(vendor_id);

CREATE TABLE IF NOT EXISTS public.vendor_notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id uuid NOT NULL,
    notification_type varchar(50) NOT NULL,
    title varchar(255) NOT NULL,
    message text NOT NULL,
    channel varchar(30) NOT NULL,
    status varchar(30) NOT NULL DEFAULT 'pending',
    sent_at timestamptz NULL,
    read_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL,
    CONSTRAINT fk_vendor_notifications_vendor
        FOREIGN KEY (vendor_id) REFERENCES public.vendors(id),
    CONSTRAINT chk_vendor_notifications_channel
        CHECK (channel IN ('in_app', 'email', 'push', 'sms')),
    CONSTRAINT chk_vendor_notifications_status
        CHECK (status IN ('pending', 'sent', 'failed', 'read'))
);

CREATE INDEX IF NOT EXISTS ix_vendor_notifications_vendor_id ON public.vendor_notifications(vendor_id);
CREATE INDEX IF NOT EXISTS ix_vendor_notifications_status ON public.vendor_notifications(status);
CREATE INDEX IF NOT EXISTS ix_vendor_notifications_created_at ON public.vendor_notifications(created_at DESC);

CREATE TABLE IF NOT EXISTS public.vendor_push_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id uuid NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL,
    CONSTRAINT fk_vendor_push_subscriptions_vendor
        FOREIGN KEY (vendor_id) REFERENCES public.vendors(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_vendor_push_subscriptions_vendor_id_active
    ON public.vendor_push_subscriptions(vendor_id)
    WHERE is_deleted = false;

CREATE TABLE IF NOT EXISTS public.support_tickets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id uuid NOT NULL,
    ticket_number varchar(100) NOT NULL UNIQUE,
    category varchar(100) NOT NULL,
    subject varchar(500) NOT NULL,
    status varchar(50) NOT NULL DEFAULT 'Open',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL,
    CONSTRAINT fk_support_tickets_vendor
        FOREIGN KEY (vendor_id) REFERENCES public.vendors(id)
);

CREATE INDEX IF NOT EXISTS ix_support_tickets_vendor_id ON public.support_tickets(vendor_id);
CREATE INDEX IF NOT EXISTS ix_support_tickets_status ON public.support_tickets(status);

CREATE TABLE IF NOT EXISTS public.support_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    sender_type varchar(50) NOT NULL,
    message text NOT NULL,
    attachment_urls text NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL,
    CONSTRAINT fk_support_messages_ticket
        FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id)
);

CREATE INDEX IF NOT EXISTS ix_support_messages_ticket_id ON public.support_messages(ticket_id);
