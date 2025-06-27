-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id UUID NOT NULL,
    account_id UUID NOT NULL,
    content TEXT NOT NULL,
    direction TEXT NOT NULL,
    status TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    error_message TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_messages_member_id ON messages(member_id);
CREATE INDEX IF NOT EXISTS idx_messages_account_id ON messages(account_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view messages for their account"
ON public.messages
FOR SELECT
USING (auth.uid() IN (
    SELECT member_id FROM members WHERE account_id = messages.account_id
));

CREATE POLICY "Users can create messages for their account"
ON public.messages
FOR INSERT
WITH CHECK (auth.uid() IN (
    SELECT member_id FROM members WHERE account_id = messages.account_id
)); 