-- Fix Campaign Migration
-- This script fixes the scheduled_campaign_messages table if it already exists

-- Check if scheduled_campaign_messages table exists and add missing column if needed
DO $$
BEGIN
    -- Check if the table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'scheduled_campaign_messages') THEN
        -- Check if scheduled_time column exists
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'scheduled_campaign_messages' AND column_name = 'scheduled_time') THEN
            -- Add the missing column
            ALTER TABLE scheduled_campaign_messages ADD COLUMN scheduled_time TIMESTAMPTZ NOT NULL DEFAULT NOW();
            RAISE NOTICE 'Added scheduled_time column to scheduled_campaign_messages table';
        ELSE
            RAISE NOTICE 'scheduled_time column already exists in scheduled_campaign_messages table';
        END IF;
    ELSE
        -- Create the table if it doesn't exist
        CREATE TABLE scheduled_campaign_messages (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            campaign_template_id UUID REFERENCES campaign_templates(id) ON DELETE CASCADE,
            member_id UUID REFERENCES members(id) ON DELETE CASCADE,
            phone_number TEXT NOT NULL,
            message_content TEXT NOT NULL,
            scheduled_time TIMESTAMPTZ NOT NULL,
            sent_time TIMESTAMPTZ,
            status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
            error_message TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        RAISE NOTICE 'Created scheduled_campaign_messages table';
    END IF;
END $$;

-- Add indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_scheduled_campaign_messages_template_id ON scheduled_campaign_messages(campaign_template_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_campaign_messages_member_id ON scheduled_campaign_messages(member_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_campaign_messages_scheduled_time ON scheduled_campaign_messages(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_scheduled_campaign_messages_status ON scheduled_campaign_messages(status);

-- Enable RLS if not already enabled
ALTER TABLE scheduled_campaign_messages ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON scheduled_campaign_messages TO authenticated;

-- Create RLS policies if they don't exist
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON scheduled_campaign_messages;
CREATE POLICY "Enable read access for authenticated users" ON scheduled_campaign_messages
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON scheduled_campaign_messages;
CREATE POLICY "Enable insert access for authenticated users" ON scheduled_campaign_messages
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable update access for authenticated users" ON scheduled_campaign_messages;
CREATE POLICY "Enable update access for authenticated users" ON scheduled_campaign_messages
    FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON scheduled_campaign_messages;
CREATE POLICY "Enable delete access for authenticated users" ON scheduled_campaign_messages
    FOR DELETE USING (auth.role() = 'authenticated');

SELECT 'Campaign migration fix completed successfully' as status; 