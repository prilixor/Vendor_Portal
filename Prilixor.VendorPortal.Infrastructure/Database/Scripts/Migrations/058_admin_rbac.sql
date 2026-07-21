-- Migration 058: Admin RBAC (roles, permissions) + impersonation exchange codes
-- Apply against admin_portal_db

-- Roles
create table if not exists public.admin_roles (
    id uuid primary key default gen_random_uuid(),
    code varchar(64) not null unique,
    name varchar(120) not null,
    description varchar(500) null,
    is_system boolean not null default false,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    created_by uuid null,
    updated_by uuid null,
    is_deleted boolean not null default false,
    deleted_at timestamptz null,
    deleted_by uuid null
);

-- Permissions catalog
create table if not exists public.admin_permissions (
    id uuid primary key default gen_random_uuid(),
    code varchar(80) not null unique,
    name varchar(120) not null,
    description varchar(500) null,
    category varchar(80) not null default 'General',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    created_by uuid null,
    updated_by uuid null
);

create table if not exists public.admin_role_permissions (
    role_id uuid not null references public.admin_roles(id) on delete cascade,
    permission_id uuid not null references public.admin_permissions(id) on delete cascade,
    primary key (role_id, permission_id)
);

-- Impersonation one-time exchange codes
create table if not exists public.admin_impersonation_exchanges (
    id uuid primary key default gen_random_uuid(),
    code_hash text not null,
    admin_user_id uuid not null references public.admin_users(id),
    vendor_id uuid not null,
    expires_at timestamptz not null,
    consumed_at timestamptz null,
    is_consumed boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    created_by uuid null,
    updated_by uuid null
);

create index if not exists ix_admin_impersonation_exchanges_code_hash
    on public.admin_impersonation_exchanges(code_hash);

-- Link admin_users to roles
alter table public.admin_users
    add column if not exists role_id uuid null references public.admin_roles(id);

-- Drop legacy CHECK so custom roles can use free-form codes mirrored in admin_users.role
alter table public.admin_users drop constraint if exists chk_admin_users_role;

-- Optional order attribution for admin-placed orders (customer DB may differ; add if table exists)
-- See companion note in README; customer orders column added in same migration when applicable.

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'customer_orders'
  ) then
    alter table public.customer_orders
      add column if not exists placed_by_admin_id uuid null;
  end if;
exception when others then
  null;
end $$;

-- Seed system roles (fixed UUIDs for stable references)
insert into public.admin_roles (id, code, name, description, is_system, is_active)
values
  ('a1000000-0000-4000-8000-000000000001', 'super_admin', 'Super Admin', 'Full access; manage roles and admins', true, true),
  ('a1000000-0000-4000-8000-000000000002', 'verifier', 'Verifier', 'Vendor verification', true, true),
  ('a1000000-0000-4000-8000-000000000003', 'operations_admin', 'Operations Admin', 'Orders and support operations', true, true)
on conflict (code) do nothing;

-- Seed permissions
insert into public.admin_permissions (id, code, name, description, category)
values
  ('b1000000-0000-4000-8000-000000000001', 'dashboard.view', 'View Dashboard', 'Access admin dashboard', 'Overview'),
  ('b1000000-0000-4000-8000-000000000002', 'notifications.view', 'View Notifications', 'Access admin notifications', 'Overview'),
  ('b1000000-0000-4000-8000-000000000003', 'orders.view', 'View Orders', 'View all orders', 'Orders'),
  ('b1000000-0000-4000-8000-000000000004', 'orders.manage', 'Manage Orders', 'Update status, reassign, cancel/refund', 'Orders'),
  ('b1000000-0000-4000-8000-000000000005', 'vendors.view', 'View Vendors', 'List and view vendor details', 'Vendors'),
  ('b1000000-0000-4000-8000-000000000006', 'vendors.verify', 'Verify Vendors', 'Verification queue and document checks', 'Vendors'),
  ('b1000000-0000-4000-8000-000000000007', 'vendors.manage', 'Manage Vendors', 'Suspend, ban, reactivate', 'Vendors'),
  ('b1000000-0000-4000-8000-000000000008', 'vendors.impersonate', 'Impersonate Vendor', 'Open Vendor Portal as a vendor', 'Vendors'),
  ('b1000000-0000-4000-8000-000000000009', 'catalog.manage', 'Manage Catalog', 'Products and chemicals', 'Catalog'),
  ('b1000000-0000-4000-8000-00000000000a', 'admins.manage', 'Manage Admin Users', 'Create and manage admin accounts', 'System'),
  ('b1000000-0000-4000-8000-00000000000b', 'roles.manage', 'Manage Roles', 'Create roles and assign permissions', 'System'),
  ('b1000000-0000-4000-8000-00000000000c', 'customers.view', 'View Customers', 'Customer directory', 'Customers'),
  ('b1000000-0000-4000-8000-00000000000d', 'customers.place_order', 'Place Order for Customer', 'Create orders on behalf of customers', 'Customers'),
  ('b1000000-0000-4000-8000-00000000000e', 'audit.view', 'View Audit Logs', 'Read admin audit logs', 'System'),
  ('b1000000-0000-4000-8000-00000000000f', 'support.manage', 'Manage Support', 'Admin support tickets', 'System')
on conflict (code) do nothing;

-- Map all permissions to super_admin
insert into public.admin_role_permissions (role_id, permission_id)
select 'a1000000-0000-4000-8000-000000000001', p.id
from public.admin_permissions p
on conflict do nothing;

-- verifier permissions
insert into public.admin_role_permissions (role_id, permission_id)
select 'a1000000-0000-4000-8000-000000000002', p.id
from public.admin_permissions p
where p.code in ('dashboard.view', 'notifications.view', 'vendors.view', 'vendors.verify', 'audit.view')
on conflict do nothing;

-- operations_admin permissions
insert into public.admin_role_permissions (role_id, permission_id)
select 'a1000000-0000-4000-8000-000000000003', p.id
from public.admin_permissions p
where p.code in (
  'dashboard.view', 'notifications.view', 'orders.view', 'orders.manage', 'vendors.view',
  'customers.view', 'customers.place_order', 'support.manage', 'audit.view'
)
on conflict do nothing;

-- Backfill admin_users.role_id from legacy role string
update public.admin_users u
set role_id = r.id
from public.admin_roles r
where u.role_id is null
  and lower(u.role) = r.code;

-- Default unknown roles to operations_admin
update public.admin_users u
set role_id = 'a1000000-0000-4000-8000-000000000003',
    role = 'operations_admin'
where u.role_id is null
  and coalesce(u.is_deleted, false) = false;
