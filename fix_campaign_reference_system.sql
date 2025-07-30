-- Fix Campaign Reference System
-- Change from hardcoded UUIDs to using campaign names as identifiers

-- =============================================================================
-- 1. CHECK CURRENT STATE
-- =============================================================================

-- Show all campaigns with their IDs
SELECT 
    'Current campaigns' as info,
    campaign_id,
    name,
    trigger_type,
    is_active
FROM campaigns 
ORDER BY name;

-- Show templates and their campaign references
SELECT 
    'Templates with campaign references' as info,
    t.id,
    t.name as template_name,
    t.campaign_id,
    c.name as campaign_name,
    t.is_active
FROM campaign_templates t
LEFT JOIN campaigns c ON t.campaign_id = c.campaign_id
ORDER BY c.name, t.name;

-- =============================================================================
-- 2. CREATE MISSING CAMPAIGNS BY NAME
-- =============================================================================

-- Create campaigns based on common names that should exist
INSERT INTO campaigns (campaign_id, name, description, trigger_type, is_active, created_at, updated_at)
VALUES 
    (uuid_generate_v4(), 'reservation-reminder', 'Reservation reminder messages', 'reservation_time', true, NOW(), NOW()),
    (uuid_generate_v4(), 'welcome-series', 'Welcome messages for new members', 'member_signup', true, NOW(), NOW()),
    (uuid_generate_v4(), 'birthday-campaign', 'Birthday messages for members', 'member_birthday', true, NOW(), NOW()),
    (uuid_generate_v4(), 'onboarding-followup', 'Follow-up messages for new members', 'member_signup', true, NOW(), NOW()),
    (uuid_generate_v4(), 'test-campaign', 'Test campaign for development', 'member_signup', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- 3. UPDATE TEMPLATES TO USE CORRECT CAMPAIGN REFERENCES
-- =============================================================================

-- Update templates to reference campaigns by name instead of hardcoded UUIDs
UPDATE campaign_templates 
SET campaign_id = (
    SELECT campaign_id 
    FROM campaigns 
    WHERE name = 'reservation-reminder'
    LIMIT 1
)
WHERE campaign_id NOT IN (
    SELECT campaign_id FROM campaigns
) 
AND name LIKE '%reminder%';

UPDATE campaign_templates 
SET campaign_id = (
    SELECT campaign_id 
    FROM campaigns 
    WHERE name = 'welcome-series'
    LIMIT 1
)
WHERE campaign_id NOT IN (
    SELECT campaign_id FROM campaigns
) 
AND name LIKE '%welcome%';

UPDATE campaign_templates 
SET campaign_id = (
    SELECT campaign_id 
    FROM campaigns 
    WHERE name = 'birthday-campaign'
    LIMIT 1
)
WHERE campaign_id NOT IN (
    SELECT campaign_id FROM campaigns
) 
AND name LIKE '%birthday%';

-- =============================================================================
-- 4. CLEANUP ORPHANED TEMPLATES
-- =============================================================================

-- Show templates that don't have valid campaign references
SELECT 
    'Orphaned templates' as info,
    t.id,
    t.name as template_name,
    t.campaign_id,
    t.is_active
FROM campaign_templates t
LEFT JOIN campaigns c ON t.campaign_id = c.campaign_id
WHERE c.campaign_id IS NULL;

-- Delete orphaned templates (uncomment if you want to clean them up)
-- DELETE FROM campaign_templates 
-- WHERE campaign_id NOT IN (SELECT campaign_id FROM campaigns);

-- =============================================================================
-- 5. VERIFICATION
-- =============================================================================

-- Show final state
SELECT 
    'Final campaign state' as info,
    campaign_id,
    name,
    trigger_type,
    is_active
FROM campaigns 
ORDER BY name;

-- Show templates with their campaigns
SELECT 
    'Final template state' as info,
    t.id,
    t.name as template_name,
    c.name as campaign_name,
    t.is_active
FROM campaign_templates t
JOIN campaigns c ON t.campaign_id = c.campaign_id
ORDER BY c.name, t.name;

-- =============================================================================
-- 6. CREATE HELPER FUNCTION FOR CAMPAIGN LOOKUP
-- =============================================================================

-- Create a function to get campaign by name
CREATE OR REPLACE FUNCTION get_campaign_by_name(campaign_name TEXT)
RETURNS UUID AS $$
DECLARE
    campaign_uuid UUID;
BEGIN
    SELECT campaign_id INTO campaign_uuid
    FROM campaigns 
    WHERE name = campaign_name
    LIMIT 1;
    
    RETURN campaign_uuid;
END;
$$ LANGUAGE plpgsql;

-- Test the function
SELECT 
    'Function test' as info,
    get_campaign_by_name('reservation-reminder') as reservation_reminder_id,
    get_campaign_by_name('welcome-series') as welcome_series_id; 