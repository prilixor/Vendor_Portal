-- Equipment Emergency feature - complete script for the CUSTOMER portal database.
-- Target database: customer_portal_db
-- Execution: psql -d customer_portal_db -f 091_equipment_emergency_customer.sql
-- Safe to run more than once. Run the matching _vendor and _common scripts on their databases too.
--
-- Emergency cases raised from a delivered customer order.
-- Status flow: open -> acknowledged -> resolved.
-- One live (open or acknowledged) emergency per order; a new one is allowed after it is resolved.

BEGIN;

CREATE TABLE IF NOT EXISTS public.customer_order_emergencies (
    id uuid PRIMARY KEY,
    customer_rental_order_id uuid NOT NULL REFERENCES public.customer_rental_orders(id),
    customer_id uuid NOT NULL REFERENCES public.customers(id),
    vendor_id uuid NOT NULL,
    order_number varchar(120) NOT NULL,
    customer_name varchar(200) NOT NULL,
    customer_phone varchar(40) NULL,
    vendor_name varchar(200) NOT NULL,
    product_name varchar(300) NOT NULL,
    reason varchar(40) NOT NULL,
    note text NULL,
    status varchar(20) NOT NULL DEFAULT 'open',
    vendor_notified boolean NOT NULL DEFAULT false,
    acknowledged_at timestamptz NULL,
    acknowledged_by_admin_id uuid NULL,
    resolved_at timestamptz NULL,
    resolved_by_admin_id uuid NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL
);

-- Databases that already have the table from an earlier build get the Resolve columns here.
ALTER TABLE public.customer_order_emergencies
    ADD COLUMN IF NOT EXISTS resolved_at timestamptz NULL,
    ADD COLUMN IF NOT EXISTS resolved_by_admin_id uuid NULL;

-- Earlier builds allowed an acknowledged emergency and a new open one on the same order.
-- Keep only the newest live emergency per order; close older duplicates as resolved.
UPDATE public.customer_order_emergencies e
SET status = 'resolved',
    resolved_at = COALESCE(e.resolved_at, now()),
    updated_at = now()
WHERE e.status IN ('open', 'acknowledged')
  AND COALESCE(e.is_deleted, false) = false
  AND EXISTS (
      SELECT 1
      FROM public.customer_order_emergencies newer
      WHERE newer.customer_rental_order_id = e.customer_rental_order_id
        AND newer.status IN ('open', 'acknowledged')
        AND COALESCE(newer.is_deleted, false) = false
        AND (newer.created_at > e.created_at
             OR (newer.created_at = e.created_at AND newer.id > e.id))
  );

CREATE INDEX IF NOT EXISTS ix_customer_order_emergencies_status_created
    ON public.customer_order_emergencies (status, created_at DESC)
    WHERE COALESCE(is_deleted, false) = false;

-- Old rule (open only) is replaced by "open or acknowledged".
DROP INDEX IF EXISTS public.ux_customer_order_emergencies_one_open;

CREATE UNIQUE INDEX IF NOT EXISTS ux_customer_order_emergencies_one_active
    ON public.customer_order_emergencies (customer_rental_order_id)
    WHERE status IN ('open', 'acknowledged') AND COALESCE(is_deleted, false) = false;

-- The API connects as "blinksmed" in production, but this script is run as postgres.
-- Without this grant the API fails with "permission denied for table customer_order_emergencies".
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'blinksmed') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_order_emergencies TO blinksmed;
    END IF;
END
$$;

COMMIT;
