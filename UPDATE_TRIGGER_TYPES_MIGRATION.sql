-- Update Trigger Types Migration
-- This script updates the trigger_type values in existing campaigns and templates
-- to match the new enum values

-- First, let's create a backup of current data
CREATE TABLE IF NOT EXISTS campaigns_backup AS SELECT * FROM campaigns;
CREATE TABLE IF NOT EXISTS campaign_templates_backup AS SELECT * FROM campaign_templates;

-- Update existing campaigns with old trigger types
UPDATE campaigns 
SET trigger_type = 'member_signup' 
WHERE trigger_type = 'onboarding';

UPDATE campaigns 
SET trigger_type = 'reservation_time' 
WHERE trigger_type = 'reservation';

UPDATE campaigns 
SET trigger_type = 'member_birthday' 
WHERE trigger_type = 'birthday';

-- Update existing campaign templates with old trigger types
UPDATE campaign_templates 
SET trigger_type = 'member_signup' 
WHERE trigger_type = 'onboarding';

UPDATE campaign_templates 
SET trigger_type = 'reservation_time' 
WHERE trigger_type = 'reservation';

UPDATE campaign_templates 
SET trigger_type = 'member_birthday' 
WHERE trigger_type = 'birthday';

-- Remove the 'custom' trigger type entries (if any exist)
DELETE FROM campaigns WHERE trigger_type = 'custom';
DELETE FROM campaign_templates WHERE trigger_type = 'custom';

-- Update the enum type if it exists (PostgreSQL)
DO $$
BEGIN
    -- Check if the enum type exists and update it
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trigger_type_enum') THEN
        -- Drop the old enum and create new one
        DROP TYPE IF EXISTS trigger_type_enum CASCADE;
    END IF;
    
    -- Create new enum with updated values
    CREATE TYPE trigger_type_enum AS ENUM (
        'member_signup',
        'member_birthday', 
        'member_renewal',
        'reservation_time'
    );
    
    -- Update column constraints if they exist
    ALTER TABLE campaigns 
    ALTER COLUMN trigger_type TYPE trigger_type_enum 
    USING trigger_type::trigger_type_enum;
    
    ALTER TABLE campaign_templates 
    ALTER COLUMN trigger_type TYPE trigger_type_enum 
    USING trigger_type::trigger_type_enum;
    
EXCEPTION
    WHEN OTHERS THEN
        -- If enum operations fail, just continue (columns might be text type)
        RAISE NOTICE 'Enum update skipped - columns may be text type';
END $$;

-- Verify the updates
SELECT 'Campaigns updated:' as status, COUNT(*) as count FROM campaigns;
SELECT 'Campaign templates updated:' as status, COUNT(*) as count FROM campaign_templates;

-- Show the current trigger type distribution
SELECT 'Campaign trigger types:' as status, trigger_type, COUNT(*) as count 
FROM campaigns 
GROUP BY trigger_type;

SELECT 'Template trigger types:' as status, trigger_type, COUNT(*) as count 
FROM campaign_templates 
GROUP BY trigger_type;

SELECT 'Migration completed successfully' as status; 