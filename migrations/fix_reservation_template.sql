-- Fix the reservation reminder template trigger type
UPDATE campaign_templates 
SET trigger_type = 'reservation_time'
WHERE id = '405f132f-a8f9-40dc-a5f5-2d2e0439b00d' 
AND name = '24 hour notice';

-- Also fix the "Access" template which has the same issue
UPDATE campaign_templates 
SET trigger_type = 'reservation_time'
WHERE id = '4ffdae63-6be1-44ec-ac65-2aa3e41d24c6' 
AND name = 'Access';

-- Verify the changes
SELECT id, name, trigger_type, timing_type, duration_quantity, duration_unit, duration_proximity
FROM campaign_templates 
WHERE name IN ('24 hour notice', 'Access'); 