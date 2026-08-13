-- Enforce unique customer phone (active rows only).
-- Clears duplicate phones keeping the earliest account per number, then adds unique index.

WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY phone
            ORDER BY created_at ASC NULLS LAST, id ASC
        ) AS rn
    FROM public.customers
    WHERE phone IS NOT NULL
      AND btrim(phone) <> ''
      AND COALESCE(is_deleted, false) = false
)
UPDATE public.customers c
SET
    phone = NULL,
    phone_verified_at = NULL
FROM ranked r
WHERE c.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS ux_customers_phone_active
    ON public.customers (phone)
    WHERE phone IS NOT NULL
      AND btrim(phone) <> ''
      AND COALESCE(is_deleted, false) = false;
