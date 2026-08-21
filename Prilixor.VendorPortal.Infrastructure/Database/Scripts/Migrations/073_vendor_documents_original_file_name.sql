-- Migration 073: Keep the vendor's original KYC filename for display.
-- Stored blobs remain timestamp+GUID; this column is the human-readable name.
-- Run on: vendor_portal_db

\c vendor_portal_db

ALTER TABLE public.vendor_documents
    ADD COLUMN IF NOT EXISTS original_file_name varchar(255) NULL;
