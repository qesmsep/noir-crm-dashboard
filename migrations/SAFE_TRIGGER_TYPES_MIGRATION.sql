-- Safe Update Trigger Types Migration
-- This script safely updates the trigger_type values while handling constraints

-- First, let's create a backup of current data
CREATE TABLE IF NOT EXISTS campaigns_backup AS SELECT * FROM campaigns;
CREATE TABLE IF NOT EXISTS campaign_templates_backup AS SELECT * FROM campaign_templates;

-- Check current trigger types to see what we're working with
SELECT 'Current campaign trigger types:' as status, trigger_type, COUNT(*) as count 
FROM campaigns 
GROUP BY trigger_type;

SELECT 'Current template trigger types:' as status, trigger_type, COUNT(*) as count 
FROM campaign_templates 
GROUP BY trigger_type;

-- Temporarily disable the check constraint
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_trigger_type_check;
ALTER TABLE campaign_templates DROP CONSTRAINT IF EXISTS campaign_templates_trigger_type_check;

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

-- Re-add the check constraints with the new allowed values
ALTER TABLE campaigns ADD CONSTRAINT campaigns_trigger_type_check 
CHECK (trigger_type IN ('member_signup', 'member_birthday', 'member_renewal', 'reservation_time'));

ALTER TABLE campaign_templates ADD CONSTRAINT campaign_templates_trigger_type_check 
CHECK (trigger_type IN ('member_signup', 'member_birthday', 'member_renewal', 'reservation_time'));

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