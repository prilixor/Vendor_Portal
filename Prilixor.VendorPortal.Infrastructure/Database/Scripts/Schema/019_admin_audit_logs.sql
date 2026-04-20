-- Table 19: admin_audit_logs
-- Tracks admin actions on vendor-side entities.

create table if not exists public.admin_audit_logs (
    id uuid primary key default gen_random_uuid(),
    admin_user_id uuid not null,
    action_type varchar(50) not null,
    entity_type varchar(100) not null,
    entity_id uuid null,
    old_value jsonb null,
    new_value jsonb null,
    notes text null,

    -- Audit columns
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    created_by uuid null,
    updated_by uuid null,
    is_deleted boolean not null default false,
    deleted_at timestamptz null,
    deleted_by uuid null,

    constraint fk_admin_audit_logs_admin_user
        foreign key (admin_user_id) references public.admin_users(id)
);

create index if not exists ix_admin_audit_logs_admin_user_id
    on public.admin_audit_logs(admin_user_id);

create index if not exists ix_admin_audit_logs_entity
    on public.admin_audit_logs(entity_type, entity_id);

create index if not exists ix_admin_audit_logs_created_at
    on public.admin_audit_logs(created_at desc);

drop trigger if exists trg_admin_audit_logs_set_audit_columns on public.admin_audit_logs;
create trigger trg_admin_audit_logs_set_audit_columns
before insert or update on public.admin_audit_logs
for each row execute function public.fn_set_audit_columns();

drop trigger if exists trg_admin_audit_logs_write_audit_log on public.admin_audit_logs;
create trigger trg_admin_audit_logs_write_audit_log
after insert or update or delete on public.admin_audit_logs
for each row execute function audit.fn_write_audit_log();
