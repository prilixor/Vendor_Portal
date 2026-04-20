-- Table 13: vendor_product_documents
-- Optional product proof/service records for a vendor listing.

create table if not exists public.vendor_product_documents (
    id uuid primary key default gen_random_uuid(),
    vendor_product_listing_id uuid not null,
    document_type varchar(50) not null,
    file_url text not null,
    verification_status varchar(30) not null default 'pending',
    rejection_reason text null,
    verified_at timestamptz null,

    -- Audit columns
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    created_by uuid null,
    updated_by uuid null,
    is_deleted boolean not null default false,
    deleted_at timestamptz null,
    deleted_by uuid null,

    constraint fk_vendor_product_documents_listing
        foreign key (vendor_product_listing_id) references public.vendor_product_listings(id),
    constraint chk_vendor_product_documents_verification_status
        check (verification_status in ('pending', 'approved', 'rejected'))
);

create index if not exists ix_vendor_product_documents_listing_id
    on public.vendor_product_documents(vendor_product_listing_id);

drop trigger if exists trg_vendor_product_documents_set_audit_columns on public.vendor_product_documents;
create trigger trg_vendor_product_documents_set_audit_columns
before insert or update on public.vendor_product_documents
for each row execute function public.fn_set_audit_columns();

drop trigger if exists trg_vendor_product_documents_write_audit_log on public.vendor_product_documents;
create trigger trg_vendor_product_documents_write_audit_log
after insert or update or delete on public.vendor_product_documents
for each row execute function audit.fn_write_audit_log();
