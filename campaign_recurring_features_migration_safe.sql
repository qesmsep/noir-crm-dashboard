-- Safe Campaign Recurring Features Migration
-- This script safely adds new trigger types and enhanced functionality for recurring campaigns
-- It handles cases where tables might not exist or have different schemas

-- =============================================================================
-- 1. CHECK CURRENT SCHEMA STATE
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Checking current database schema...';
    
    -- Check if campaigns table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaigns') THEN
        RAISE NOTICE 'campaigns table exists';
    ELSE
        RAISE NOTICE 'campaigns table does not exist - will create it';
    END IF;
    
    -- Check if campaign_messages table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaign_messages') THEN
        RAISE NOTICE 'campaign_messages table exists';
    ELSE
        RAISE NOTICE 'campaign_messages table does not exist - will create it';
    END IF;
END $$;

-- =============================================================================
-- 2. CREATE TABLES IF THEY DON'T EXIST
-- =============================================================================

-- Create campaigns table if it doesn't exist
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    trigger_type TEXT NOT NULL DEFAULT 'member_signup',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create campaign_messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS campaign_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    recipient_type TEXT NOT NULL DEFAULT 'member',
    specific_phone TEXT,
    timing_type TEXT NOT NULL DEFAULT 'specific_time',
    specific_time TEXT,
    duration_quantity INTEGER DEFAULT 1,
    duration_unit TEXT DEFAULT 'hr',
    duration_proximity TEXT DEFAULT 'after',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 3. UPDATE TRIGGER TYPES SAFELY
-- =============================================================================

-- Update the campaigns table trigger_type constraint safely
DO $$
BEGIN
    -- Drop existing constraint if it exists
    BEGIN
        ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_trigger_type_check;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Could not drop campaigns_trigger_type_check constraint: %', SQLERRM;
    END;
    
    -- Add new constraint
    BEGIN
        ALTER TABLE campaigns 
        ADD CONSTRAINT campaigns_trigger_type_check 
        CHECK (trigger_type IN (
            'member_signup', 'member_birthday', 'member_renewal', 'reservation_time',
            'recurring', 'reservation_range', 'private_event', 'all_members'
        ));
        RAISE NOTICE 'Successfully updated campaigns trigger_type constraint';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Could not update campaigns trigger_type constraint: %', SQLERRM;
    END;
END $$;

-- =============================================================================
-- 4. ADD NEW COLUMNS TO CAMPAIGNS TABLE
-- =============================================================================

-- Add recurring schedule columns
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS recurring_schedule JSONB DEFAULT NULL;

ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS recurring_start_date DATE DEFAULT NULL;

ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS recurring_end_date DATE DEFAULT NULL;

-- Add reservation range columns
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS reservation_range_start TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS reservation_range_end TIMESTAMPTZ DEFAULT NULL;

-- Add private event selection column
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS selected_private_event_id UUID;

-- Add foreign key constraint if private_events table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'private_events') THEN
        BEGIN
            ALTER TABLE campaigns 
            ADD CONSTRAINT fk_campaigns_private_event 
            FOREIGN KEY (selected_private_event_id) REFERENCES private_events(id);
            RAISE NOTICE 'Added foreign key constraint for selected_private_event_id';
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Could not add foreign key constraint: %', SQLERRM;
        END;
    ELSE
        RAISE NOTICE 'private_events table does not exist - skipping foreign key constraint';
    END IF;
END $$;

-- Add event list feature columns (for future use)
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS include_event_list BOOLEAN DEFAULT false;

ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS event_list_date_range JSONB DEFAULT NULL;

-- =============================================================================
-- 5. ADD NEW COLUMNS TO CAMPAIGN_MESSAGES TABLE
-- =============================================================================

-- Add new recipient types for enhanced functionality
DO $$
BEGIN
    -- Drop existing constraint if it exists
    BEGIN
        ALTER TABLE campaign_messages DROP CONSTRAINT IF EXISTS campaign_messages_recipient_type_check;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Could not drop campaign_messages_recipient_type_check constraint: %', SQLERRM;
    END;
    
    -- Add new constraint
    BEGIN
        ALTER TABLE campaign_messages 
        ADD CONSTRAINT campaign_messages_recipient_type_check 
        CHECK (recipient_type IN (
            'member', 'all_members', 'specific_phone', 'both_members', 'specific_number',
            'reservation_phones', 'private_event_rsvps', 'all_primary_members'
        ));
        RAISE NOTICE 'Successfully updated campaign_messages recipient_type constraint';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Could not update campaign_messages recipient_type constraint: %', SQLERRM;
    END;
END $$;

-- Add specific number field for new recipient types
ALTER TABLE campaign_messages 
ADD COLUMN IF NOT EXISTS specific_number INTEGER DEFAULT NULL;

-- Add enhanced timing options for recurring campaigns
ALTER TABLE campaign_messages 
ADD COLUMN IF NOT EXISTS recurring_timing_type TEXT DEFAULT NULL;

