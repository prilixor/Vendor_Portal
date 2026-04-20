-- Table 4: vendor_verification_requests
-- Admin review workflow for vendor onboarding approval lifecycle.

create table if not exists public.vendor_verification_requests (
    id uuid primary key default gen_random_uuid(),
    vendor_id uuid not null,
    review_status varchar(30) not null default 'pending',
    submitted_at timestamptz not null default now(),
    reviewed_at timestamptz null,
    reviewed_by uuid null,
    rejection_reason text null,

    -- Audit columns
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    created_by uuid null,
    updated_by uuid null,
    is_deleted boolean not null default false,
    deleted_at timestamptz null,
    deleted_by uuid null,

    constraint fk_vendor_verification_requests_vendor
        foreign key (vendor_id) references public.vendors(id),
    constraint chk_vendor_verification_requests_status
        check (review_status in ('pending', 'under_review', 'approved', 'rejected'))
);

create index if not exists ix_vendor_verification_requests_vendor_id
    on public.vendor_verification_requests(vendor_id);

create index if not exists ix_vendor_verification_requests_status
    on public.vendor_verification_requests(review_status);

create index if not exists ix_vendor_verification_requests_submitted_at
    on public.vendor_verification_requests(submitted_at desc);

drop trigger if exists trg_vendor_verification_requests_set_audit_columns on public.vendor_verification_requests;
create trigger trg_vendor_verification_requests_set_audit_columns
before insert or update on public.vendor_verification_requests
for each row execute function public.fn_set_audit_columns();

drop trigger if exists trg_vendor_verification_requests_write_audit_log on public.vendor_verification_requests;
create trigger trg_vendor_verification_requests_write_audit_log
after insert or update or delete on public.vendor_verification_requests
for each row execute function audit.fn_write_audit_log();
