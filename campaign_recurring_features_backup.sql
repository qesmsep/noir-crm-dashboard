-- Backup script for campaign recurring features migration
-- Run this BEFORE applying the main migration

-- Create backup tables with current data (with error handling)
DO $$
BEGIN
    -- Check if campaigns table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaigns') THEN
        CREATE TABLE IF NOT EXISTS campaigns_backup_recurring AS SELECT * FROM campaigns;
        RAISE NOTICE 'Campaigns backed up: % rows', (SELECT COUNT(*) FROM campaigns_backup_recurring);
    ELSE
        RAISE NOTICE 'Campaigns table does not exist - skipping campaigns backup';
    END IF;
    
    -- Check if campaign_messages table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaign_messages') THEN
        CREATE TABLE IF NOT EXISTS campaign_messages_backup_recurring AS SELECT * FROM campaign_messages;
        RAISE NOTICE 'Campaign messages backed up: % rows', (SELECT COUNT(*) FROM campaign_messages_backup_recurring);
    ELSE
        RAISE NOTICE 'Campaign messages table does not exist - skipping campaign messages backup';
    END IF;
END $$;

-- Create backup of current trigger type constraints (with error handling)
DO $$
BEGIN
    -- Check if campaigns table exists and has trigger_type column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'campaigns' 
        AND column_name = 'trigger_type'
    ) THEN
        -- Store current trigger type values for reference
        CREATE TABLE IF NOT EXISTS trigger_types_backup AS 
        SELECT DISTINCT trigger_type FROM campaigns;
        
        RAISE NOTICE 'Trigger types from campaigns backed up successfully';
    ELSE
        RAISE NOTICE 'trigger_type column not found in campaigns table - skipping trigger type backup';
    END IF;
    
    RAISE NOTICE 'Backup completed successfully';
END $$; 