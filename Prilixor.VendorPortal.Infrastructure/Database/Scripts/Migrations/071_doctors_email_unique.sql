-- Migration 071: One active doctor per email.
-- Contact number is NOT unique — two doctors at the same hospital may share the clinic line.
-- Run on: common_portal_db
--
-- If this index fails, find duplicates first:
--   SELECT lower(btrim(email)) AS e, count(*) FROM doctors
--   WHERE coalesce(is_deleted, false) = false
--   GROUP BY 1 HAVING count(*) > 1;

\c common_portal_db

DROP INDEX IF EXISTS ux_doctors_email_active;

CREATE UNIQUE INDEX ux_doctors_email_active
    ON public.doctors (lower(btrim(email)))
    WHERE coalesce(is_deleted, false) = false;
