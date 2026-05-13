-- Add support_phone as source-of-truth to vendors and enforce uniqueness.
-- Backfill from vendor_profiles to preserve existing onboarding data.

alter table public.vendors
    add column if not exists support_phone varchar(20) null;

update public.vendors v
set support_phone = vp.support_phone
from public.vendor_profiles vp
where vp.vendor_id = v.id
  and (v.support_phone is null or btrim(v.support_phone) = '')
  and btrim(vp.support_phone) <> '';

create unique index if not exists uq_vendors_support_phone_active
    on public.vendors (support_phone)
    where support_phone is not null and is_deleted = false;

create index if not exists ix_vendors_support_phone
    on public.vendors (support_phone);
