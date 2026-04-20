-- Table 14: vendor_inventory
-- Source of truth for listing stock buckets.

create table if not exists public.vendor_inventory (
    id uuid primary key default gen_random_uuid(),
    vendor_product_listing_id uuid not null unique,
    total_quantity integer not null default 0,
    available_quantity integer not null default 0,
    reserved_quantity integer not null default 0,
    rented_quantity integer not null default 0,
    blocked_quantity integer not null default 0,

    -- Audit columns
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    created_by uuid null,
    updated_by uuid null,
    is_deleted boolean not null default false,
    deleted_at timestamptz null,
    deleted_by uuid null,

    constraint fk_vendor_inventory_listing
        foreign key (vendor_product_listing_id) references public.vendor_product_listings(id),
    constraint chk_vendor_inventory_non_negative
        check (
            total_quantity >= 0 and
            available_quantity >= 0 and
            reserved_quantity >= 0 and
            rented_quantity >= 0 and
            blocked_quantity >= 0
        ),
    constraint chk_vendor_inventory_bucket_sum
        check (available_quantity + reserved_quantity + rented_quantity + blocked_quantity <= total_quantity)
);

create index if not exists ix_vendor_inventory_listing_id
    on public.vendor_inventory(vendor_product_listing_id);

drop trigger if exists trg_vendor_inventory_set_audit_columns on public.vendor_inventory;
create trigger trg_vendor_inventory_set_audit_columns
before insert or update on public.vendor_inventory
for each row execute function public.fn_set_audit_columns();

drop trigger if exists trg_vendor_inventory_write_audit_log on public.vendor_inventory;
create trigger trg_vendor_inventory_write_audit_log
after insert or update or delete on public.vendor_inventory
for each row execute function audit.fn_write_audit_log();
