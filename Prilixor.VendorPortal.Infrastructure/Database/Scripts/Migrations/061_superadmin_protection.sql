-- Migration 061: Protected SuperAdmin users (max 2 system SuperAdmins)
-- Apply against admin_portal_db

alter table public.admin_users
  add column if not exists is_system_user boolean not null default false;

alter table public.admin_users
  add column if not exists must_change_password boolean not null default false;

create index if not exists ix_admin_users_is_system_user
  on public.admin_users(is_system_user)
  where is_system_user = true;

-- Mark any existing super_admin users as system users (up to first 2)
with ranked as (
  select id,
         row_number() over (order by created_at) as rn
  from public.admin_users
  where coalesce(is_deleted, false) = false
    and lower(role) = 'super_admin'
)
update public.admin_users u
set is_system_user = true
from ranked r
where u.id = r.id
  and r.rn <= 2;
