-- Check for duplicate members by phone number
-- Run this in your Supabase SQL editor

-- 1. Find all duplicate phone numbers
SELECT 
    phone,
    COUNT(*) as duplicate_count,
    ARRAY_AGG(member_id) as member_ids,
    ARRAY_AGG(first_name) as first_names,
    ARRAY_AGG(last_name) as last_names,
    ARRAY_AGG(created_at) as created_dates
FROM members 
WHERE phone IS NOT NULL 
GROUP BY phone 
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 2. Show all members with the specific phone number
SELECT 
    member_id,
    first_name,
    last_name,
    phone,
    email,
    created_at,
    updated_at
FROM members 
WHERE phone = '+18584129797'
ORDER BY created_at;

-- 3. Check total member count
SELECT COUNT(*) as total_members FROM members;

-- 4. Check members with null phone numbers
SELECT COUNT(*) as members_with_null_phone 
FROM members 
WHERE phone IS NULL; 