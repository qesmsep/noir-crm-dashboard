-- Migration to add SMS notification field to venue_hours table for custom closed days
-- This allows admins to set custom SMS messages for when people try to reserve on closed days

-- Add SMS notification column to venue_hours table
ALTER TABLE public.venue_hours 
ADD COLUMN IF NOT EXISTS sms_notification TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN public.venue_hours.sms_notification IS 'Custom SMS message to send when someone tries to make a reservation on this closed day'; 