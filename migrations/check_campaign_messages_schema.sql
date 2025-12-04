-- Check current campaign_messages table structure
DO $$
DECLARE
    r RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaign_messages') THEN
        RAISE NOTICE 'campaign_messages table structure:';
        FOR r IN 
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'campaign_messages'
            ORDER BY ordinal_position
        LOOP
            RAISE NOTICE '  %: % (nullable: %, default: %)', r.column_name, r.data_type, r.is_nullable, r.column_default;
        END LOOP;
    ELSE
        RAISE NOTICE 'campaign_messages table does not exist';
    END IF;
END $$;

-- Check if new columns exist
SELECT 
    column_name,
    data_type,
    is_nullable
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