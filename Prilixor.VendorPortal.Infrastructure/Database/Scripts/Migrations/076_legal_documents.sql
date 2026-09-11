-- ----------------------------------------------------
-- Migration: 076_legal_documents.sql
-- Target Database: common_portal_db
-- Description: Platform T&C CMS — documents, versions, placements, acceptances
-- Execution: psql -d common_portal_db -f 076_legal_documents.sql
-- Seed bodies: API copies published v1 from embedded markdown on first start
--              (Infrastructure/Database/Scripts/Seeds/legal/*.md)
-- ----------------------------------------------------

\c common_portal_db

CREATE TABLE IF NOT EXISTS public.legal_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug varchar(120) NOT NULL,
    document_type varchar(80) NOT NULL,
    title varchar(255) NOT NULL,
    audience varchar(32) NOT NULL DEFAULT 'both',
    summary text NULL,
    public_path varchar(255) NULL,
    sort_order int NOT NULL DEFAULT 0,
    is_required_acceptance boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_legal_documents_slug_active
    ON public.legal_documents(slug)
    WHERE is_deleted = false;

CREATE UNIQUE INDEX IF NOT EXISTS uq_legal_documents_type_active
    ON public.legal_documents(document_type)
    WHERE is_deleted = false;

CREATE TABLE IF NOT EXISTS public.legal_document_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id uuid NOT NULL REFERENCES public.legal_documents(id) ON DELETE CASCADE,
    version_number int NOT NULL,
    content_html text NOT NULL DEFAULT '',
    content_markdown text NULL,
    status varchar(20) NOT NULL DEFAULT 'draft',
    change_summary text NULL,
    is_material_change boolean NOT NULL DEFAULT false,
    effective_from timestamptz NOT NULL,
    published_at timestamptz NULL,
    published_by uuid NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_legal_document_versions_number
    ON public.legal_document_versions(document_id, version_number)
    WHERE is_deleted = false;

CREATE UNIQUE INDEX IF NOT EXISTS uq_legal_document_versions_one_published
    ON public.legal_document_versions(document_id)
    WHERE status = 'published' AND is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_legal_document_versions_status
    ON public.legal_document_versions(document_id, status, effective_from)
    WHERE is_deleted = false;

CREATE TABLE IF NOT EXISTS public.legal_document_placements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id uuid NOT NULL REFERENCES public.legal_documents(id) ON DELETE CASCADE,
    surface varchar(40) NOT NULL,
    screen varchar(40) NOT NULL,
    is_visible boolean NOT NULL DEFAULT false,
    is_required_to_proceed boolean NOT NULL DEFAULT false,
    sort_order int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_legal_document_placements_slot
    ON public.legal_document_placements(document_id, surface, screen)
    WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_legal_document_placements_surface_screen
    ON public.legal_document_placements(surface, screen, is_visible)
    WHERE is_deleted = false;

CREATE TABLE IF NOT EXISTS public.legal_acceptances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_type varchar(20) NOT NULL,
    actor_id uuid NOT NULL,
    document_id uuid NOT NULL REFERENCES public.legal_documents(id) ON DELETE RESTRICT,
    version_id uuid NOT NULL REFERENCES public.legal_document_versions(id) ON DELETE RESTRICT,
    accepted_at timestamptz NOT NULL DEFAULT now(),
    source_surface varchar(40) NOT NULL,
    source_screen varchar(40) NOT NULL,
    ip_address varchar(64) NULL,
    user_agent text NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL
);

CREATE INDEX IF NOT EXISTS ix_legal_acceptances_actor
    ON public.legal_acceptances(actor_type, actor_id, document_id)
    WHERE is_deleted = false;

-- ====================================================
-- SEED DOCUMENTS + PLACEMENTS (bodies filled by API seeder)
-- ====================================================

INSERT INTO public.legal_documents (
    id, slug, document_type, title, audience, summary, public_path, sort_order, is_required_acceptance
)
SELECT v.id, v.slug, v.document_type, v.title, v.audience, v.summary, v.public_path, v.sort_order, v.is_required_acceptance
FROM (VALUES
    ('a1111111-1111-4111-8111-111111111111'::uuid, 'terms-of-use', 'terms-of-use',
     'Terms of Use', 'both',
     'Platform terms governing access to and use of BlinksMed.',
     '/terms-and-conditions', 1, true),
    ('a2222222-2222-4222-8222-222222222222'::uuid, 'vendor-seller-policy', 'vendor-seller-policy',
     'Vendor / Seller Policy', 'vendor',
     'Rules for vendors listing equipment for rent or sale on BlinksMed.',
     '/vendor-seller-policy', 2, true),
    ('a3333333-3333-4333-8333-333333333333'::uuid, 'rental-and-purchase-policy', 'rental-and-purchase-policy',
     'Rental & Purchase Policy', 'customer',
     'How rentals, purchases, deposits, and ownership work on BlinksMed.',
     '/rental-and-purchase-policy', 3, false),
    ('a4444444-4444-4444-8444-444444444444'::uuid, 'cancellation-refund-policy', 'cancellation-refund-policy',
     'Cancellation & Refund Policy', 'customer',
     'Cancellation windows, refunds, and deposit handling.',
     '/cancellation-refund-policy', 4, false),
    ('a5555555-5555-4555-8555-555555555555'::uuid, 'shipping-delivery-policy', 'shipping-delivery-policy',
     'Shipping & Delivery Policy', 'customer',
     'Delivery, setup, and handover of equipment ordered on BlinksMed.',
     '/shipping-delivery-policy', 5, false),
    ('a6666666-6666-4666-8666-666666666666'::uuid, 'privacy-policy', 'privacy-policy',
     'Privacy Policy', 'both',
     'How BlinksMed collects, uses, and protects personal data.',
     '/privacy-policy', 6, true),
    ('a7777777-7777-4777-8777-777777777777'::uuid, 'grievance-redressal-policy', 'grievance-redressal-policy',
     'Grievance Redressal Policy', 'both',
     'How to raise a complaint and statutory grievance timelines.',
     '/grievance-redressal-policy', 7, false)
) AS v(id, slug, document_type, title, audience, summary, public_path, sort_order, is_required_acceptance)
WHERE NOT EXISTS (
    SELECT 1 FROM public.legal_documents d WHERE d.id = v.id OR d.document_type = v.document_type
);

DO $$
DECLARE
    rec record;
    surf text;
    scr text;
    vis boolean;
    req boolean;
    is_customer boolean;
    is_vendor boolean;
    is_admin boolean;
    surfaces text[] := ARRAY['admin_web', 'vendor_web', 'customer_web', 'customer_mobile', 'vendor_mobile'];
    screens text[] := ARRAY[
        'footer', 'register', 'login', 'checkout', 'profile_settings',
        'landing', 'onboarding', 'support', 'legal_hub', 'order_confirm', 'first_launch'
    ];
BEGIN
    FOR rec IN
        SELECT id, document_type, sort_order
        FROM public.legal_documents
        WHERE is_deleted = false
    LOOP
        FOREACH surf IN ARRAY surfaces LOOP
            FOREACH scr IN ARRAY screens LOOP
                vis := false;
                req := false;
                is_customer := surf IN ('customer_web', 'customer_mobile');
                is_vendor := surf IN ('vendor_web', 'vendor_mobile');
                is_admin := surf = 'admin_web';

                IF rec.document_type IN ('terms-of-use', 'privacy-policy') THEN
                    IF is_customer OR is_vendor THEN
                        IF scr IN ('footer', 'register', 'login', 'profile_settings', 'landing', 'onboarding', 'legal_hub', 'first_launch') THEN
                            vis := true;
                        END IF;
                        IF scr = 'register' THEN
                            req := true;
                        END IF;
                    ELSIF is_admin AND scr = 'legal_hub' THEN
                        vis := true;
                    END IF;
                ELSIF rec.document_type = 'vendor-seller-policy' THEN
                    IF is_vendor THEN
                        IF scr IN ('footer', 'register', 'login', 'profile_settings', 'onboarding', 'legal_hub', 'first_launch') THEN
                            vis := true;
                        END IF;
                        IF scr = 'register' THEN
                            req := true;
                        END IF;
                    ELSIF is_admin AND scr = 'legal_hub' THEN
                        vis := true;
                    END IF;
                ELSIF rec.document_type = 'rental-and-purchase-policy' THEN
                    IF is_customer THEN
                        IF scr IN ('checkout', 'footer', 'legal_hub') THEN
                            vis := true;
                        END IF;
                    ELSIF is_admin AND scr = 'legal_hub' THEN
                        vis := true;
                    END IF;
                ELSIF rec.document_type IN ('cancellation-refund-policy', 'shipping-delivery-policy') THEN
                    -- Display at checkout only — no register/checkout acceptance.
                    IF is_customer THEN
                        IF scr IN ('checkout', 'footer', 'legal_hub', 'order_confirm') THEN
                            vis := true;
                        END IF;
                    ELSIF is_admin AND scr = 'legal_hub' THEN
                        vis := true;
                    END IF;
                ELSIF rec.document_type = 'grievance-redressal-policy' THEN
                    IF is_customer OR is_vendor THEN
                        IF scr IN ('support', 'footer', 'legal_hub') THEN
                            vis := true;
                        END IF;
                    ELSIF is_admin AND scr = 'legal_hub' THEN
                        vis := true;
                    END IF;
                END IF;

                INSERT INTO public.legal_document_placements (
                    document_id, surface, screen, is_visible, is_required_to_proceed, sort_order
                )
                SELECT rec.id, surf, scr, vis, req, rec.sort_order
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM public.legal_document_placements p
                    WHERE p.document_id = rec.id
                      AND p.surface = surf
                      AND p.screen = scr
                      AND p.is_deleted = false
                );
            END LOOP;
        END LOOP;
    END LOOP;
END $$;
