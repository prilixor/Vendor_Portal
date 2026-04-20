-- Table 16: vendor_notification_preferences
-- Vendor communication channel preferences.

create table if not exists public.vendor_notification_preferences (
    id uuid primary key default gen_random_uuid(),
    vendor_id uuid not null unique,
    email_notifications_enabled boolean not null default true,
    push_notifications_enabled boolean not null default true,
    new_order_notifications boolean not null default true,

    -- Audit columns
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    created_by uuid null,
    updated_by uuid null,
    is_deleted boolean not null default false,
    deleted_at timestamptz null,
    deleted_by uuid null,

    constraint fk_vendor_notification_preferences_vendor
        foreign key (vendor_id) references public.vendors(id)
);

create index if not exists ix_vendor_notification_preferences_vendor_id
    on public.vendor_notification_preferences(vendor_id);

drop trigger if exists trg_vendor_notification_preferences_set_audit_columns on public.vendor_notification_preferences;
create trigger trg_vendor_notification_preferences_set_audit_columns
before insert or update on public.vendor_notification_preferences
for each row execute function public.fn_set_audit_columns();

drop trigger if exists trg_vendor_notification_preferences_write_audit_log on public.vendor_notification_preferences;
create trigger trg_vendor_notification_preferences_write_audit_log
after insert or update or delete on public.vendor_notification_preferences
for each row execute function audit.fn_write_audit_log();
