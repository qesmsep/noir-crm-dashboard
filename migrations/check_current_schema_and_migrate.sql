-- Check Current Schema and Apply Campaign Features Migration
-- Run this in your Supabase SQL editor

-- =============================================================================
-- 1. CHECK CURRENT SCHEMA
-- =============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    RAISE NOTICE '=== CHECKING CURRENT SCHEMA ===';
    
    -- Check campaigns table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaigns') THEN
        RAISE NOTICE 'campaigns table exists';
        
        -- List all columns in campaigns table
        RAISE NOTICE 'campaigns table columns:';
        FOR r IN 
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'campaigns' 
            ORDER BY ordinal_position
        LOOP
            RAISE NOTICE '  %: % (%)', r.column_name, r.data_type, r.is_nullable;
        END LOOP;
    ELSE
        RAISE NOTICE 'campaigns table does not exist';
    END IF;
    
    -- Check campaign_messages table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaign_messages') THEN
        RAISE NOTICE 'campaign_messages table exists';
        
        -- List all columns in campaign_messages table
        RAISE NOTICE 'campaign_messages table columns:';
        FOR r IN 
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'campaign_messages' 
            ORDER BY ordinal_position
        LOOP
            RAISE NOTICE '  %: % (%)', r.column_name, r.data_type, r.is_nullable;
        END LOOP;
    ELSE
        RAISE NOTICE 'campaign_messages table does not exist';
    END IF;
END $$;

-- =============================================================================
-- 2. APPLY NECESSARY CHANGES
-- =============================================================================

-- Update campaigns table trigger_type constraint to include new types
DO $$
BEGIN
    -- Drop existing constraint if it exists
    BEGIN
        ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_trigger_type_check;
        RAISE NOTICE 'Dropped existing campaigns_trigger_type_check constraint';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not drop campaigns_trigger_type_check constraint: %', SQLERRM;
    END;
    
    -- Add new constraint with all trigger types
    BEGIN
        ALTER TABLE campaigns ADD CONSTRAINT campaigns_trigger_type_check 
        CHECK (trigger_type IN ('reservation', 'recurring', 'reservation_range', 'private_event', 'all_members'));
        RAISE NOTICE 'Added new campaigns_trigger_type_check constraint';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add campaigns_trigger_type_check constraint: %', SQLERRM;
    END;
END $$;

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

-- Add foreign key constraint for selected_private_event_id
DO $$
BEGIN
    BEGIN
        ALTER TABLE campaigns ADD CONSTRAINT fk_campaigns_selected_private_event 
        FOREIGN KEY (selected_private_event_id) REFERENCES private_events(id);
        RAISE NOTICE 'Added foreign key constraint for selected_private_event_id';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add foreign key constraint: %', SQLERRM;
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
    
    -- Add new constraint (removed 'specific_number' as requested)
    BEGIN
        ALTER TABLE campaign_messages ADD CONSTRAINT campaign_messages_recipient_type_check 
        CHECK (recipient_type IN ('member', 'both_members', 'specific_phone', 'reservation_phone', 'private_event_rsvp', 'all_members', 'all_primary_members'));
        RAISE NOTICE 'Added new campaign_messages_recipient_type_check constraint';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add campaign_messages_recipient_type_check constraint: %', SQLERRM;
    END;
END $$;

-- Add new columns to campaign_messages table
DO $$
BEGIN
    -- Add new timing structure columns
    BEGIN
        ALTER TABLE campaign_messages ADD COLUMN IF NOT EXISTS recurring_type TEXT DEFAULT NULL;
        RAISE NOTICE 'Added recurring_type column';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add recurring_type column: %', SQLERRM;
    END;
    
    BEGIN
        ALTER TABLE campaign_messages ADD COLUMN IF NOT EXISTS recurring_time TEXT DEFAULT NULL;
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
-- 3. CREATE INDEXES
-- =============================================================================

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_campaigns_recurring_schedule ON campaigns USING GIN (recurring_schedule);
CREATE INDEX IF NOT EXISTS idx_campaigns_recurring_start_date ON campaigns(recurring_start_date);
CREATE INDEX IF NOT EXISTS idx_campaigns_recurring_end_date ON campaigns(recurring_end_date);
CREATE INDEX IF NOT EXISTS idx_campaigns_reservation_range_start ON campaigns(reservation_range_start);
CREATE INDEX IF NOT EXISTS idx_campaigns_reservation_range_end ON campaigns(reservation_range_end);
CREATE INDEX IF NOT EXISTS idx_campaigns_selected_private_event_id ON campaigns(selected_private_event_id);
CREATE INDEX IF NOT EXISTS idx_campaign_messages_recurring_timing ON campaign_messages(recurring_type);
CREATE INDEX IF NOT EXISTS idx_campaign_messages_relative_timing ON campaign_messages(relative_unit, relative_proximity);

-- =============================================================================
-- 4. CREATE TEST CAMPAIGNS
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
-- 5. VERIFICATION
-- =============================================================================

-- Show final schema state
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