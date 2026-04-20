-- Table 2: vendor_profiles
-- One-to-one profile table linked to vendors via vendor_id (UNIQUE + FK).

create table if not exists public.vendor_profiles (
    id uuid primary key default gen_random_uuid(),
    vendor_id uuid not null unique,
    business_name varchar(255) not null,
    owner_name varchar(255) not null,
    support_phone varchar(20) not null,
    gst_number varchar(50) null,
    address_line_1 varchar(255) not null,
    address_line_2 varchar(255) null,
    city varchar(100) not null,
    state varchar(100) not null,
    postal_code varchar(20) not null,
    latitude numeric(10, 7) null,
    longitude numeric(10, 7) null,
    onboarding_completed boolean not null default false,

    -- Audit columns
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    created_by uuid null,
    updated_by uuid null,
    is_deleted boolean not null default false,
    deleted_at timestamptz null,
    deleted_by uuid null,

    constraint fk_vendor_profiles_vendor
        foreign key (vendor_id) references public.vendors(id)
);

create index if not exists ix_vendor_profiles_vendor_id on public.vendor_profiles(vendor_id);
create index if not exists ix_vendor_profiles_city_state on public.vendor_profiles(city, state);

drop trigger if exists trg_vendor_profiles_set_audit_columns on public.vendor_profiles;
create trigger trg_vendor_profiles_set_audit_columns
before insert or update on public.vendor_profiles
for each row execute function public.fn_set_audit_columns();

drop trigger if exists trg_vendor_profiles_write_audit_log on public.vendor_profiles;
create trigger trg_vendor_profiles_write_audit_log
after insert or update or delete on public.vendor_profiles
for each row execute function audit.fn_write_audit_log();
