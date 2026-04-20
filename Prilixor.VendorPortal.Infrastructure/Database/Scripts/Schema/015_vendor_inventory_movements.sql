-- Table 15: vendor_inventory_movements
-- Inventory movement audit trail.

create table if not exists public.vendor_inventory_movements (
    id uuid primary key default gen_random_uuid(),
    vendor_inventory_id uuid not null,
    movement_type varchar(40) not null,
    quantity integer not null,
    reference_type varchar(50) null,
    reference_id uuid null,
    notes text null,

    -- Audit columns
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    created_by uuid null,
    updated_by uuid null,
    is_deleted boolean not null default false,
    deleted_at timestamptz null,
    deleted_by uuid null,

    constraint fk_vendor_inventory_movements_inventory
        foreign key (vendor_inventory_id) references public.vendor_inventory(id),
    constraint chk_vendor_inventory_movements_type
        check (movement_type in (
            'stock_added',
            'stock_removed',
            'reserved',
            'reservation_released',
            'rented',
            'returned',
            'blocked',
            'unblocked',
            'corrected'
        )),
    constraint chk_vendor_inventory_movements_quantity
        check (quantity > 0)
);

create index if not exists ix_vendor_inventory_movements_inventory_id
    on public.vendor_inventory_movements(vendor_inventory_id);

create index if not exists ix_vendor_inventory_movements_created_at
    on public.vendor_inventory_movements(created_at desc);

drop trigger if exists trg_vendor_inventory_movements_set_audit_columns on public.vendor_inventory_movements;
create trigger trg_vendor_inventory_movements_set_audit_columns
before insert or update on public.vendor_inventory_movements
for each row execute function public.fn_set_audit_columns();

drop trigger if exists trg_vendor_inventory_movements_write_audit_log on public.vendor_inventory_movements;
create trigger trg_vendor_inventory_movements_write_audit_log
after insert or update or delete on public.vendor_inventory_movements
for each row execute function audit.fn_write_audit_log();
