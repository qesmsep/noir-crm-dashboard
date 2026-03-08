-- Disable unwanted campaign messages
-- Keep only "Access" (reservation instructions) active

-- Disable duplicate welcome message
UPDATE campaign_messages
SET is_active = false
WHERE name = 'Welcome to Noir';

-- Disable test message
UPDATE campaign_messages
SET is_active = false
WHERE name = 'test';

-- Disable birthday messages (can re-enable later if needed)
UPDATE campaign_messages
SET is_active = false
WHERE name IN ('Happy Birthday!', 'Upcoming Birthday!');

-- Show current status
SELECT
  cm.name,
  cm.is_active,
  c.name as campaign_name,
  c.trigger_type,
  cm.timing_type,
  cm.recipient_type
FROM campaign_messages cm
LEFT JOIN campaigns c ON cm.campaign_id = c.id
ORDER BY cm.is_active DESC, c.name, cm.name;
