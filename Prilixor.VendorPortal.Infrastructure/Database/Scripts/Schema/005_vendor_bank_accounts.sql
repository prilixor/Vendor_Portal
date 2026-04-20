-- Table 5: vendor_bank_accounts
-- Settlement bank details for vendors.

create table if not exists public.vendor_bank_accounts (
    id uuid primary key default gen_random_uuid(),
    vendor_id uuid not null,
    account_holder_name varchar(255) not null,
    bank_name varchar(255) not null,
    account_number varchar(100) not null,
    ifsc_code varchar(20) not null,
    verification_status varchar(30) not null default 'pending',
    verified_at timestamptz null,

    -- Audit columns
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    created_by uuid null,
    updated_by uuid null,
    is_deleted boolean not null default false,
    deleted_at timestamptz null,
    deleted_by uuid null,

    constraint fk_vendor_bank_accounts_vendor
        foreign key (vendor_id) references public.vendors(id),
    constraint chk_vendor_bank_accounts_verification_status
        check (verification_status in ('pending', 'approved', 'rejected'))
);

create index if not exists ix_vendor_bank_accounts_vendor_id
    on public.vendor_bank_accounts(vendor_id);

drop trigger if exists trg_vendor_bank_accounts_set_audit_columns on public.vendor_bank_accounts;
create trigger trg_vendor_bank_accounts_set_audit_columns
before insert or update on public.vendor_bank_accounts
for each row execute function public.fn_set_audit_columns();

drop trigger if exists trg_vendor_bank_accounts_write_audit_log on public.vendor_bank_accounts;
create trigger trg_vendor_bank_accounts_write_audit_log
after insert or update or delete on public.vendor_bank_accounts
for each row execute function audit.fn_write_audit_log();
