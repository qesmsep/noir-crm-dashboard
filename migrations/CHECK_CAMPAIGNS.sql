-- Check Campaigns Table
-- This script helps debug campaign data issues

-- Check if campaigns table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'campaigns'
) as table_exists;

-- Count campaigns
SELECT COUNT(*) as campaign_count FROM campaigns;

-- Show all campaigns with their IDs
SELECT 
    id,
    campaign_id,
    name,
    trigger_type,
    is_active,
    created_at
FROM campaigns 
ORDER BY created_at DESC;

-- Check trigger types
SELECT 
    trigger_type,
    COUNT(*) as count
FROM campaigns 
GROUP BY trigger_type;

-- Check if there are any campaigns with old trigger types
SELECT 
    trigger_type,
    COUNT(*) as count
FROM campaigns 
WHERE trigger_type IN ('onboarding', 'reservation', 'birthday', 'custom')
GROUP BY trigger_type; 