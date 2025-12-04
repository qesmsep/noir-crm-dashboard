-- Check campaign messages status
-- Run this in Supabase SQL editor

-- Check active campaign messages
SELECT 
  cm.id,
  cm.name,
  cm.is_active,
  c.name as campaign_name,
  c.trigger_type,
  cm.timing_type,
  cm.duration_quantity,
  cm.duration_unit,
  cm.duration_proximity,
  cm.specific_time
FROM campaign_messages cm
JOIN campaigns c ON cm.campaign_id = c.id
WHERE cm.is_active = true;

-- Check if there are any reservations in the next 7 days
SELECT 
  id,
  start_time,
  phone,
  first_name,
  last_name
FROM reservations 
WHERE start_time >= NOW() 
  AND start_time <= NOW() + INTERVAL '7 days'
ORDER BY start_time;

-- Check if there are any members with matching phone numbers
SELECT 
  m.member_id,
  m.first_name,
  m.last_name,
  m.phone,
  r.start_time,
  r.id as reservation_id
FROM members m
JOIN reservations r ON m.phone = r.phone
WHERE r.start_time >= NOW() 
  AND r.start_time <= NOW() + INTERVAL '7 days'
ORDER BY r.start_time; 