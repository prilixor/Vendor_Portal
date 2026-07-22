-- Migration 063: Admin-owned hospitals (address + map) and M:N doctor links
-- Apply via psql (script switches to common_portal_db).

\c common_portal_db

CREATE TABLE IF NOT EXISTS public.hospitals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(255) NOT NULL,
    address_line_1 varchar(500) NULL,
    city varchar(120) NULL,
    state varchar(120) NULL,
    postal_code varchar(20) NULL,
    latitude numeric(9,6) NULL,
    longitude numeric(9,6) NULL,
    contact_number varchar(30) NULL,
    is_active boolean NOT NULL DEFAULT true,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL
);

-- If hospitals already existed without map columns (unlikely after 062 drop), add them
ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS latitude numeric(9,6);
ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS longitude numeric(9,6);
ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS contact_number varchar(30);
ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.hospital_doctors (
    hospital_id uuid NOT NULL REFERENCES public.hospitals(id),
    doctor_id uuid NOT NULL REFERENCES public.doctors(id),
    PRIMARY KEY (hospital_id, doctor_id)
);

CREATE INDEX IF NOT EXISTS ix_hospital_doctors_doctor_id
    ON public.hospital_doctors(doctor_id);

CREATE INDEX IF NOT EXISTS ix_hospitals_name
    ON public.hospitals (lower(name));
