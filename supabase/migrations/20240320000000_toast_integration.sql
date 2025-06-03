-- Add toast_customer_id to members table
ALTER TABLE members ADD COLUMN IF NOT EXISTS toast_customer_id TEXT;

-- Create toast_sync_log table
CREATE TABLE IF NOT EXISTS toast_sync_log (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    member_id UUID REFERENCES members(member_id),
    last_sync TIMESTAMP WITH TIME ZONE NOT NULL,
    transactions_synced INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add status column to ledger table
ALTER TABLE ledger ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';
ALTER TABLE ledger ADD COLUMN IF NOT EXISTS toast_transaction_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_toast_sync_log_member_id ON toast_sync_log(member_id);
CREATE INDEX IF NOT EXISTS idx_ledger_status ON ledger(status);
CREATE INDEX IF NOT EXISTS idx_ledger_toast_transaction_id ON ledger(toast_transaction_id);

-- Add RLS policies
ALTER TABLE toast_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can do everything" ON toast_sync_log
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Admins can view sync logs" ON toast_sync_log
    FOR SELECT
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin'); 