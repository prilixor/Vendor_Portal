-- ----------------------------------------------------
-- Migration: 081_legal_vidit_pdf_placement_align.sql
-- Target Database: common_portal_db
-- Description: Align placements with BlinksMed_7_Policies_Web_Check.pdf
--              (Vidit walkthrough): Grievance on customer Settings;
--              keep vendor Cancellation/Shipping hidden.
--              Does not overwrite cells an admin has already saved.
-- Execution: psql -d common_portal_db -f 081_legal_vidit_pdf_placement_align.sql
-- ----------------------------------------------------

\c common_portal_db

-- Customer Settings must show Grievance (PDF §3 Footer / Settings).
UPDATE public.legal_document_placements p
SET is_visible = true,
    is_required_to_proceed = false,
    updated_at = now()
FROM public.legal_documents d
WHERE p.document_id = d.id
  AND p.is_deleted = false
  AND d.is_deleted = false
  AND p.updated_by IS NULL
  AND d.document_type = 'grievance-redressal-policy'
  AND p.surface IN ('customer_web', 'customer_mobile')
  AND p.screen = 'profile_settings';

INSERT INTO public.legal_document_placements (
    id, document_id, surface, screen, is_visible, is_required_to_proceed, sort_order,
    created_at, updated_at, is_deleted
)
SELECT
    gen_random_uuid(),
    d.id,
    s.surface,
    'profile_settings',
    true,
    false,
    70,
    now(),
    now(),
    false
FROM public.legal_documents d
CROSS JOIN (VALUES ('customer_web'), ('customer_mobile')) AS s(surface)
WHERE d.is_deleted = false
  AND d.document_type = 'grievance-redressal-policy'
  AND NOT EXISTS (
      SELECT 1
      FROM public.legal_document_placements p
      WHERE p.document_id = d.id
        AND p.surface = s.surface
        AND p.screen = 'profile_settings'
        AND p.is_deleted = false
  );

-- Vendor must not see Cancellation / Shipping (PDF §4).
UPDATE public.legal_document_placements p
SET is_visible = false,
    is_required_to_proceed = false,
    updated_at = now()
FROM public.legal_documents d
WHERE p.document_id = d.id
  AND p.is_deleted = false
  AND d.is_deleted = false
  AND p.updated_by IS NULL
  AND d.document_type IN ('cancellation-refund-policy', 'shipping-delivery-policy')
  AND p.surface IN ('vendor_web', 'vendor_mobile');
