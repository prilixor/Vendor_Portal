-- Table 18: admin_users
-- Admin login and role table.

create table if not exists public.admin_users (
    id uuid primary key default gen_random_uuid(),
    email varchar(255) not null unique,
    password_hash text not null,
    full_name varchar(255) not null,
    role varchar(40) not null,
    is_active boolean not null default true,
    last_login_at timestamptz null,

    -- Audit columns
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    created_by uuid null,
    updated_by uuid null,
    is_deleted boolean not null default false,
    deleted_at timestamptz null,
    deleted_by uuid null,

    constraint chk_admin_users_role
        check (role in ('super_admin', 'verifier', 'operations_admin'))
);

create index if not exists ix_admin_users_role
    on public.admin_users(role);

create index if not exists ix_admin_users_is_active
    on public.admin_users(is_active);

drop trigger if exists trg_admin_users_set_audit_columns on public.admin_users;
create trigger trg_admin_users_set_audit_columns
before insert or update on public.admin_users
for each row execute function public.fn_set_audit_columns();

drop trigger if exists trg_admin_users_write_audit_log on public.admin_users;
create trigger trg_admin_users_write_audit_log
after insert or update or delete on public.admin_users
for each row execute function audit.fn_write_audit_log();