-- Add constraint for recurring_timing_type
DO $$
BEGIN
    BEGIN
        ALTER TABLE campaign_messages 
        ADD CONSTRAINT campaign_messages_recurring_timing_type_check 
        CHECK (recurring_timing_type IN ('immediately', 'specific_time', 'daily', 'weekly', 'monthly', 'yearly', 'weekdays', 'first_of_month', 'last_of_month'));
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Could not add recurring_timing_type constraint: %', SQLERRM;
    END;
END $$;

ALTER TABLE campaign_messages 
ADD COLUMN IF NOT EXISTS recurring_time TEXT DEFAULT NULL;

ALTER TABLE campaign_messages 
ADD COLUMN IF NOT EXISTS recurring_weekdays INTEGER[] DEFAULT NULL;

ALTER TABLE campaign_messages 
ADD COLUMN IF NOT EXISTS recurring_day_of_month INTEGER DEFAULT NULL;

-- Add reservation range specific fields
ALTER TABLE campaign_messages 
ADD COLUMN IF NOT EXISTS reservation_range_include_past BOOLEAN DEFAULT true;

ALTER TABLE campaign_messages 
ADD COLUMN IF NOT EXISTS reservation_range_minute_precision BOOLEAN DEFAULT false;

-- Add private event specific fields
ALTER TABLE campaign_messages 
ADD COLUMN IF NOT EXISTS private_event_date_range JSONB DEFAULT NULL;

ALTER TABLE campaign_messages 
ADD COLUMN IF NOT EXISTS private_event_include_old BOOLEAN DEFAULT false;

-- =============================================================================
-- 6. CREATE INDEXES FOR NEW FEATURES
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
-- 7. CREATE TEST CAMPAIGNS FOR NEW TRIGGER TYPES
-- =============================================================================

-- Insert test campaigns for each new trigger type
DO $$
BEGIN
    -- Check if test campaigns already exist
    IF NOT EXISTS (SELECT 1 FROM campaigns WHERE name = 'TEST-Recurring-Weekly-Promotion') THEN
        INSERT INTO campaigns (id, name, description, trigger_type, is_active, created_at, updated_at) VALUES
        (
            gen_random_uuid(),
            'TEST-Recurring-Weekly-Promotion',
            'Test recurring campaign for weekly promotions',
            'recurring',
            true,
            NOW(),
            NOW()
        );
        RAISE NOTICE 'Created TEST-Recurring-Weekly-Promotion campaign';
    ELSE
        RAISE NOTICE 'TEST-Recurring-Weekly-Promotion campaign already exists';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM campaigns WHERE name = 'TEST-Reservation-Range-Reminder') THEN
        INSERT INTO campaigns (id, name, description, trigger_type, is_active, created_at, updated_at) VALUES
        (
            gen_random_uuid(),
            'TEST-Reservation-Range-Reminder',
            'Test campaign for reservations within a specific date range',
            'reservation_range',
            true,
            NOW(),
            NOW()
        );
        RAISE NOTICE 'Created TEST-Reservation-Range-Reminder campaign';
    ELSE
        RAISE NOTICE 'TEST-Reservation-Range-Reminder campaign already exists';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM campaigns WHERE name = 'TEST-Private-Event-RSVP') THEN
        INSERT INTO campaigns (id, name, description, trigger_type, is_active, created_at, updated_at) VALUES
        (
            gen_random_uuid(),
            'TEST-Private-Event-RSVP',
            'Test campaign for private event RSVP notifications',
            'private_event',
            true,
            NOW(),
            NOW()
        );
        RAISE NOTICE 'Created TEST-Private-Event-RSVP campaign';
    ELSE
        RAISE NOTICE 'TEST-Private-Event-RSVP campaign already exists';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM campaigns WHERE name = 'TEST-All-Members-Newsletter') THEN
        INSERT INTO campaigns (id, name, description, trigger_type, is_active, created_at, updated_at) VALUES
        (
            gen_random_uuid(),
            'TEST-All-Members-Newsletter',
            'Test campaign for all members newsletter',
            'all_members',
            true,
            NOW(),
            NOW()
        );
        RAISE NOTICE 'Created TEST-All-Members-Newsletter campaign';
    ELSE
        RAISE NOTICE 'TEST-All-Members-Newsletter campaign already exists';
    END IF;
END $$;

-- =============================================================================
-- 8. VERIFICATION QUERIES
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

-- Show new recipient types (if any messages exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM campaign_messages LIMIT 1) THEN
        RAISE NOTICE 'Available recipient types:';
        FOR r IN 
            SELECT recipient_type, COUNT(*) as count 
            FROM campaign_messages 
            GROUP BY recipient_type 
            ORDER BY recipient_type
        LOOP
            RAISE NOTICE '  %: %', r.recipient_type, r.count;
        END LOOP;
    ELSE
        RAISE NOTICE 'No campaign messages found yet';
    END IF;
END $$; 