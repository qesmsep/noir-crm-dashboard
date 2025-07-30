-- Add ledger PDF link option to campaign_messages table
-- This allows campaign messages to include a ledger PDF link for member-related triggers

-- Add the new column
ALTER TABLE campaign_messages 
ADD COLUMN include_ledger_pdf BOOLEAN DEFAULT false;

-- Add a comment to explain the column
COMMENT ON COLUMN campaign_messages.include_ledger_pdf IS 'Whether to include a ledger PDF link in the message (only for member-related triggers)';

-- Create an index for better performance when filtering by this option
CREATE INDEX IF NOT EXISTS idx_campaign_messages_include_ledger_pdf ON campaign_messages(include_ledger_pdf);

-- Verify the column was added
DO $$
BEGIN
  RAISE NOTICE 'Added include_ledger_pdf column to campaign_messages table';
  RAISE NOTICE 'Column details:';
  FOR r IN 
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'campaign_messages' AND column_name = 'include_ledger_pdf'
  LOOP
    RAISE NOTICE '  %: % (nullable: %, default: %)', r.column_name, r.data_type, r.is_nullable, r.column_default;
  END LOOP;
END $$; 