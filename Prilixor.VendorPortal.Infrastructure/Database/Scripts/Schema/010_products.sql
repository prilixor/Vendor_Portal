-- Table 10: products
-- Platform product master linked to categories.

create table if not exists public.products (
    id uuid primary key default gen_random_uuid(),
    category_id uuid not null,
    product_name varchar(255) not null,
    brand_name varchar(255) null,
    model_name varchar(255) null,
    short_description varchar(500) null,
    long_description text null,
    is_active boolean not null default true,

    -- Audit columns
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    created_by uuid null,
    updated_by uuid null,
    is_deleted boolean not null default false,
    deleted_at timestamptz null,
    deleted_by uuid null,

    constraint fk_products_category
        foreign key (category_id) references public.product_categories(id)
);

create index if not exists ix_products_category_id
    on public.products(category_id);

create index if not exists ix_products_is_active
    on public.products(is_active);

drop trigger if exists trg_products_set_audit_columns on public.products;
create trigger trg_products_set_audit_columns
before insert or update on public.products
for each row execute function public.fn_set_audit_columns();

drop trigger if exists trg_products_write_audit_log on public.products;
create trigger trg_products_write_audit_log
after insert or update or delete on public.products
for each row execute function audit.fn_write_audit_log();
