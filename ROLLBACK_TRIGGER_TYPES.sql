-- Rollback Trigger Types Migration
-- This script reverts the trigger_type values back to the old format

-- Restore campaigns from backup
DROP TABLE IF EXISTS campaigns;
ALTER TABLE campaigns_backup RENAME TO campaigns;

-- Restore campaign_templates from backup  
DROP TABLE IF EXISTS campaign_templates;
ALTER TABLE campaign_templates_backup RENAME TO campaign_templates;

-- Or if you want to keep the current tables and just update the values back:
/*
UPDATE campaigns 
SET trigger_type = 'onboarding' 
WHERE trigger_type = 'member_signup';

UPDATE campaigns 
SET trigger_type = 'reservation' 
WHERE trigger_type = 'reservation_time';

UPDATE campaigns 
SET trigger_type = 'birthday' 
WHERE trigger_type = 'member_birthday';

UPDATE campaign_templates 
SET trigger_type = 'onboarding' 
WHERE trigger_type = 'member_signup';

UPDATE campaign_templates 
SET trigger_type = 'reservation' 
WHERE trigger_type = 'reservation_time';

UPDATE campaign_templates 
SET trigger_type = 'birthday' 
WHERE trigger_type = 'member_birthday';
*/

SELECT 'Rollback completed successfully' as status; 