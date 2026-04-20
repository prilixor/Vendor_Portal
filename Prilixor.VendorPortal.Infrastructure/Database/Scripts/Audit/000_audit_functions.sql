-- Shared audit setup for DB-first PostgreSQL scripts.
-- Run this before table scripts.

create extension if not exists pgcrypto;

create schema if not exists audit;

create table if not exists audit.audit_logs (
    id bigserial primary key,
    table_name text not null,
    record_id uuid null,
    operation text not null,
    old_data jsonb null,
    new_data jsonb null,
    changed_at timestamptz not null default now(),
    changed_by uuid null
);

create or replace function public.fn_set_audit_columns()
returns trigger
language plpgsql
as $$
declare
    v_actor uuid;
begin
    -- Application can set this per request/session:
    -- select set_config('app.current_user_id', '<uuid>', true);
    v_actor := nullif(current_setting('app.current_user_id', true), '')::uuid;

    if tg_op = 'INSERT' then
        new.created_at := coalesce(new.created_at, now());
        new.updated_at := now();
        new.created_by := coalesce(new.created_by, v_actor);
        new.updated_by := coalesce(new.updated_by, v_actor);
        return new;
    end if;

    if tg_op = 'UPDATE' then
        new.updated_at := now();
        new.updated_by := coalesce(v_actor, new.updated_by, old.updated_by);

        if coalesce(new.is_deleted, false) = true and coalesce(old.is_deleted, false) = false then
            new.deleted_at := coalesce(new.deleted_at, now());
            new.deleted_by := coalesce(new.deleted_by, v_actor);
        end if;

        return new;
    end if;

    return new;
end;
$$;

create or replace function audit.fn_write_audit_log()
returns trigger
language plpgsql
as $$
declare
    v_actor uuid;
    v_record_id uuid;
begin
    v_actor := nullif(current_setting('app.current_user_id', true), '')::uuid;

    if tg_op = 'INSERT' then
        v_record_id := (to_jsonb(new)->>'id')::uuid;
        insert into audit.audit_logs(table_name, record_id, operation, old_data, new_data, changed_by)
        values (tg_table_name, v_record_id, tg_op, null, to_jsonb(new), v_actor);
        return new;
    elsif tg_op = 'UPDATE' then
        v_record_id := (to_jsonb(new)->>'id')::uuid;
        insert into audit.audit_logs(table_name, record_id, operation, old_data, new_data, changed_by)
        values (tg_table_name, v_record_id, tg_op, to_jsonb(old), to_jsonb(new), v_actor);
        return new;
    else
        v_record_id := (to_jsonb(old)->>'id')::uuid;
        insert into audit.audit_logs(table_name, record_id, operation, old_data, new_data, changed_by)
        values (tg_table_name, v_record_id, tg_op, to_jsonb(old), null, v_actor);
        return old;
    end if;
end;
$$;
