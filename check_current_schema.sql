-- Diagnostic script to check current database schema
-- Run this to understand the current state of your database

-- Check if campaigns table exists
SELECT 
    'campaigns table' as table_name,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaigns') 
         THEN 'EXISTS' 
         ELSE 'MISSING' 
    END as status;

-- Check campaigns table structure
DO $$
DECLARE
    r RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaigns') THEN
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

-- Check if campaign_messages table exists
SELECT 
    'campaign_messages table' as table_name,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaign_messages') 
         THEN 'EXISTS' 
         ELSE 'MISSING' 
    END as status;

-- Check campaign_messages table structure
DO $$
DECLARE
    r RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaign_messages') THEN
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

-- Check for any existing campaign-related tables
SELECT 
    table_name,
    'EXISTS' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%campaign%'
ORDER BY table_name; 