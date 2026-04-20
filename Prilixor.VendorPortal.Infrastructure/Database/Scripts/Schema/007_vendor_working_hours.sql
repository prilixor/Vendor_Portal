-- Table 7: vendor_working_hours
-- Weekly open/close schedule per vendor.

create table if not exists public.vendor_working_hours (
    id uuid primary key default gen_random_uuid(),
    vendor_id uuid not null,
    day_of_week smallint not null,
    is_open boolean not null default true,
    open_time time null,
    close_time time null,

    -- Audit columns
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    created_by uuid null,
    updated_by uuid null,
    is_deleted boolean not null default false,
    deleted_at timestamptz null,
    deleted_by uuid null,

    constraint fk_vendor_working_hours_vendor
        foreign key (vendor_id) references public.vendors(id),
    constraint uq_vendor_working_hours_vendor_day
        unique (vendor_id, day_of_week),
    constraint chk_vendor_working_hours_day
        check (day_of_week between 0 and 6),
    constraint chk_vendor_working_hours_time
        check (
            (is_open = false and open_time is null and close_time is null) or
            (is_open = true and open_time is not null and close_time is not null and open_time < close_time)
        )
);

create index if not exists ix_vendor_working_hours_vendor_id
    on public.vendor_working_hours(vendor_id);

drop trigger if exists trg_vendor_working_hours_set_audit_columns on public.vendor_working_hours;
create trigger trg_vendor_working_hours_set_audit_columns
before insert or update on public.vendor_working_hours
for each row execute function public.fn_set_audit_columns();

drop trigger if exists trg_vendor_working_hours_write_audit_log on public.vendor_working_hours;
create trigger trg_vendor_working_hours_write_audit_log
after insert or update or delete on public.vendor_working_hours
for each row execute function audit.fn_write_audit_log();
