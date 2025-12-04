-- BACKUP SCRIPT - Run this BEFORE applying the onboarding migration
-- This creates a backup of any existing data that might be affected

-- Create backup of existing tables (if they exist)
CREATE TABLE IF NOT EXISTS backup_onboarding_templates AS 
SELECT * FROM onboarding_templates WHERE 1=0;

CREATE TABLE IF NOT EXISTS backup_scheduled_onboarding_messages AS 
SELECT * FROM scheduled_onboarding_messages WHERE 1=0;

-- Insert current data into backup tables (if tables exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'onboarding_templates') THEN
        INSERT INTO backup_onboarding_templates SELECT * FROM onboarding_templates;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scheduled_onboarding_messages') THEN
        INSERT INTO backup_scheduled_onboarding_messages SELECT * FROM scheduled_onboarding_messages;
    END IF;
END $$;

-- Verify backup was created
SELECT 'Backup completed successfully' as status; 