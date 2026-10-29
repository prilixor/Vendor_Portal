-- ==============================================================================
-- Migration 074: Complete Cashfree Document & Bank Verification + RBAC Migration
-- ==============================================================================
-- Description:
--   Comprehensive database migration covering the entire Cashfree Automated
--   Verification feature from initial API implementation to RBAC permissions.
--
-- Safe for execution on:
--   - vendor_portal_db (applies documents & bank accounts columns + indexes)
--   - admin_portal_db  (applies admin_permissions & admin_role_permissions)
--   - Unified single-database live deployments (applies both seamlessly)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- STEP 1: VENDOR DOCUMENTS SCHEMA UPDATES
-- (Applies when table public.vendor_documents exists)
-- ------------------------------------------------------------------------------

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'vendor_documents'
    ) THEN
        -- 1.1 Add original_file_name to store the uploaded human-readable filename
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'vendor_documents' AND column_name = 'original_file_name'
        ) THEN
            ALTER TABLE public.vendor_documents 
                ADD COLUMN original_file_name varchar(255) NULL;
            RAISE NOTICE 'Added column original_file_name to public.vendor_documents';
        END IF;

        -- 1.2 Ensure document_number column exists (stores verified GSTIN, PAN, Cheque numbers)
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'vendor_documents' AND column_name = 'document_number'
        ) THEN
            ALTER TABLE public.vendor_documents 
                ADD COLUMN document_number varchar(100) NULL;
            RAISE NOTICE 'Added column document_number to public.vendor_documents';
        END IF;

        -- 1.3 Ensure rejection_reason column exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'vendor_documents' AND column_name = 'rejection_reason'
        ) THEN
            ALTER TABLE public.vendor_documents 
                ADD COLUMN rejection_reason text NULL;
            RAISE NOTICE 'Added column rejection_reason to public.vendor_documents';
        END IF;

        -- 1.4 Ensure verified_at column exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'vendor_documents' AND column_name = 'verified_at'
        ) THEN
            ALTER TABLE public.vendor_documents 
                ADD COLUMN verified_at timestamptz NULL;
            RAISE NOTICE 'Added column verified_at to public.vendor_documents';
        END IF;

        -- 1.5 Create indexes safely
        CREATE INDEX IF NOT EXISTS ix_vendor_documents_vendor_id 
            ON public.vendor_documents(vendor_id);

        CREATE INDEX IF NOT EXISTS ix_vendor_documents_status 
            ON public.vendor_documents(verification_status);

        CREATE INDEX IF NOT EXISTS ix_vendor_documents_vendor_status 
            ON public.vendor_documents(vendor_id, verification_status);

        RAISE NOTICE 'Vendor documents columns and indexes verified successfully.';
    END IF;
END $$;


-- ------------------------------------------------------------------------------
-- STEP 2: VENDOR BANK ACCOUNTS SCHEMA UPDATES
-- (Applies when table public.vendor_bank_accounts exists)
-- ------------------------------------------------------------------------------

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'vendor_bank_accounts'
    ) THEN
        -- 2.1 Add branch_name if missing (populated via Cashfree IFSC lookup)
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'vendor_bank_accounts' AND column_name = 'branch_name'
        ) THEN
            ALTER TABLE public.vendor_bank_accounts 
                ADD COLUMN branch_name varchar(255) NULL;
            RAISE NOTICE 'Added column branch_name to public.vendor_bank_accounts';
        END IF;

        -- 2.2 Ensure verified_at column exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'vendor_bank_accounts' AND column_name = 'verified_at'
        ) THEN
            ALTER TABLE public.vendor_bank_accounts 
                ADD COLUMN verified_at timestamptz NULL;
            RAISE NOTICE 'Added column verified_at to public.vendor_bank_accounts';
        END IF;

        -- 2.3 Ensure verification_status check constraint supports 'pending', 'approved', 'rejected'
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'chk_vendor_bank_accounts_verification_status'
        ) THEN
            ALTER TABLE public.vendor_bank_accounts 
                ADD CONSTRAINT chk_vendor_bank_accounts_verification_status 
                CHECK (verification_status IN ('pending', 'approved', 'rejected'));
        END IF;

        -- 2.4 Create index safely
        CREATE INDEX IF NOT EXISTS ix_vendor_bank_accounts_vendor_id 
            ON public.vendor_bank_accounts(vendor_id);

        RAISE NOTICE 'Vendor bank accounts columns and indexes verified successfully.';
    END IF;
