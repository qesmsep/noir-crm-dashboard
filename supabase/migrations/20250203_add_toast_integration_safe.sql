-- Migration to add Toast API integration for member house account purchases
-- This allows real-time tracking of Toast house account transactions
-- SAFE VERSION - Only adds new tables and columns, doesn't drop existing tables

-- Add Toast-specific fields to members table
ALTER TABLE members ADD COLUMN IF NOT EXISTS toast_account_id TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS toast_customer_id TEXT;

-- Create Toast transaction tracking table
CREATE TABLE IF NOT EXISTS public.toast_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id UUID REFERENCES members(member_id),
    account_id UUID NOT NULL,
    toast_transaction_id TEXT UNIQUE NOT NULL,
    toast_order_id TEXT,
    amount DECIMAL(10,2) NOT NULL,
    transaction_date TIMESTAMPTZ NOT NULL,
    items JSONB, -- Store order items/details
    payment_method TEXT,
    server_name TEXT,
    table_number TEXT,
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Toast sync status tracking table
CREATE TABLE IF NOT EXISTS public.toast_sync_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sync_type TEXT NOT NULL, -- 'webhook', 'manual', 'batch'
    status TEXT NOT NULL, -- 'success', 'failed', 'in_progress'
    records_processed INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_toast_transactions_member_id ON toast_transactions(member_id);
CREATE INDEX IF NOT EXISTS idx_toast_transactions_account_id ON toast_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_toast_transactions_toast_id ON toast_transactions(toast_transaction_id);
CREATE INDEX IF NOT EXISTS idx_toast_transactions_date ON toast_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_toast_sync_status_type ON toast_sync_status(sync_type);
CREATE INDEX IF NOT EXISTS idx_toast_sync_status_status ON toast_sync_status(status);
CREATE INDEX IF NOT EXISTS idx_toast_sync_status_started_at ON toast_sync_status(started_at);

-- Enable RLS
ALTER TABLE public.toast_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toast_sync_status ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY "Admins can manage toast transactions"
ON public.toast_transactions
FOR ALL
USING (true);

CREATE POLICY "Admins can manage toast sync status"
ON public.toast_sync_status
FOR ALL
USING (true);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_toast_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_toast_sync_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_toast_transactions_updated_at
    BEFORE UPDATE ON public.toast_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_toast_transactions_updated_at();

CREATE TRIGGER trigger_update_toast_sync_status_updated_at
    BEFORE UPDATE ON public.toast_sync_status
    FOR EACH ROW
    EXECUTE FUNCTION update_toast_sync_status_updated_at();

-- Add comments for documentation
COMMENT ON TABLE public.toast_transactions IS 'Stores Toast house account transactions linked to member accounts';
COMMENT ON TABLE public.toast_sync_status IS 'Tracks Toast API sync operations and their status';
COMMENT ON COLUMN public.members.toast_account_id IS 'Toast account identifier (phone number)';
COMMENT ON COLUMN public.members.toast_customer_id IS 'Toast customer ID if different from account ID'; 