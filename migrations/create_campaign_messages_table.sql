-- Create campaign_messages table with correct structure
-- Run this in Supabase SQL editor

-- Drop the table if it exists to start fresh
DROP TABLE IF EXISTS campaign_messages CASCADE;

-- Create the campaign_messages table
CREATE TABLE campaign_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('member', 'all_members', 'specific_phone')),
  specific_phone TEXT,
  timing_type TEXT NOT NULL CHECK (timing_type IN ('specific_time', 'duration')),
  specific_time TEXT, -- HH:MM format
  duration_quantity INTEGER,
  duration_unit TEXT CHECK (duration_unit IN ('min', 'hr', 'day', 'month', 'year')),
  duration_proximity TEXT CHECK (duration_proximity IN ('before', 'after')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_campaign_messages_campaign_id ON campaign_messages(campaign_id);
CREATE INDEX idx_campaign_messages_is_active ON campaign_messages(is_active);

-- Enable RLS
ALTER TABLE campaign_messages ENABLE ROW LEVEL SECURITY;

-- Create simple RLS policy
DROP POLICY IF EXISTS "campaign_messages_all" ON campaign_messages;
CREATE POLICY "campaign_messages_all" ON campaign_messages FOR ALL USING (true) WITH CHECK (true);

-- Verify the table was created
DO $$
BEGIN
  RAISE NOTICE 'campaign_messages table created successfully';
  RAISE NOTICE 'Columns:';
  FOR r IN 
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'campaign_messages'
    ORDER BY ordinal_position
  LOOP
    RAISE NOTICE '  %: % (nullable: %)', r.column_name, r.data_type, r.is_nullable;
  END LOOP;
END $$; 