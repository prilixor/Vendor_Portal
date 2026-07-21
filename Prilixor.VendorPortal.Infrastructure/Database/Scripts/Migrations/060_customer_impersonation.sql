-- Migration 060: Support customer portal impersonation exchanges
-- Apply against admin_portal_db

alter table public.admin_impersonation_exchanges
  add column if not exists target_type varchar(20) not null default 'vendor';

alter table public.admin_impersonation_exchanges
  add column if not exists customer_id uuid null;

-- Allow vendor_id to be null for customer-targeted exchanges
alter table public.admin_impersonation_exchanges
  alter column vendor_id drop not null;

alter table public.admin_impersonation_exchanges
  drop constraint if exists chk_admin_impersonation_target;

alter table public.admin_impersonation_exchanges
  add constraint chk_admin_impersonation_target
  check (
    (target_type = 'vendor' and vendor_id is not null) or
    (target_type = 'customer' and customer_id is not null)
  );

create index if not exists ix_admin_impersonation_exchanges_customer_id
  on public.admin_impersonation_exchanges(customer_id)
  where customer_id is not null;

-- Seed customers.impersonate permission
insert into public.admin_permissions (id, code, name, description, category)
values (
  'b1000000-0000-4000-8000-000000000010',
  'customers.impersonate',
  'Impersonate Customer',
  'Open Customer Portal as a customer',
  'Customers'
)
on conflict (code) do nothing;

-- Grant to super_admin
insert into public.admin_role_permissions (role_id, permission_id)
select 'a1000000-0000-4000-8000-000000000001', p.id
from public.admin_permissions p
where p.code = 'customers.impersonate'
on conflict do nothing;

-- Grant to operations_admin
insert into public.admin_role_permissions (role_id, permission_id)
select 'a1000000-0000-4000-8000-000000000003', p.id
from public.admin_permissions p
where p.code = 'customers.impersonate'
on conflict do nothing;
