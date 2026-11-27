-- Remove the customer's free-text note from old vendor emergency alerts - VENDOR portal database.
-- Target database: vendor_portal_db
-- Execution: psql -d vendor_portal_db -f 093_strip_emergency_note_from_vendor_notifications_vendor.sql
-- Safe to run more than once.
--
-- Vendors no longer receive the customer's free-text emergency note (it can contain phone numbers
-- or addresses). Alerts created before that change ended with " Note: <text>"; this cuts that part off.

BEGIN;

UPDATE public.vendor_notifications
SET message = regexp_replace(message, '\s+Note:.*$', '', 's')
WHERE notification_type = 'equipment_emergency'
  AND message ~ '\sNote:';

COMMIT;
