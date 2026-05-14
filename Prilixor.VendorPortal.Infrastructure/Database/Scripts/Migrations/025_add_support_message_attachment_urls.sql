-- Add attachment_urls column to support_messages for file attachments in chat
ALTER TABLE public.support_messages
    ADD COLUMN IF NOT EXISTS attachment_urls TEXT;

-- Update the support_messages EF Core mapping to include the new column
COMMENT ON COLUMN public.support_messages.attachment_urls IS 'JSON array of attachment URLs (e.g., ["/uploads/file1.png", "/uploads/file2.pdf"])';