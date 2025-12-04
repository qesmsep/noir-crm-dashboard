-- Create a member record for the reservation
-- Run this in Supabase SQL editor

-- First check if the member already exists
SELECT * FROM members WHERE phone = '18584129797';

-- If no member exists, create one
INSERT INTO members (
  member_id,
  account_id,
  first_name,
  last_name,
  email,
  phone,
  member_type,
  join_date,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  gen_random_uuid(),
  'Tim',
  'Wirick',
  'tim@828.life',
  '18584129797',
  'primary',
  NOW(),
  NOW(),
  NOW()
) ON CONFLICT (phone) DO NOTHING;

-- Verify the member was created
SELECT * FROM members WHERE phone = '18584129797'; 