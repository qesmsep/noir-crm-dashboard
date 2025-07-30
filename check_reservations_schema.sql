-- Check reservations table structure
-- Run this in Supabase SQL editor

-- Check if reservations table exists
SELECT 
  table_name,
  CASE WHEN table_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END as status
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'reservations';

-- Check reservations table structure
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reservations') THEN
    RAISE NOTICE 'reservations table structure:';
    FOR r IN 
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'reservations'
      ORDER BY ordinal_position
    LOOP
      RAISE NOTICE '  %: % (nullable: %)', r.column_name, r.data_type, r.is_nullable;
    END LOOP;
  ELSE
    RAISE NOTICE 'reservations table does not exist';
  END IF;
END $$;

-- Check members table structure
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'members') THEN
    RAISE NOTICE 'members table structure:';
    FOR r IN 
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'members'
      ORDER BY ordinal_position
    LOOP
      RAISE NOTICE '  %: % (nullable: %)', r.column_name, r.data_type, r.is_nullable;
    END LOOP;
  ELSE
    RAISE NOTICE 'members table does not exist';
  END IF;
END $$; 