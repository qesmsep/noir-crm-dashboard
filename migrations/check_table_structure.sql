-- Check what tables exist and their structure
-- Run this in Supabase SQL editor

-- Check if campaigns table exists
SELECT 
  table_name,
  CASE WHEN table_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('campaigns', 'campaign_messages', 'campaign_templates', 'scheduled_messages');

-- Check campaigns table structure
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'campaigns') THEN
    RAISE NOTICE 'campaigns table structure:';
    FOR r IN 
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'campaigns'
      ORDER BY ordinal_position
    LOOP
      RAISE NOTICE '  %: % (nullable: %)', r.column_name, r.data_type, r.is_nullable;
    END LOOP;
  ELSE
    RAISE NOTICE 'campaigns table does not exist';
  END IF;
END $$;

-- Check campaign_messages table structure
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'campaign_messages') THEN
    RAISE NOTICE 'campaign_messages table structure:';
    FOR r IN 
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'campaign_messages'
      ORDER BY ordinal_position
    LOOP
      RAISE NOTICE '  %: % (nullable: %)', r.column_name, r.data_type, r.is_nullable;
    END LOOP;
  ELSE
    RAISE NOTICE 'campaign_messages table does not exist';
  END IF;
END $$;

-- Check campaign_templates table structure (old table)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'campaign_templates') THEN
    RAISE NOTICE 'campaign_templates table structure:';
    FOR r IN 
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'campaign_templates'
      ORDER BY ordinal_position
    LOOP
      RAISE NOTICE '  %: % (nullable: %)', r.column_name, r.data_type, r.is_nullable;
    END LOOP;
  ELSE
    RAISE NOTICE 'campaign_templates table does not exist';
  END IF;
END $$; 