-- Test campaign_messages table
-- Run this in Supabase SQL editor

-- First, let's check if we have any campaigns
SELECT id, name, trigger_type FROM campaigns LIMIT 5;

-- Now let's test inserting a campaign message
INSERT INTO campaign_messages (
  campaign_id,
  name,
  description,
  content,
  recipient_type,
  timing_type,
  duration_quantity,
  duration_unit,
  duration_proximity,
  is_active
) VALUES (
  (SELECT id FROM campaigns LIMIT 1), -- Use the first campaign
  'Test Message',
  'Test description',
  'This is a test message content',
  'member',
  'duration',
  24,
  'hr',
  'before',
  true
) RETURNING *;

-- Check if it was inserted
SELECT * FROM campaign_messages ORDER BY created_at DESC LIMIT 5;

-- Clean up test data
DELETE FROM campaign_messages WHERE name = 'Test Message'; 