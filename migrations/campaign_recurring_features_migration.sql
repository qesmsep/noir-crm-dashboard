-- Campaign Recurring Features Migration
-- This script adds new trigger types and enhanced functionality for recurring campaigns

-- =============================================================================
-- 1. UPDATE TRIGGER TYPES
-- =============================================================================

-- First, update the campaigns table trigger_type constraint
ALTER TABLE campaigns 
DROP CONSTRAINT IF EXISTS campaigns_trigger_type_check;

ALTER TABLE campaigns 
ADD CONSTRAINT campaigns_trigger_type_check 
CHECK (trigger_type IN (
    'member_signup', 'member_birthday', 'member_renewal', 'reservation_time',
    'recurring', 'reservation_range', 'private_event', 'all_members'
));

-- =============================================================================
-- 2. ADD NEW COLUMNS TO CAMPAIGNS TABLE
-- =============================================================================

-- Add recurring schedule columns
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS recurring_schedule JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS recurring_start_date DATE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS recurring_end_date DATE DEFAULT NULL;

-- Add reservation range columns
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS reservation_range_start TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS reservation_range_end TIMESTAMPTZ DEFAULT NULL;

-- Add private event selection column
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS selected_private_event_id UUID REFERENCES private_events(id);

-- Add event list feature columns (for future use)
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS include_event_list BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS event_list_date_range JSONB DEFAULT NULL;

-- =============================================================================
-- 3. ADD NEW COLUMNS TO CAMPAIGN_MESSAGES TABLE
-- =============================================================================

-- Add new recipient types for enhanced functionality
ALTER TABLE campaign_messages 
DROP CONSTRAINT IF EXISTS campaign_messages_recipient_type_check;

ALTER TABLE campaign_messages 
ADD CONSTRAINT campaign_messages_recipient_type_check 
CHECK (recipient_type IN (
    'member', 'all_members', 'specific_phone', 'both_members', 'specific_number',
    'reservation_phones', 'private_event_rsvps', 'all_primary_members'
));

-- Add specific number field for new recipient types
ALTER TABLE campaign_messages 
ADD COLUMN IF NOT EXISTS specific_number INTEGER DEFAULT NULL;

-- Add enhanced timing options for recurring campaigns
ALTER TABLE campaign_messages 
ADD COLUMN IF NOT EXISTS recurring_timing_type TEXT DEFAULT NULL 
CHECK (recurring_timing_type IN ('immediately', 'specific_time', 'daily', 'weekly', 'monthly', 'yearly', 'weekdays', 'first_of_month', 'last_of_month')),
ADD COLUMN IF NOT EXISTS recurring_time TEXT DEFAULT NULL, -- HH:MM format
ADD COLUMN IF NOT EXISTS recurring_weekdays INTEGER[] DEFAULT NULL, -- Array of weekday numbers (0=Sunday, 1=Monday, etc.)
ADD COLUMN IF NOT EXISTS recurring_day_of_month INTEGER DEFAULT NULL, -- For first/last of month

-- Add reservation range specific fields
ALTER TABLE campaign_messages 
ADD COLUMN IF NOT EXISTS reservation_range_include_past BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS reservation_range_minute_precision BOOLEAN DEFAULT false;

-- Add private event specific fields
ALTER TABLE campaign_messages 
ADD COLUMN IF NOT EXISTS private_event_date_range JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS private_event_include_old BOOLEAN DEFAULT false;

-- =============================================================================
-- 4. CREATE INDEXES FOR NEW FEATURES
-- =============================================================================

-- Indexes for recurring campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_recurring_schedule ON campaigns USING GIN (recurring_schedule);
CREATE INDEX IF NOT EXISTS idx_campaigns_recurring_start_date ON campaigns(recurring_start_date);
CREATE INDEX IF NOT EXISTS idx_campaigns_recurring_end_date ON campaigns(recurring_end_date);

-- Indexes for reservation range campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_reservation_range_start ON campaigns(reservation_range_start);
CREATE INDEX IF NOT EXISTS idx_campaigns_reservation_range_end ON campaigns(reservation_range_end);

-- Indexes for private event campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_selected_private_event_id ON campaigns(selected_private_event_id);

-- Indexes for campaign messages new features
CREATE INDEX IF NOT EXISTS idx_campaign_messages_recurring_timing ON campaign_messages(recurring_timing_type);
CREATE INDEX IF NOT EXISTS idx_campaign_messages_specific_number ON campaign_messages(specific_number);

-- =============================================================================
-- 5. CREATE TEST CAMPAIGNS FOR NEW TRIGGER TYPES
-- =============================================================================

