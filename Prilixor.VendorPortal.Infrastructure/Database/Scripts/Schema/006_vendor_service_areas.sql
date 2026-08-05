-- Table 6: vendor_service_areas
-- Coverage radius used for vendor serviceability.

create table if not exists public.vendor_service_areas (
    id uuid primary key default gen_random_uuid(),
    vendor_id uuid not null,
    area_name varchar(150) not null,
    city varchar(100) not null,
    center_latitude numeric(10, 7) not null,
    center_longitude numeric(10, 7) not null,
    service_radius_km numeric(8, 2) not null,
    is_radius_set_by_admin boolean not null default false,
    is_active boolean not null default true,

    -- Audit columns
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    created_by uuid null,
    updated_by uuid null,
    is_deleted boolean not null default false,
    deleted_at timestamptz null,
    deleted_by uuid null,

    constraint fk_vendor_service_areas_vendor
        foreign key (vendor_id) references public.vendors(id),
    constraint chk_vendor_service_areas_radius
        check (service_radius_km > 0)
);

create index if not exists ix_vendor_service_areas_vendor_id
    on public.vendor_service_areas(vendor_id);

create index if not exists ix_vendor_service_areas_city_active
    on public.vendor_service_areas(city, is_active);

drop trigger if exists trg_vendor_service_areas_set_audit_columns on public.vendor_service_areas;
create trigger trg_vendor_service_areas_set_audit_columns
before insert or update on public.vendor_service_areas
for each row execute function public.fn_set_audit_columns();

drop trigger if exists trg_vendor_service_areas_write_audit_log on public.vendor_service_areas;
create trigger trg_vendor_service_areas_write_audit_log
after insert or update or delete on public.vendor_service_areas
for each row execute function audit.fn_write_audit_log();
