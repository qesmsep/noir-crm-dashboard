-- Create test reservations for June 28th, 2025 for iPad testing
-- This script will create multiple reservations with different party sizes and times

-- First, let's get some table IDs to use
-- We'll use tables with different capacities for variety

-- Insert test reservations for June 28th, 2025
INSERT INTO reservations (
  start_time,
  end_time,
  party_size,
  event_type,
  notes,
  phone,
  email,
  first_name,
  last_name,
  membership_type,
  table_id,
  source
) VALUES
-- Morning reservations
('2025-06-28T11:00:00.000Z', '2025-06-28T12:30:00.000Z', 2, 'Brunch', 'Window seat preferred', '+15551234567', 'john.doe@email.com', 'John', 'Doe', 'non-member', (SELECT id FROM tables WHERE table_number = '02' LIMIT 1), 'website'),
('2025-06-28T11:30:00.000Z', '2025-06-28T13:00:00.000Z', 4, 'Business Meeting', 'Quiet area if possible', '+15551234568', 'jane.smith@email.com', 'Jane', 'Smith', 'member', (SELECT id FROM tables WHERE table_number = '05' LIMIT 1), 'website'),
('2025-06-28T12:00:00.000Z', '2025-06-28T13:30:00.000Z', 6, 'Family Lunch', 'High chair needed', '+15551234569', 'mike.johnson@email.com', 'Mike', 'Johnson', 'non-member', (SELECT id FROM tables WHERE table_number = '04' LIMIT 1), 'website'),

-- Afternoon reservations
('2025-06-28T14:00:00.000Z', '2025-06-28T15:30:00.000Z', 2, 'Afternoon Tea', 'Celebrating anniversary', '+15551234570', 'sarah.wilson@email.com', 'Sarah', 'Wilson', 'member', (SELECT id FROM tables WHERE table_number = '03' LIMIT 1), 'website'),
('2025-06-28T14:30:00.000Z', '2025-06-28T16:30:00.000Z', 8, 'Birthday Party', 'Birthday decorations please', '+15551234571', 'david.brown@email.com', 'David', 'Brown', 'non-member', (SELECT id FROM tables WHERE table_number = '11' LIMIT 1), 'website'),
('2025-06-28T15:00:00.000Z', '2025-06-28T16:30:00.000Z', 3, 'Coffee Meeting', 'Near power outlet', '+15551234572', 'lisa.garcia@email.com', 'Lisa', 'Garcia', 'member', (SELECT id FROM tables WHERE table_number = '06' LIMIT 1), 'website'),

-- Evening reservations
('2025-06-28T17:00:00.000Z', '2025-06-28T18:30:00.000Z', 2, 'Date Night', 'Romantic setting preferred', '+15551234573', 'alex.taylor@email.com', 'Alex', 'Taylor', 'non-member', (SELECT id FROM tables WHERE table_number = '09' LIMIT 1), 'website'),
('2025-06-28T17:30:00.000Z', '2025-06-28T19:30:00.000Z', 10, 'Corporate Dinner', 'Business casual attire', '+15551234574', 'emma.davis@email.com', 'Emma', 'Davis', 'member', (SELECT id FROM tables WHERE table_number = '08' LIMIT 1), 'website'),
('2025-06-28T18:00:00.000Z', '2025-06-28T19:30:00.000Z', 4, 'Friends Dinner', 'Celebrating graduation', '+15551234575', 'chris.martinez@email.com', 'Chris', 'Martinez', 'non-member', (SELECT id FROM tables WHERE table_number = '07' LIMIT 1), 'website'),
('2025-06-28T18:30:00.000Z', '2025-06-28T20:00:00.000Z', 2, 'Anniversary', 'Special occasion', '+15551234576', 'rachel.lee@email.com', 'Rachel', 'Lee', 'member', (SELECT id FROM tables WHERE table_number = '10' LIMIT 1), 'website'),

-- Late evening reservations
('2025-06-28T19:00:00.000Z', '2025-06-28T20:30:00.000Z', 6, 'Group Dinner', 'Birthday celebration', '+15551234577', 'tom.anderson@email.com', 'Tom', 'Anderson', 'non-member', (SELECT id FROM tables WHERE table_number = '12' LIMIT 1), 'website'),
('2025-06-28T19:30:00.000Z', '2025-06-28T21:00:00.000Z', 2, 'Dinner Date', 'First date', '+15551234578', 'sophia.clark@email.com', 'Sophia', 'Clark', 'member', (SELECT id FROM tables WHERE table_number = '01' LIMIT 1), 'website'),
('2025-06-28T20:00:00.000Z', '2025-06-28T21:30:00.000Z', 4, 'Family Dinner', 'Weekend family time', '+15551234579', 'daniel.white@email.com', 'Daniel', 'White', 'non-member', (SELECT id FROM tables WHERE table_number = '05' LIMIT 1), 'website'),
('2025-06-28T20:30:00.000Z', '2025-06-28T22:00:00.000Z', 8, 'Celebration', 'Engagement party', '+15551234580', 'olivia.hall@email.com', 'Olivia', 'Hall', 'member', (SELECT id FROM tables WHERE table_number = '13' LIMIT 1), 'website'),

-- Some reservations with special notes
('2025-06-28T13:00:00.000Z', '2025-06-28T14:30:00.000Z', 2, 'Lunch Meeting', 'Allergic to nuts - please inform kitchen', '+15551234583', 'robert.scott@email.com', 'Robert', 'Scott', 'non-member', (SELECT id FROM tables WHERE table_number = '09' LIMIT 1), 'website'),
('2025-06-28T16:30:00.000Z', '2025-06-28T18:00:00.000Z', 5, 'Team Building', 'Vegetarian options needed for 2 people', '+15551234584', 'jennifer.adams@email.com', 'Jennifer', 'Adams', 'member', (SELECT id FROM tables WHERE table_number = '04' LIMIT 1), 'website'),
('2025-06-28T19:00:00.000Z', '2025-06-28T20:30:00.000Z', 2, 'Anniversary Dinner', 'Gluten-free menu required', '+15551234585', 'michael.baker@email.com', 'Michael', 'Baker', 'non-member', (SELECT id FROM tables WHERE table_number = '02' LIMIT 1), 'website');

-- Display the created reservations
SELECT 
  r.id,
  r.first_name || ' ' || r.last_name as customer_name,
  r.party_size,
  r.event_type,
  r.start_time,
  r.end_time,
  r.membership_type,
  t.table_number,
  r.notes
FROM reservations r
LEFT JOIN tables t ON r.table_id = t.id
WHERE DATE(r.start_time) = '2025-06-28'
ORDER BY r.start_time; 