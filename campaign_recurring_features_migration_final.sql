-- Final Campaign Recurring Features Migration
-- This script safely adds new trigger types and enhanced functionality
-- Works with existing schema and handles backup tables

-- =============================================================================
-- 1. CHECK CURRENT SCHEMA STATE
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Checking current database schema...';
    
    -- Check campaigns table structure
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaigns') THEN
        RAISE NOTICE 'campaigns table exists';
        
        -- Check if trigger_type column exists
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'trigger_type') THEN
            RAISE NOTICE 'trigger_type column exists in campaigns table';
        ELSE
            RAISE NOTICE 'trigger_type column does not exist in campaigns table';
        END IF;
    ELSE
        RAISE NOTICE 'campaigns table does not exist';
    END IF;
    
    -- Check campaign_messages table structure
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaign_messages') THEN
        RAISE NOTICE 'campaign_messages table exists';
        
        -- Check if recipient_type column exists
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_messages' AND column_name = 'recipient_type') THEN
            RAISE NOTICE 'recipient_type column exists in campaign_messages table';
        ELSE
            RAISE NOTICE 'recipient_type column does not exist in campaign_messages table';
        END IF;
    ELSE
        RAISE NOTICE 'campaign_messages table does not exist';
    END IF;
END $$;

-- =============================================================================
-- 2. UPDATE CAMPAIGNS TABLE
-- =============================================================================

-- Add new columns to campaigns table
DO $$
BEGIN
    -- Add recurring schedule columns
    BEGIN
        ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS recurring_schedule JSONB DEFAULT NULL;
        RAISE NOTICE 'Added recurring_schedule column';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add recurring_schedule column: %', SQLERRM;
    END;
    
    BEGIN
        ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS recurring_start_date DATE DEFAULT NULL;
        RAISE NOTICE 'Added recurring_start_date column';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add recurring_start_date column: %', SQLERRM;
    END;
    
    BEGIN
        ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS recurring_end_date DATE DEFAULT NULL;
        RAISE NOTICE 'Added recurring_end_date column';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add recurring_end_date column: %', SQLERRM;
    END;
    
    -- Add reservation range columns
    BEGIN
        ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS reservation_range_start TIMESTAMPTZ DEFAULT NULL;
        RAISE NOTICE 'Added reservation_range_start column';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add reservation_range_start column: %', SQLERRM;
    END;
    
    BEGIN
        ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS reservation_range_end TIMESTAMPTZ DEFAULT NULL;
        RAISE NOTICE 'Added reservation_range_end column';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add reservation_range_end column: %', SQLERRM;
    END;
    
    -- Add private event selection column
    BEGIN
        ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS selected_private_event_id UUID;
        RAISE NOTICE 'Added selected_private_event_id column';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add selected_private_event_id column: %', SQLERRM;
    END;
    
    -- Add event list feature columns
    BEGIN
        ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS include_event_list BOOLEAN DEFAULT false;
        RAISE NOTICE 'Added include_event_list column';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add include_event_list column: %', SQLERRM;
    END;
    
    BEGIN
        ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS event_list_date_range JSONB DEFAULT NULL;
        RAISE NOTICE 'Added event_list_date_range column';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add event_list_date_range column: %', SQLERRM;
    END;
END $$;

-- =============================================================================
-- 3. UPDATE CAMPAIGN_MESSAGES TABLE
-- =============================================================================

