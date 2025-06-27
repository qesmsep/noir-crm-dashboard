-- Create guest_messages table for tracking messages sent to non-members
CREATE TABLE IF NOT EXISTS public.guest_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone TEXT NOT NULL,
    content TEXT NOT NULL,
    reservation_id UUID,
    sent_by TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'sent',
    error_message TEXT,
    openphone_message_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_guest_messages_phone ON guest_messages(phone);
CREATE INDEX IF NOT EXISTS idx_guest_messages_reservation_id ON guest_messages(reservation_id);
CREATE INDEX IF NOT EXISTS idx_guest_messages_timestamp ON guest_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_guest_messages_status ON guest_messages(status);

-- Enable RLS
ALTER TABLE public.guest_messages ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY "Admins can view all guest messages"
ON public.guest_messages
FOR SELECT
USING (true);

CREATE POLICY "Admins can create guest messages"
ON public.guest_messages
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can update guest messages"
ON public.guest_messages
FOR UPDATE
USING (true); 