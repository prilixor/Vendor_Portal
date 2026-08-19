-- ----------------------------------------------------
-- 072: Catalog product documents (admin-managed)
-- Spec sheets, warranty, SDS, COA, compliance files
-- live on the catalog product — not vendor listings.
--
-- Run on: common_portal_db (mandatory)
-- Run on: vendor_portal_db (optional schema parity)
-- ----------------------------------------------------

-- ====================================================
-- 1) common_portal_db — catalog product documents
-- ====================================================
\c common_portal_db

CREATE TABLE IF NOT EXISTS public.product_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL,
    document_type varchar(50) NOT NULL,
    file_url text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'products'
    ) THEN
        BEGIN
            ALTER TABLE public.product_documents
                ADD CONSTRAINT fk_product_documents_product
                FOREIGN KEY (product_id) REFERENCES public.products(id);
        EXCEPTION WHEN duplicate_object THEN
            NULL;
        END;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_product_documents_product_id
    ON public.product_documents(product_id)
    WHERE is_deleted = false;

-- ====================================================
-- 2) vendor_portal_db — mirrored catalog table
-- ====================================================
\c vendor_portal_db

CREATE TABLE IF NOT EXISTS public.product_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL,
    document_type varchar(50) NOT NULL,
    file_url text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    updated_by uuid NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'products'
    ) THEN
        BEGIN
            ALTER TABLE public.product_documents
                ADD CONSTRAINT fk_product_documents_product
                FOREIGN KEY (product_id) REFERENCES public.products(id);
        EXCEPTION WHEN duplicate_object THEN
            NULL;
        END;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_product_documents_product_id
    ON public.product_documents(product_id)
    WHERE is_deleted = false;
