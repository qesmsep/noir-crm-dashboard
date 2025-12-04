-- Update hold fee amount to $10
-- Run this in your Supabase SQL Editor

-- First, check if settings exist
SELECT id, hold_fee_enabled, hold_fee_amount FROM settings LIMIT 1;

-- Update existing settings to $10 hold fee
UPDATE settings 
SET 
    hold_fee_enabled = true,
    hold_fee_amount = 10.00
WHERE id IS NOT NULL;

-- If no settings exist, create one with $10 hold fee
INSERT INTO settings (
    hold_fee_enabled,
    hold_fee_amount,
    business_name,
    business_email,
    business_phone,
    address,
    timezone,
    operating_hours,
    reservation_settings,
    notification_settings,
    admin_notification_phone
)
SELECT 
    true,
    10.00,
    'Noir',
    '',
    '',
    '',
    'America/Chicago',
    '{
        "monday": {"open": "09:00", "close": "17:00"},
        "tuesday": {"open": "09:00", "close": "17:00"},
        "wednesday": {"open": "09:00", "close": "17:00"},
        "thursday": {"open": "09:00", "close": "17:00"},
        "friday": {"open": "09:00", "close": "17:00"},
        "saturday": {"open": "10:00", "close": "15:00"},
        "sunday": {"open": "10:00", "close": "15:00"}
    }',
    '{
        "max_guests": 10,
        "min_notice_hours": 24,
        "max_advance_days": 30
    }',
    '{
        "email_notifications": true,
        "sms_notifications": false,
        "notification_email": ""
    }',
    ''
WHERE NOT EXISTS (SELECT 1 FROM settings);

-- Verify the update
SELECT id, hold_fee_enabled, hold_fee_amount FROM settings; 