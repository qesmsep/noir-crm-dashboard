-- Create missing campaigns based on existing templates
-- This script will create campaigns for the campaign_ids that exist in templates but not in campaigns table

DO $$
BEGIN
    -- Create campaigns for each unique campaign_id found in templates
    INSERT INTO campaigns (campaign_id, name, description, trigger_type, is_active, created_at, updated_at)
    VALUES 
        ('welcome-series', 'Welcome Series', 'Welcome messages for new members', 'member_signup', true, NOW(), NOW()),
        ('reservation-followup', 'Reservation Follow-up', 'Messages related to reservations', 'reservation_time', true, NOW(), NOW()),
        ('birthday-campaign', 'Birthday Campaign', 'Birthday messages for members', 'member_birthday', true, NOW(), NOW()),
        ('onboarding-followup', 'Onboarding Follow-up', 'Follow-up messages for new members', 'member_signup', true, NOW(), NOW()),
        ('birthday-wish', 'Birthday Wish', 'Birthday wishes for members', 'member_birthday', true, NOW(), NOW()),
        ('reservation-reminder', 'Reservation Reminder', 'Reminder messages for reservations', 'reservation_time', true, NOW(), NOW()),
        ('onboarding-welcome', 'Onboarding Welcome', 'Welcome messages for new members', 'member_signup', true, NOW(), NOW())
    ON CONFLICT (campaign_id) DO NOTHING;

    RAISE NOTICE 'Created missing campaigns for existing templates';
END $$;

-- Verify the campaigns were created
SELECT 
    c.campaign_id,
    c.name,
    c.description,
    c.trigger_type,
    c.is_active,
    COUNT(t.id) as template_count
FROM campaigns c
LEFT JOIN campaign_templates t ON c.campaign_id = t.campaign_id
GROUP BY c.campaign_id, c.name, c.description, c.trigger_type, c.is_active
ORDER BY c.campaign_id;

-- Show all templates with their associated campaigns
SELECT 
    t.id,
    t.name as template_name,
    t.campaign_id,
    c.name as campaign_name,
    t.is_active
FROM campaign_templates t
LEFT JOIN campaigns c ON t.campaign_id = c.campaign_id
ORDER BY t.campaign_id, t.name; 