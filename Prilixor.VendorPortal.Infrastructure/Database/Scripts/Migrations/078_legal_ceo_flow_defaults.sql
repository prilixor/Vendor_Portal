-- ----------------------------------------------------
-- Migration: 078_legal_ceo_flow_defaults.sql
-- Target Database: common_portal_db
-- Description: Checkout accept required; rental visible to vendors;
--              signed_name on acceptances. Does not overwrite admin-edited cells.
-- Execution: psql -d common_portal_db -f 078_legal_ceo_flow_defaults.sql
-- ----------------------------------------------------

\c common_portal_db

ALTER TABLE public.legal_acceptances
    ADD COLUMN IF NOT EXISTS signed_name varchar(200);

UPDATE public.legal_document_placements p
SET is_required_to_proceed = true,
    is_visible = true,
    updated_at = now()
FROM public.legal_documents d
WHERE p.document_id = d.id
  AND p.is_deleted = false
  AND d.is_deleted = false
  AND p.updated_by IS NULL
  AND p.screen = 'checkout'
  AND p.surface IN ('customer_web', 'customer_mobile')
  AND d.document_type IN (
      'rental-and-purchase-policy',
      'cancellation-refund-policy',
      'shipping-delivery-policy');

UPDATE public.legal_document_placements p
SET is_visible = true,
    is_required_to_proceed = false,
    updated_at = now()
FROM public.legal_documents d
WHERE p.document_id = d.id
  AND p.is_deleted = false
  AND d.is_deleted = false
  AND p.updated_by IS NULL
  AND d.document_type = 'rental-and-purchase-policy'
  AND p.surface IN ('vendor_web', 'vendor_mobile')
  AND p.screen IN ('footer', 'profile_settings', 'onboarding', 'vendor_dashboard', 'legal_hub');
