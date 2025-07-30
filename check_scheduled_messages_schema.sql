-- Check scheduled_messages table structure
-- Run this in Supabase SQL editor

-- Check if scheduled_messages table exists
SELECT 
  table_name,
  CASE WHEN table_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END as status
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'scheduled_messages';

-- Check scheduled_messages table structure
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'scheduled_messages') THEN
    RAISE NOTICE 'scheduled_messages table structure:';
    FOR r IN 
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'scheduled_messages'
      ORDER BY ordinal_position
    LOOP
      RAISE NOTICE '  %: % (nullable: %)', r.column_name, r.data_type, r.is_nullable;
    END LOOP;
  ELSE
    RAISE NOTICE 'scheduled_messages table does not exist';
  END IF;
END $$; 