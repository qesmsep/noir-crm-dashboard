-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    account_id UUID REFERENCES accounts(account_id),
    amount DECIMAL(10,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    items JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add invoice_id to ledger table
ALTER TABLE ledger ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_invoices_account_id ON invoices(account_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_ledger_invoice_id ON ledger(invoice_id);

-- Add RLS policies
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can do everything" ON invoices
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Admins can view invoices" ON invoices
    FOR SELECT
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 