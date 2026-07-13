-- Run on: common_portal_db

CREATE TABLE IF NOT EXISTS public.hospitals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(255) NOT NULL,
    address_line_1 varchar(500) NULL,
    city varchar(120) NULL,
    state varchar(120) NULL,
    postal_code varchar(20) NULL,
    is_verified boolean NOT NULL DEFAULT true,
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL
);

CREATE TABLE IF NOT EXISTS public.doctors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name varchar(200) NOT NULL,
    specialization varchar(150) NULL,
    contact_number varchar(30) NULL,
    is_verified boolean NOT NULL DEFAULT true,
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL
);

CREATE TABLE IF NOT EXISTS public.hospital_doctors (
    hospital_id uuid NOT NULL REFERENCES public.hospitals(id),
    doctor_id uuid NOT NULL REFERENCES public.doctors(id),
    PRIMARY KEY (hospital_id, doctor_id)
);


-- ==========================================
-- Run on: customer_portal_db
-- ==========================================

CREATE TABLE IF NOT EXISTS public.customer_order_doctor_references (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_rental_order_id uuid NOT NULL REFERENCES public.customer_rental_orders(id),
    doctor_id uuid NOT NULL,     -- Logical FK to doctors table in common DB
    hospital_id uuid NOT NULL,   -- Logical FK to hospitals table in common DB
    contact_number varchar(30) NULL,
    reference_number varchar(100) NULL,
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL
);
