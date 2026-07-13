\c common_portal_db

CREATE TABLE IF NOT EXISTS public.chemical_properties (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL,
    cas_number varchar(50) NULL,
    chemical_formula varchar(100) NULL,
    purity_percentage numeric(5, 2) NULL,
    molecular_weight numeric(10, 4) NULL,
    base_unit varchar(20) NOT NULL DEFAULT 'Kg',
    sds_document_url varchar(500) NULL,
    coa_document_url varchar(500) NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_chemical_properties_product
        FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE,
    CONSTRAINT uq_chemical_properties_product
        UNIQUE (product_id)
);

CREATE INDEX IF NOT EXISTS ix_chemical_properties_product_id
    ON public.chemical_properties(product_id);
