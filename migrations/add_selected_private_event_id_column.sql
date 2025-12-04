-- Add selected_private_event_id column to campaign_messages table
-- Run this in your Supabase SQL editor

-- Add the new column
ALTER TABLE campaign_messages 
ADD COLUMN IF NOT EXISTS selected_private_event_id UUID REFERENCES public.private_events(id);

-- Add a comment to explain the column
COMMENT ON COLUMN campaign_messages.selected_private_event_id IS 'The ID of the selected private event for private_event_rsvps recipient type';

-- Create an index for better performance when filtering by this field
CREATE INDEX IF NOT EXISTS idx_campaign_messages_selected_private_event_id ON campaign_messages(selected_private_event_id);

-- Verify the column was added
DO $$
DECLARE r RECORD;
BEGIN
  RAISE NOTICE 'Added selected_private_event_id column to campaign_messages table';
  RAISE NOTICE 'Column details:';
  FOR r IN 
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'campaign_messages' AND column_name = 'selected_private_event_id'
  LOOP
    RAISE NOTICE '  %: % (nullable: %, default: %)', r.column_name, r.data_type, r.is_nullable, r.column_default;
  END LOOP;
END $$; 