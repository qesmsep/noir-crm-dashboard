-- Add stripe_invoice_pdf_url column to ledger table
-- This stores the Stripe-hosted PDF URL for subscription invoices

ALTER TABLE ledger
ADD COLUMN IF NOT EXISTS stripe_invoice_pdf_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN ledger.stripe_invoice_pdf_url IS 'URL to Stripe-hosted invoice PDF (for subscription payments)';

-- Create index for faster lookups by invoice URL
CREATE INDEX IF NOT EXISTS idx_ledger_stripe_invoice_pdf_url
ON ledger(stripe_invoice_pdf_url)
WHERE stripe_invoice_pdf_url IS NOT NULL;
