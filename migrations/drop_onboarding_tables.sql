-- Drop onboarding-related tables and clean up database
-- Run this in your Supabase SQL Editor

-- First, backup any existing data (optional)
CREATE TABLE IF NOT EXISTS backup_onboarding_templates AS 
SELECT * FROM onboarding_templates WHERE 1=0;

CREATE TABLE IF NOT EXISTS backup_scheduled_onboarding_messages AS 
SELECT * FROM scheduled_onboarding_messages WHERE 1=0;

-- Copy existing data to backup tables
INSERT INTO backup_onboarding_templates SELECT * FROM onboarding_templates;
INSERT INTO backup_scheduled_onboarding_messages SELECT * FROM scheduled_onboarding_messages;

-- Drop the tables
DROP TABLE IF EXISTS scheduled_onboarding_messages;
DROP TABLE IF EXISTS onboarding_templates;

-- Clean up any related functions and triggers
DROP FUNCTION IF EXISTS update_onboarding_templates_updated_at();
DROP FUNCTION IF EXISTS update_scheduled_onboarding_messages_updated_at();

-- Verify tables are dropped
SELECT 'onboarding_templates' as table_name, 
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'onboarding_templates') 
            THEN 'EXISTS' ELSE 'DROPPED' END as status
UNION ALL
SELECT 'scheduled_onboarding_messages' as table_name, 
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scheduled_onboarding_messages') 
            THEN 'EXISTS' ELSE 'DROPPED' END as status; 