-- Messages table for chat feature
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES accounts(account_id),
    member_id UUID REFERENCES members(member_id),
    message TEXT NOT NULL,
    direction TEXT CHECK (direction IN ('in', 'out')) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_account_id ON messages(account_id);
CREATE INDEX IF NOT EXISTS idx_messages_member_id ON messages(member_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can do everything" ON messages
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Admins can view messages" ON messages
    FOR SELECT
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin'); 