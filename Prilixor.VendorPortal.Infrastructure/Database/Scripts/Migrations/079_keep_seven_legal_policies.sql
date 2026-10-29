-- ----------------------------------------------------
-- Migration: 079_keep_seven_legal_policies.sql
-- Target Database: common_portal_db
-- Description: Stay with the drafted 7 policies. Hide any extra
--              onboarding-agreement row. Vendor / Seller Policy is
--              required at onboarding e-sign.
-- Execution: psql -d common_portal_db -f 079_keep_seven_legal_policies.sql
-- ----------------------------------------------------

\c common_portal_db

UPDATE public.legal_documents
SET is_deleted = true,
    deleted_at = now(),
    updated_at = now()
WHERE is_deleted = false
  AND (document_type = 'vendor-onboarding-agreement' OR slug = 'vendor-onboarding-agreement');

UPDATE public.legal_document_placements p
SET is_required_to_proceed = true,
    is_visible = true,
    updated_at = now()
FROM public.legal_documents d
WHERE p.document_id = d.id
  AND p.is_deleted = false
  AND d.is_deleted = false
  AND p.updated_by IS NULL
  AND d.document_type = 'vendor-seller-policy'
  AND p.surface IN ('vendor_web', 'vendor_mobile')
  AND p.screen = 'onboarding';
