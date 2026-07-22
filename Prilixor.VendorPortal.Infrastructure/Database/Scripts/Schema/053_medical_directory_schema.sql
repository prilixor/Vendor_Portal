-- Medical directory schema (dual-DB) — Admin-owned doctors + hospitals
-- common_portal_db: doctors, hospitals, hospital_doctors
-- customer_portal_db: customer_order_doctor_references (doctor only)

\c common_portal_db

CREATE TABLE IF NOT EXISTS public.doctors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name varchar(200) NOT NULL,
    unique_code varchar(20) NOT NULL,
    email varchar(255) NOT NULL,
    specialization varchar(150) NULL,
    contact_number varchar(30) NULL,
    is_active boolean NOT NULL DEFAULT true,
    is_verified boolean NOT NULL DEFAULT true,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_doctors_unique_code
    ON public.doctors (unique_code)
    WHERE coalesce(is_deleted, false) = false;

CREATE INDEX IF NOT EXISTS ix_doctors_email
    ON public.doctors (lower(email));

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

CREATE INDEX IF NOT EXISTS ix_hospitals_name
    ON public.hospitals (lower(name));

CREATE TABLE IF NOT EXISTS public.hospital_doctors (
    hospital_id uuid NOT NULL REFERENCES public.hospitals(id),
    doctor_id uuid NOT NULL REFERENCES public.doctors(id),
    PRIMARY KEY (hospital_id, doctor_id)
);

CREATE INDEX IF NOT EXISTS ix_hospital_doctors_doctor_id
    ON public.hospital_doctors(doctor_id);

\c customer_portal_db

CREATE TABLE IF NOT EXISTS public.customer_order_doctor_references (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_rental_order_id uuid NOT NULL REFERENCES public.customer_rental_orders(id),
    doctor_id uuid NOT NULL,     -- Logical FK to doctors table in common DB

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL
);

CREATE INDEX IF NOT EXISTS ix_customer_order_doctor_references_order_id
    ON public.customer_order_doctor_references(customer_rental_order_id);

CREATE INDEX IF NOT EXISTS ix_customer_order_doctor_references_doctor_id
    ON public.customer_order_doctor_references(doctor_id);
