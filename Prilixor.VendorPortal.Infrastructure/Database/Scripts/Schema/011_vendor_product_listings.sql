-- Table 11: vendor_product_listings
-- Vendor commercial listing linked to vendor and product.

create table if not exists public.vendor_product_listings (
    id uuid primary key default gen_random_uuid(),
    vendor_id uuid not null,
    product_id uuid not null,
    listing_title varchar(255) not null,
    daily_rent numeric(12, 2) not null,
    monthly_rent numeric(12, 2) not null,
    security_deposit numeric(12, 2) not null default 0,
    available_quantity integer not null default 0,
    listing_status varchar(30) not null default 'draft',

    -- Audit columns
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    created_by uuid null,
    updated_by uuid null,
    is_deleted boolean not null default false,
    deleted_at timestamptz null,
    deleted_by uuid null,

    constraint fk_vendor_product_listings_vendor
        foreign key (vendor_id) references public.vendors(id),
    constraint fk_vendor_product_listings_product
        foreign key (product_id) references public.products(id),
    constraint uq_vendor_product_listings_vendor_product
        unique (vendor_id, product_id),
    constraint chk_vendor_product_listings_listing_status
        check (listing_status in ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'inactive', 'blocked')),
    constraint chk_vendor_product_listings_amounts
        check (daily_rent >= 0 and monthly_rent >= 0 and security_deposit >= 0),
    constraint chk_vendor_product_listings_quantity
        check (available_quantity >= 0)
);

create index if not exists ix_vendor_product_listings_vendor_id
    on public.vendor_product_listings(vendor_id);

create index if not exists ix_vendor_product_listings_product_id
    on public.vendor_product_listings(product_id);

create index if not exists ix_vendor_product_listings_status
    on public.vendor_product_listings(listing_status);

drop trigger if exists trg_vendor_product_listings_set_audit_columns on public.vendor_product_listings;
create trigger trg_vendor_product_listings_set_audit_columns
before insert or update on public.vendor_product_listings
for each row execute function public.fn_set_audit_columns();

drop trigger if exists trg_vendor_product_listings_write_audit_log on public.vendor_product_listings;
create trigger trg_vendor_product_listings_write_audit_log
after insert or update or delete on public.vendor_product_listings
for each row execute function audit.fn_write_audit_log();
