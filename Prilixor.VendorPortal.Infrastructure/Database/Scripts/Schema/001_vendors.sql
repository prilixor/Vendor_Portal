-- Table 1: vendors
-- Root vendor account and authentication entry.
-- Includes relationship-safe status checks and full audit columns.

create table if not exists public.vendors (
    id uuid primary key default gen_random_uuid(),
    email varchar(255) not null unique,
    password_hash text not null,
    email_verified boolean not null default false,
    account_status varchar(30) not null default 'pending',
    registration_stage varchar(40) not null default 'email_registered',
    last_login_at timestamptz null,

    -- Audit columns
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    created_by uuid null,
    updated_by uuid null,
    is_deleted boolean not null default false,
    deleted_at timestamptz null,
    deleted_by uuid null,

    constraint chk_vendors_account_status
        check (account_status in ('pending', 'active', 'suspended', 'banned', 'rejected')),
    constraint chk_vendors_registration_stage
        check (registration_stage in (
            'email_registered',
            'profile_pending',
            'documents_pending',
            'under_review',
            'approved',
            'rejected'
        ))
);

create index if not exists ix_vendors_account_status on public.vendors(account_status);
create index if not exists ix_vendors_registration_stage on public.vendors(registration_stage);
create index if not exists ix_vendors_created_at on public.vendors(created_at);

drop trigger if exists trg_vendors_set_audit_columns on public.vendors;
create trigger trg_vendors_set_audit_columns
before insert or update on public.vendors
for each row execute function public.fn_set_audit_columns();

drop trigger if exists trg_vendors_write_audit_log on public.vendors;
create trigger trg_vendors_write_audit_log
after insert or update or delete on public.vendors
for each row execute function audit.fn_write_audit_log();
