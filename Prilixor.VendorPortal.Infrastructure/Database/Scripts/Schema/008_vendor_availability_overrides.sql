-- Table 8: vendor_availability_overrides
-- Holiday/vacation/special closure overrides.

create table if not exists public.vendor_availability_overrides (
    id uuid primary key default gen_random_uuid(),
    vendor_id uuid not null,
    override_date date not null,
    is_available boolean not null default false,
    start_time time null,
    end_time time null,
    reason varchar(255) null,

    -- Audit columns
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    created_by uuid null,
    updated_by uuid null,
    is_deleted boolean not null default false,
    deleted_at timestamptz null,
    deleted_by uuid null,

    constraint fk_vendor_availability_overrides_vendor
        foreign key (vendor_id) references public.vendors(id),
    constraint uq_vendor_availability_overrides_vendor_date
        unique (vendor_id, override_date),
    constraint chk_vendor_availability_overrides_time
        check (
            (is_available = false and start_time is null and end_time is null) or
            (is_available = true and start_time is not null and end_time is not null and start_time < end_time)
        )
);

create index if not exists ix_vendor_availability_overrides_vendor_id
    on public.vendor_availability_overrides(vendor_id);

create index if not exists ix_vendor_availability_overrides_date
    on public.vendor_availability_overrides(override_date);

drop trigger if exists trg_vendor_availability_overrides_set_audit_columns on public.vendor_availability_overrides;
create trigger trg_vendor_availability_overrides_set_audit_columns
before insert or update on public.vendor_availability_overrides
for each row execute function public.fn_set_audit_columns();

drop trigger if exists trg_vendor_availability_overrides_write_audit_log on public.vendor_availability_overrides;
create trigger trg_vendor_availability_overrides_write_audit_log
after insert or update or delete on public.vendor_availability_overrides
for each row execute function audit.fn_write_audit_log();
