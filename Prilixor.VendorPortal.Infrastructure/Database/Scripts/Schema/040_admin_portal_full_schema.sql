-- Fresh full schema for admin_portal_db
-- Run on: admin_portal_db

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.admin_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email varchar(255) NOT NULL UNIQUE,
    password_hash text NOT NULL,
    full_name varchar(255) NOT NULL,
    phone varchar(20) NULL,
    phone_verified_at timestamptz NULL,
    role varchar(40) NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    last_login_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL,
    CONSTRAINT chk_admin_users_role
        CHECK (role IN ('super_admin', 'verifier', 'operations_admin', 'admin'))
);

CREATE INDEX IF NOT EXISTS ix_admin_users_role
    ON public.admin_users(role);

CREATE INDEX IF NOT EXISTS ix_admin_users_is_active
    ON public.admin_users(is_active);

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id uuid NOT NULL,
    action_type varchar(50) NOT NULL,
    entity_type varchar(100) NOT NULL,
    entity_id uuid NULL,
    old_value jsonb NULL,
    new_value jsonb NULL,
    notes text NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL,
    CONSTRAINT fk_admin_audit_logs_admin_user
        FOREIGN KEY (admin_user_id) REFERENCES public.admin_users(id)
);

CREATE INDEX IF NOT EXISTS ix_admin_audit_logs_admin_user_id
    ON public.admin_audit_logs(admin_user_id);

CREATE INDEX IF NOT EXISTS ix_admin_audit_logs_entity
    ON public.admin_audit_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS ix_admin_audit_logs_created_at
    ON public.admin_audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email varchar(255) NOT NULL,
    token varchar(255) NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    is_used boolean NOT NULL DEFAULT false,
    used_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_email
    ON public.password_reset_tokens(email);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token
    ON public.password_reset_tokens(token);
