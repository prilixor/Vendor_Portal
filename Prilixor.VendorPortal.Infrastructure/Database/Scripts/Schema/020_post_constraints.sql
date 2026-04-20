-- Post-creation constraints that depend on later tables.
-- Run this after 019_admin_audit_logs.sql

do $$
begin
    if not exists (
        select 1
        from information_schema.table_constraints
        where constraint_schema = 'public'
          and table_name = 'vendor_verification_requests'
          and constraint_name = 'fk_vendor_verification_requests_reviewed_by_admin'
    ) then
        alter table public.vendor_verification_requests
            add constraint fk_vendor_verification_requests_reviewed_by_admin
            foreign key (reviewed_by) references public.admin_users(id);
    end if;
end $$;
