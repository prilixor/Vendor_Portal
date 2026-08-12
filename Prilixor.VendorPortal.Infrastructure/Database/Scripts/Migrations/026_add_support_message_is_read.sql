-- Admin inbox read state for vendor support messages (parity with customer chat is_read).
-- At Vendor DB
ALTER TABLE public.support_messages
    ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.support_messages.is_read IS
    'False for unread Vendor messages / AI escalations awaiting admin; set true when admin opens the ticket.';