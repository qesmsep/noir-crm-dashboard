-- Migration to add membership type filtering to campaign messages
-- Run this in your Supabase SQL Editor

-- Add membership type filter to campaign_messages table
ALTER TABLE campaign_messages ADD COLUMN IF NOT EXISTS membership_type_filter TEXT[];

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_campaign_messages_membership_filter ON campaign_messages USING GIN(membership_type_filter);

-- Add comment for documentation
COMMENT ON COLUMN campaign_messages.membership_type_filter IS 'Array of membership types to filter recipients (Skyline, Duo, Solo, Annual, all_members, primary_members)';

-- Verify the migration
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'campaign_messages' 
  AND table_schema = 'public'
  AND column_name = 'membership_type_filter'; 