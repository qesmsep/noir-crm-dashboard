-- Check if there are any members with the phone number from the reservation
-- Run this in Supabase SQL editor

-- Check for members with the exact phone number
SELECT 
  member_id,
  first_name,
  last_name,
  phone,
  email,
  account_id
FROM members 
WHERE phone = '18584129797';

-- Check for members with similar phone number formats
SELECT 
  member_id,
  first_name,
  last_name,
  phone,
  email,
  account_id
FROM members 
WHERE phone LIKE '%18584129797%' 
   OR phone LIKE '%8584129797%'
   OR phone = '+18584129797'
   OR phone = '+18584129797';

-- Check if there are any members at all
SELECT COUNT(*) as total_members FROM members;

-- Show a few sample members to see phone number format
SELECT 
  member_id,
  first_name,
  last_name,
  phone,
  email
FROM members 
LIMIT 5; 