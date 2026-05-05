-- ========================================
-- Migration: Add admin_notification_phone to locations
-- Created: 2026-05-05
-- Description: Add admin_notification_phone column to locations table to enable
--              location-specific admin notification phone numbers for reservations.
--              This allows each location (Noir KC, RooftopKC) to have independent
--              admin contact numbers for reservation alerts.
--
-- Tables Affected: locations (modified)
-- Dependencies: 20260413000000_create_locations_table.sql
-- Breaking Changes: NO - Column is nullable with fallback to global settings
-- ========================================

-- ========================================
-- STEP 1: SCHEMA CHANGES
-- ========================================

-- Add admin_notification_phone column to locations table
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS admin_notification_phone TEXT;

-- Add comment explaining the column's purpose
COMMENT ON COLUMN public.locations.admin_notification_phone IS
'Phone number for SMS notifications when reservations are created or modified at this location.
The system automatically adds +1 prefix if not present.
Falls back to settings.admin_notification_phone if null.
Format: 10-digit number without country code (e.g., 9137774488)';

-- ========================================
-- STEP 2: BACKFILL WITH CURRENT GLOBAL PHONE
-- ========================================

-- Backfill existing locations with the current global admin phone from settings
-- This ensures current behavior is preserved (all locations use the same admin phone)
UPDATE public.locations
SET admin_notification_phone = (
  SELECT admin_notification_phone
  FROM public.settings
  LIMIT 1
)
WHERE admin_notification_phone IS NULL;

-- ========================================
-- STEP 3: VERIFICATION
-- ========================================

-- Verify column added and backfill successful
SELECT
  id,
  name,
  slug,
  admin_notification_phone,
  updated_at
FROM public.locations
ORDER BY name;

-- Expected output:
-- Both Noir KC and RooftopKC should have admin_notification_phone populated
-- with the same value from settings.admin_notification_phone
