-- Fix Snippet Reference Issue
-- This script helps identify and fix the missing snippet reference

-- =============================================================================
-- 1. CHECK CURRENT CAMPAIGN DATA
-- =============================================================================

-- Check if the problematic campaign ID exists
SELECT 
    'Current campaigns' as check_type,
    campaign_id,
    name,
    trigger_type,
    is_active
FROM campaigns 
WHERE campaign_id = 'campaign-1753827282556-tv400w6b5'
   OR campaign_id = '2b66396e-8883-48ff-9450-cc51c04c3dfd';

-- Check if there are any templates referencing the old campaign ID
SELECT 
    'Templates with old campaign ID' as check_type,
    id,
    name,
    campaign_id,
    is_active
FROM campaign_templates 
WHERE campaign_id = 'campaign-1753827282556-tv400w6b5'
   OR campaign_id = '2b66396e-8883-48ff-9450-cc51c04c3dfd';

-- =============================================================================
-- 2. CHECK FOR ANY REFERENCES TO THE SNIPPET ID
-- =============================================================================

-- Check if there are any scheduled messages with the problematic ID
SELECT 
    'Scheduled messages with old campaign ID' as check_type,
    id,
    campaign_template_id,
    phone_number,
    status,
    created_at
FROM scheduled_campaign_messages scm
JOIN campaign_templates ct ON scm.campaign_template_id = ct.id
WHERE ct.campaign_id = 'campaign-1753827282556-tv400w6b5'
   OR ct.campaign_id = '2b66396e-8883-48ff-9450-cc51c04c3dfd';

-- =============================================================================
-- 3. CREATE MISSING CAMPAIGN IF NEEDED
-- =============================================================================

-- Create the missing campaign if it doesn't exist
INSERT INTO campaigns (campaign_id, name, description, trigger_type, is_active, created_at, updated_at)
VALUES 
    ('2b66396e-8883-48ff-9450-cc51c04c3dfd', 'Test Campaign', 'Test campaign for development', 'member_signup', true, NOW(), NOW())
ON CONFLICT (campaign_id) DO NOTHING;

-- =============================================================================
-- 4. UPDATE TEMPLATES TO USE NEW CAMPAIGN ID
-- =============================================================================

-- Update any templates that reference the old campaign ID
UPDATE campaign_templates 
SET campaign_id = '2b66396e-8883-48ff-9450-cc51c04c3dfd'
WHERE campaign_id = 'campaign-1753827282556-tv400w6b5';

-- =============================================================================
-- 5. VERIFICATION
-- =============================================================================

-- Verify the fix worked
SELECT 
    'Verification - Campaign exists' as check_type,
    campaign_id,
    name,
    trigger_type,
    is_active
FROM campaigns 
WHERE campaign_id = '2b66396e-8883-48ff-9450-cc51c04c3dfd';

-- Check templates are properly linked
SELECT 
    'Verification - Templates linked' as check_type,
    t.id,
    t.name as template_name,
    t.campaign_id,
    c.name as campaign_name,
    t.is_active
FROM campaign_templates t
JOIN campaigns c ON t.campaign_id = c.campaign_id
WHERE t.campaign_id = '2b66396e-8883-48ff-9450-cc51c04c3dfd';

-- =============================================================================
-- 6. CLEANUP OLD REFERENCES
-- =============================================================================

-- Remove the old campaign ID from the CREATE_MISSING_CAMPAIGNS.sql file
-- (This needs to be done manually in the file)

-- Show all campaigns for reference
SELECT 
    'All campaigns' as check_type,
    campaign_id,
    name,
    trigger_type,
    is_active,
    created_at
FROM campaigns 
ORDER BY created_at DESC; 