END $$;


-- ------------------------------------------------------------------------------
-- STEP 3: ADMIN PERMISSIONS CATALOG (RBAC)
-- (Applies when table public.admin_permissions exists)
-- ------------------------------------------------------------------------------

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'admin_permissions'
    ) THEN
        -- 3.1 Insert or update the 'vendors.auto_verify' permission
        INSERT INTO public.admin_permissions (
            id, 
            code, 
            name, 
            description, 
            category, 
            created_at, 
            updated_at
        )
        VALUES (
            'b1000000-0000-4000-8000-000000000011',
            'vendors.auto_verify',
            'Automated Document Verification',
            'Allow using automated verification (GST, PAN, Cheque OCR, Penny Drop)',
            'Vendors',
            NOW(),
            NOW()
        )
        ON CONFLICT (code) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            category = EXCLUDED.category,
            updated_at = NOW();

        RAISE NOTICE 'Seeded permission vendors.auto_verify in public.admin_permissions';
    END IF;
END $$;


-- ------------------------------------------------------------------------------
-- STEP 4: ROLE PERMISSION MAPPING (DEFAULT ROLE ASSIGNMENTS)
-- (Applies when table public.admin_role_permissions exists)
-- ------------------------------------------------------------------------------

DO $$
DECLARE
    v_perm_id uuid;
    v_super_admin_role_id uuid;
    v_verifier_role_id uuid;
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'admin_role_permissions'
    ) THEN
        -- Resolve permission ID for 'vendors.auto_verify'
        SELECT id INTO v_perm_id 
        FROM public.admin_permissions 
        WHERE code = 'vendors.auto_verify';

        IF v_perm_id IS NOT NULL THEN
            -- 4.1 Grant to Super Admin role
            SELECT id INTO v_super_admin_role_id 
            FROM public.admin_roles 
            WHERE code = 'super_admin' OR id = 'a1000000-0000-4000-8000-000000000001';

            IF v_super_admin_role_id IS NOT NULL THEN
                INSERT INTO public.admin_role_permissions (role_id, permission_id)
                VALUES (v_super_admin_role_id, v_perm_id)
                ON CONFLICT (role_id, permission_id) DO NOTHING;
                RAISE NOTICE 'Granted vendors.auto_verify to super_admin (role_id: %)', v_super_admin_role_id;
            END IF;

            -- 4.2 Grant to Verifier role
            SELECT id INTO v_verifier_role_id 
            FROM public.admin_roles 
            WHERE code = 'verifier' OR id = 'a1000000-0000-4000-8000-000000000002';

            IF v_verifier_role_id IS NOT NULL THEN
                INSERT INTO public.admin_role_permissions (role_id, permission_id)
                VALUES (v_verifier_role_id, v_perm_id)
                ON CONFLICT (role_id, permission_id) DO NOTHING;
                RAISE NOTICE 'Granted vendors.auto_verify to verifier (role_id: %)', v_verifier_role_id;
            END IF;
        END IF;
    END IF;
END $$;


-- ------------------------------------------------------------------------------
-- STEP 5: VERIFICATION & AUDIT CHECK QUERIES
-- ------------------------------------------------------------------------------

DO $$
BEGIN
    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'Migration 074 completed successfully.';
    RAISE NOTICE '=======================================================';
END $$;

-- Check 1: Check permission existence (if admin_permissions exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_permissions') THEN
        PERFORM id, code, name, category FROM public.admin_permissions WHERE code = 'vendors.auto_verify';
    END IF;
END $$;

-- Check 2: Check role grants (if admin_role_permissions exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_role_permissions') THEN
        PERFORM r.code, p.code 
        FROM public.admin_role_permissions rp
        JOIN public.admin_roles r ON r.id = rp.role_id
        JOIN public.admin_permissions p ON p.id = rp.permission_id
        WHERE p.code = 'vendors.auto_verify';
    END IF;
END $$;