-- Insert test campaigns for each new trigger type
INSERT INTO campaigns (id, name, description, trigger_type, is_active, created_at, updated_at) VALUES
(
    gen_random_uuid(),
    'TEST-Recurring-Weekly-Promotion',
    'Test recurring campaign for weekly promotions',
    'recurring',
    true,
    NOW(),
    NOW()
),
(
    gen_random_uuid(),
    'TEST-Reservation-Range-Reminder',
    'Test campaign for reservations within a specific date range',
    'reservation_range',
    true,
    NOW(),
    NOW()
),
(
    gen_random_uuid(),
    'TEST-Private-Event-RSVP',
    'Test campaign for private event RSVP notifications',
    'private_event',
    true,
    NOW(),
    NOW()
),
(
    gen_random_uuid(),
    'TEST-All-Members-Newsletter',
    'Test campaign for all members newsletter',
    'all_members',
    true,
    NOW(),
    NOW()
);

-- =============================================================================
-- 6. CREATE TEST MESSAGES FOR NEW CAMPAIGNS
-- =============================================================================

-- Get the test campaign IDs
DO $$
DECLARE
    recurring_campaign_id UUID;
    reservation_range_campaign_id UUID;
    private_event_campaign_id UUID;
    all_members_campaign_id UUID;
BEGIN
    -- Get campaign IDs
    SELECT id INTO recurring_campaign_id FROM campaigns WHERE name = 'TEST-Recurring-Weekly-Promotion' LIMIT 1;
    SELECT id INTO reservation_range_campaign_id FROM campaigns WHERE name = 'TEST-Reservation-Range-Reminder' LIMIT 1;
    SELECT id INTO private_event_campaign_id FROM campaigns WHERE name = 'TEST-Private-Event-RSVP' LIMIT 1;
    SELECT id INTO all_members_campaign_id FROM campaigns WHERE name = 'TEST-All-Members-Newsletter' LIMIT 1;

    -- Insert test messages
    IF recurring_campaign_id IS NOT NULL THEN
        INSERT INTO campaign_messages (
            campaign_id, name, description, content, recipient_type, 
            timing_type, specific_time, is_active, created_at, updated_at,
            recurring_timing_type, recurring_time, recurring_weekdays
        ) VALUES (
            recurring_campaign_id,
            'Weekly Promotion Message',
            'Test recurring weekly promotion',
            'Hello {{member_name}}! This is your weekly promotion reminder. Don''t miss out on our special offers!',
            'all_members',
            'specific_time',
            '10:00',
            true,
            NOW(),
            NOW(),
            'weekly',
            '10:00',
            ARRAY[1, 3, 5] -- Monday, Wednesday, Friday
        );
    END IF;

    IF reservation_range_campaign_id IS NOT NULL THEN
        INSERT INTO campaign_messages (
            campaign_id, name, description, content, recipient_type, 
            timing_type, specific_time, is_active, created_at, updated_at,
            reservation_range_include_past, reservation_range_minute_precision
        ) VALUES (
            reservation_range_campaign_id,
            'Reservation Range Reminder',
            'Test message for reservations in date range',
            'Hello! We noticed you have a reservation coming up. Please confirm your details.',
            'reservation_phones',
            'specific_time',
            '09:00',
            true,
            NOW(),
            NOW(),
            true,
            false
        );
    END IF;

    IF private_event_campaign_id IS NOT NULL THEN
        INSERT INTO campaign_messages (
            campaign_id, name, description, content, recipient_type, 
            timing_type, specific_time, is_active, created_at, updated_at
        ) VALUES (
            private_event_campaign_id,
            'Private Event RSVP Reminder',
            'Test message for private event RSVPs',
            'Hello! This is a reminder about your upcoming private event. Please confirm your attendance.',
            'private_event_rsvps',
            'specific_time',
            '14:00',
            true,
            NOW(),
            NOW()
        );
    END IF;

    IF all_members_campaign_id IS NOT NULL THEN
        INSERT INTO campaign_messages (
            campaign_id, name, description, content, recipient_type, 
            timing_type, specific_time, is_active, created_at, updated_at,
            include_event_list
        ) VALUES (
            all_members_campaign_id,
            'All Members Newsletter',
            'Test newsletter for all members',
            'Hello {{member_name}}! Here is your monthly newsletter with upcoming events and news.',
            'all_members',
            'specific_time',
            '12:00',
            true,
            NOW(),
            NOW(),
            false
        );
    END IF;

    RAISE NOTICE 'Test campaigns and messages created successfully';
END $$;

-- =============================================================================
-- 7. VERIFICATION QUERIES
-- =============================================================================

-- Verify the migration
SELECT 'Migration completed successfully' as status;

-- Show new trigger types
SELECT 'Available trigger types:' as info, trigger_type, COUNT(*) as count 
FROM campaigns 
GROUP BY trigger_type 
ORDER BY trigger_type;

-- Show test campaigns
SELECT 'Test campaigns created:' as info, name, trigger_type, is_active 
FROM campaigns 
WHERE name LIKE 'TEST-%' 
ORDER BY name;

-- Show new recipient types
SELECT 'Available recipient types:' as info, recipient_type, COUNT(*) as count 
FROM campaign_messages 
GROUP BY recipient_type 
ORDER BY recipient_type; 