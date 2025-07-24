-- Add Stripe tracking fields to ledger table to prevent duplicate entries
-- Run this directly in your Supabase SQL Editor

-- Add Stripe tracking fields to ledger table
ALTER TABLE public.ledger 
ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

-- Create indexes for performance and deduplication
CREATE INDEX IF NOT EXISTS idx_ledger_stripe_invoice_id ON ledger(stripe_invoice_id);
CREATE INDEX IF NOT EXISTS idx_ledger_stripe_payment_intent_id ON ledger(stripe_payment_intent_id);

-- Add comments for documentation
COMMENT ON COLUMN public.ledger.stripe_invoice_id IS 'Stripe Invoice ID to prevent duplicate ledger entries';
COMMENT ON COLUMN public.ledger.stripe_payment_intent_id IS 'Stripe Payment Intent ID to prevent duplicate ledger entries';

-- Verify the migration
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'ledger' 
  AND table_schema = 'public'
  AND column_name IN ('stripe_invoice_id', 'stripe_payment_intent_id')
ORDER BY column_name; 