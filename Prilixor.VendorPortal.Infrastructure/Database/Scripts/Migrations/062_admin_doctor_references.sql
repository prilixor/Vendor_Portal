-- Migration 062: Admin-owned doctor references
-- Removes customer-crowdsourced hospital directory; doctors get unique_code + email.
-- Apply via psql (script switches databases). Safe on fresh installs after 053.

-- ---------------------------------------------------------------------------
-- customer_portal_db: clear order refs, then drop hospital/contact columns
-- ---------------------------------------------------------------------------
\c customer_portal_db

DELETE FROM public.customer_order_doctor_references;

ALTER TABLE public.customer_order_doctor_references
    DROP COLUMN IF EXISTS hospital_id;

ALTER TABLE public.customer_order_doctor_references
    DROP COLUMN IF EXISTS contact_number;

ALTER TABLE public.customer_order_doctor_references
    DROP COLUMN IF EXISTS reference_number;

CREATE INDEX IF NOT EXISTS ix_customer_order_doctor_references_order_id
    ON public.customer_order_doctor_references(customer_rental_order_id);

CREATE INDEX IF NOT EXISTS ix_customer_order_doctor_references_doctor_id
    ON public.customer_order_doctor_references(doctor_id);

-- ---------------------------------------------------------------------------
-- common_portal_db: drop hospitals, reshape doctors
-- ---------------------------------------------------------------------------
\c common_portal_db

DROP TABLE IF EXISTS public.hospital_doctors;
DROP TABLE IF EXISTS public.hospitals;

-- Clear legacy crowd-sourced doctors before enforcing unique_code/email
DELETE FROM public.doctors;

ALTER TABLE public.doctors
    ADD COLUMN IF NOT EXISTS unique_code varchar(20);

ALTER TABLE public.doctors
    ADD COLUMN IF NOT EXISTS email varchar(255);

ALTER TABLE public.doctors
    ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

UPDATE public.doctors
SET unique_code = 'DRXX' || to_char(created_at, 'YY') || upper(substr(replace(id::text, '-', ''), 1, 3))
WHERE unique_code IS NULL OR btrim(unique_code) = '';

UPDATE public.doctors
SET email = coalesce(nullif(btrim(email), ''), 'unknown@invalid.local')
WHERE email IS NULL OR btrim(email) = '';

ALTER TABLE public.doctors
    ALTER COLUMN unique_code SET NOT NULL;

ALTER TABLE public.doctors
    ALTER COLUMN email SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_doctors_unique_code
    ON public.doctors (unique_code)
    WHERE coalesce(is_deleted, false) = false;

CREATE INDEX IF NOT EXISTS ix_doctors_email
    ON public.doctors (lower(email));
