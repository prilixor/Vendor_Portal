-- ----------------------------------------------------
-- Migration: 077_legal_placement_screenshot_defaults.sql
-- Target Database: common_portal_db
-- Description: Align seeded placements with the build screenshot.
--              Refund/Shipping are display-only at checkout (not required).
--              Does not overwrite cells an admin has already saved.
-- Execution: psql -d common_portal_db -f 077_legal_placement_screenshot_defaults.sql
-- ----------------------------------------------------

\c common_portal_db

UPDATE public.legal_document_placements p
SET is_required_to_proceed = false,
    updated_at = now()
FROM public.legal_documents d
WHERE p.document_id = d.id
  AND p.is_deleted = false
  AND d.is_deleted = false
  AND d.document_type IN ('cancellation-refund-policy', 'shipping-delivery-policy')
  AND p.screen = 'checkout'
  AND p.is_required_to_proceed = true
  AND p.updated_by IS NULL;
