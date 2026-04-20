-- Table 9: product_categories
-- Platform master categories.

create table if not exists public.product_categories (
    id uuid primary key default gen_random_uuid(),
    category_name varchar(150) not null unique,
    prescription_required boolean not null default false,
    deposit_required boolean not null default false,
    installation_required boolean not null default false,
    is_active boolean not null default true,

    -- Audit columns
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    created_by uuid null,
    updated_by uuid null,
    is_deleted boolean not null default false,
    deleted_at timestamptz null,
    deleted_by uuid null
);

create index if not exists ix_product_categories_is_active
    on public.product_categories(is_active);

drop trigger if exists trg_product_categories_set_audit_columns on public.product_categories;
create trigger trg_product_categories_set_audit_columns
before insert or update on public.product_categories
for each row execute function public.fn_set_audit_columns();

drop trigger if exists trg_product_categories_write_audit_log on public.product_categories;
create trigger trg_product_categories_write_audit_log
after insert or update or delete on public.product_categories
for each row execute function audit.fn_write_audit_log();
