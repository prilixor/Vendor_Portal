-- Table 12: vendor_product_images
-- Multiple images for a vendor listing.

create table if not exists public.vendor_product_images (
    id uuid primary key default gen_random_uuid(),
    vendor_product_listing_id uuid not null,
    image_url text not null,
    display_order integer not null default 1,
    is_primary boolean not null default false,

    -- Audit columns
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    created_by uuid null,
    updated_by uuid null,
    is_deleted boolean not null default false,
    deleted_at timestamptz null,
    deleted_by uuid null,

    constraint fk_vendor_product_images_listing
        foreign key (vendor_product_listing_id) references public.vendor_product_listings(id),
    constraint chk_vendor_product_images_display_order
        check (display_order > 0)
);

create index if not exists ix_vendor_product_images_listing_id
    on public.vendor_product_images(vendor_product_listing_id);

create unique index if not exists uq_vendor_product_images_primary_per_listing
    on public.vendor_product_images(vendor_product_listing_id)
    where is_primary = true and is_deleted = false;

drop trigger if exists trg_vendor_product_images_set_audit_columns on public.vendor_product_images;
create trigger trg_vendor_product_images_set_audit_columns
before insert or update on public.vendor_product_images
for each row execute function public.fn_set_audit_columns();

drop trigger if exists trg_vendor_product_images_write_audit_log on public.vendor_product_images;
create trigger trg_vendor_product_images_write_audit_log
after insert or update or delete on public.vendor_product_images
for each row execute function audit.fn_write_audit_log();
