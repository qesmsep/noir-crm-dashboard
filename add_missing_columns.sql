-- Add missing columns to campaign_messages table
-- This script adds only the essential columns needed for the new timing features

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

-- Verify the columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'campaign_messages' 
AND column_name IN (
    'recurring_type',
    'recurring_time', 
    'recurring_weekdays',
    'recurring_monthly_type',
    'recurring_monthly_day',
    'recurring_monthly_value',
    'recurring_yearly_date',
    'relative_time',
    'relative_quantity',
    'relative_unit',
    'relative_proximity',
    'specific_date'
)
ORDER BY column_name; 