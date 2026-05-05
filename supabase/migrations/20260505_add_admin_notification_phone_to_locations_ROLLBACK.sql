-- ========================================
-- ROLLBACK: Add admin_notification_phone to locations
-- Created: 2026-05-05
-- Description: Rollback migration that added admin_notification_phone column
--              to locations table. Removes the column entirely.
--
-- WARNING: This will remove all location-specific admin phone numbers.
-- ========================================

-- Remove admin_notification_phone column from locations table
ALTER TABLE public.locations
  DROP COLUMN IF EXISTS admin_notification_phone;

-- Verify column removed
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'locations' AND column_name = 'admin_notification_phone';

-- Expected output: No rows (column should not exist)