-- Add new columns to campaign_messages table
DO $$
BEGIN
    -- Add enhanced timing options for recurring campaigns
    BEGIN
        ALTER TABLE campaign_messages ADD COLUMN IF NOT EXISTS recurring_type TEXT DEFAULT NULL;
        RAISE NOTICE 'Added recurring_type column';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add recurring_type column: %', SQLERRM;
    END;
    
    BEGIN
        ALTER TABLE campaign_messages ADD COLUMN IF NOT EXISTS recurring_time TEXT DEFAULT '10:00';
        RAISE NOTICE 'Added recurring_time column';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add recurring_time column: %', SQLERRM;
    END;
    
    BEGIN
        ALTER TABLE campaign_messages ADD COLUMN IF NOT EXISTS recurring_weekdays INTEGER[] DEFAULT NULL;
        RAISE NOTICE 'Added recurring_weekdays column';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add recurring_weekdays column: %', SQLERRM;
    END;
    
    BEGIN
        ALTER TABLE campaign_messages ADD COLUMN IF NOT EXISTS recurring_monthly_type TEXT DEFAULT NULL;
        RAISE NOTICE 'Added recurring_monthly_type column';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add recurring_monthly_type column: %', SQLERRM;
    END;
    
    BEGIN
        ALTER TABLE campaign_messages ADD COLUMN IF NOT EXISTS recurring_monthly_day TEXT DEFAULT NULL;
        RAISE NOTICE 'Added recurring_monthly_day column';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add recurring_monthly_day column: %', SQLERRM;
    END;
    
    BEGIN
        ALTER TABLE campaign_messages ADD COLUMN IF NOT EXISTS recurring_monthly_value INTEGER DEFAULT NULL;
        RAISE NOTICE 'Added recurring_monthly_value column';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add recurring_monthly_value column: %', SQLERRM;
    END;
    
    BEGIN
        ALTER TABLE campaign_messages ADD COLUMN IF NOT EXISTS recurring_yearly_date TEXT DEFAULT NULL;
        RAISE NOTICE 'Added recurring_yearly_date column';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add recurring_yearly_date column: %', SQLERRM;
    END;
    
    -- Add relative timing fields
    BEGIN
        ALTER TABLE campaign_messages ADD COLUMN IF NOT EXISTS relative_time TEXT DEFAULT NULL;
        RAISE NOTICE 'Added relative_time column';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add relative_time column: %', SQLERRM;
    END;
    
    BEGIN
        ALTER TABLE campaign_messages ADD COLUMN IF NOT EXISTS relative_quantity INTEGER DEFAULT NULL;
        RAISE NOTICE 'Added relative_quantity column';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add relative_quantity column: %', SQLERRM;
    END;
    
    BEGIN
        ALTER TABLE campaign_messages ADD COLUMN IF NOT EXISTS relative_unit TEXT DEFAULT NULL;
        RAISE NOTICE 'Added relative_unit column';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add relative_unit column: %', SQLERRM;
    END;
    
    BEGIN
        ALTER TABLE campaign_messages ADD COLUMN IF NOT EXISTS relative_proximity TEXT DEFAULT NULL;
        RAISE NOTICE 'Added relative_proximity column';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add relative_proximity column: %', SQLERRM;
    END;
    
    -- Add specific date field
    BEGIN
        ALTER TABLE campaign_messages ADD COLUMN IF NOT EXISTS specific_date TEXT DEFAULT NULL;
        RAISE NOTICE 'Added specific_date column';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add specific_date column: %', SQLERRM;
    END;
    
    -- Add reservation range specific fields
    BEGIN
        ALTER TABLE campaign_messages ADD COLUMN IF NOT EXISTS reservation_range_include_past BOOLEAN DEFAULT true;
        RAISE NOTICE 'Added reservation_range_include_past column';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add reservation_range_include_past column: %', SQLERRM;
    END;
    
    BEGIN
        ALTER TABLE campaign_messages ADD COLUMN IF NOT EXISTS reservation_range_minute_precision BOOLEAN DEFAULT false;
        RAISE NOTICE 'Added reservation_range_minute_precision column';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add reservation_range_minute_precision column: %', SQLERRM;
    END;
    
    -- Add private event specific fields
    BEGIN
        ALTER TABLE campaign_messages ADD COLUMN IF NOT EXISTS private_event_date_range JSONB DEFAULT NULL;
        RAISE NOTICE 'Added private_event_date_range column';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add private_event_date_range column: %', SQLERRM;
    END;
    
    BEGIN
        ALTER TABLE campaign_messages ADD COLUMN IF NOT EXISTS private_event_include_old BOOLEAN DEFAULT false;
        RAISE NOTICE 'Added private_event_include_old column';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add private_event_include_old column: %', SQLERRM;
    END;
END $$;

-- =============================================================================
-- 4. UPDATE CONSTRAINTS SAFELY
-- =============================================================================

-- Update campaigns table trigger_type constraint
DO $$
BEGIN
    -- Drop existing constraint if it exists
    BEGIN
        ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_trigger_type_check;
        RAISE NOTICE 'Dropped existing campaigns_trigger_type_check constraint';
    EXCEPTION WHEN OTHERS THEN
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
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not update campaigns trigger_type constraint: %', SQLERRM;
    END;
END $$;

-- Update campaign_messages table recipient_type constraint
DO $$
BEGIN
    -- Drop existing constraint if it exists
    BEGIN
        ALTER TABLE campaign_messages DROP CONSTRAINT IF EXISTS campaign_messages_recipient_type_check;
        RAISE NOTICE 'Dropped existing campaign_messages_recipient_type_check constraint';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not drop campaign_messages_recipient_type_check constraint: %', SQLERRM;
    END;
    
    -- Add new constraint
    BEGIN
        ALTER TABLE campaign_messages 
        ADD CONSTRAINT campaign_messages_recipient_type_check 
        CHECK (recipient_type IN (
            'member', 'all_members', 'specific_phone', 'both_members',
            'reservation_phones', 'private_event_rsvps', 'all_primary_members'
        ));
        RAISE NOTICE 'Successfully updated campaign_messages recipient_type constraint';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not update campaign_messages recipient_type constraint: %', SQLERRM;
    END;
END $$;

-- =============================================================================
-- 5. CREATE INDEXES FOR NEW FEATURES
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
CREATE INDEX IF NOT EXISTS idx_campaign_messages_recurring_timing ON campaign_messages(recurring_type);
CREATE INDEX IF NOT EXISTS idx_campaign_messages_specific_number ON campaign_messages(specific_number);

-- =============================================================================
-- 6. CREATE TEST CAMPAIGNS FOR NEW TRIGGER TYPES
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

-- Show new recipient types (if any messages exist)
DO $$
DECLARE
    r RECORD;
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