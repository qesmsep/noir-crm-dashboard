-- Comprehensive Campaign Migration Script
-- Handles all existing campaign tables and migrates data to new hierarchical structure

-- =============================================================================
-- 1. CHECK EXISTING TABLES AND DATA
-- =============================================================================

-- Check what tables exist
DO $$
BEGIN
    RAISE NOTICE 'Checking existing tables...';
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaigns') THEN
        RAISE NOTICE 'campaigns table: EXISTS';
    ELSE
        RAISE NOTICE 'campaigns table: DOES NOT EXIST';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaign_templates') THEN
        RAISE NOTICE 'campaign_templates table: EXISTS';
    ELSE
        RAISE NOTICE 'campaign_templates table: DOES NOT EXIST';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaign_messages') THEN
        RAISE NOTICE 'campaign_messages table: EXISTS';
    ELSE
        RAISE NOTICE 'campaign_messages table: DOES NOT EXIST';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaigns_backup') THEN
        RAISE NOTICE 'campaigns_backup table: EXISTS';
    ELSE
        RAISE NOTICE 'campaigns_backup table: DOES NOT EXIST';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaign_templates_backup') THEN
        RAISE NOTICE 'campaign_templates_backup table: EXISTS';
    ELSE
        RAISE NOTICE 'campaign_templates_backup table: DOES NOT EXIST';
    END IF;
END $$;

-- Check data in existing tables (safely)
DO $$
BEGIN
    -- Check campaigns table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaigns') THEN
        RAISE NOTICE 'campaigns table exists with % records', (SELECT COUNT(*) FROM campaigns);
        -- Show columns in campaigns table
        RAISE NOTICE 'campaigns table columns: %', (
            SELECT string_agg(column_name, ', ' ORDER BY ordinal_position)
            FROM information_schema.columns 
            WHERE table_name = 'campaigns'
        );
    ELSE
        RAISE NOTICE 'campaigns table does not exist';
    END IF;
    
    -- Check campaign_templates table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaign_templates') THEN
        RAISE NOTICE 'campaign_templates table exists with % records', (SELECT COUNT(*) FROM campaign_templates);
    ELSE
        RAISE NOTICE 'campaign_templates table does not exist';
    END IF;
    
    -- Check campaign_messages table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaign_messages') THEN
        RAISE NOTICE 'campaign_messages table exists with % records', (SELECT COUNT(*) FROM campaign_messages);
    ELSE
        RAISE NOTICE 'campaign_messages table does not exist';
    END IF;
    
    -- Check campaigns_backup table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaigns_backup') THEN
        RAISE NOTICE 'campaigns_backup table exists with % records', (SELECT COUNT(*) FROM campaigns_backup);
    ELSE
        RAISE NOTICE 'campaigns_backup table does not exist';
    END IF;
    
    -- Check campaign_templates_backup table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaign_templates_backup') THEN
        RAISE NOTICE 'campaign_templates_backup table exists with % records', (SELECT COUNT(*) FROM campaign_templates_backup);
    ELSE
        RAISE NOTICE 'campaign_templates_backup table does not exist';
    END IF;
END $$;

-- =============================================================================
-- 2. CREATE NEW TABLES (DROP OLD ONES FIRST)
-- =============================================================================

-- Drop existing tables in correct order (due to foreign key constraints)
DROP TABLE IF EXISTS scheduled_messages CASCADE;
DROP TABLE IF EXISTS campaign_messages CASCADE;
DROP TABLE IF EXISTS campaigns CASCADE;

-- Create new campaigns table
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    trigger_type TEXT NOT NULL DEFAULT 'member_signup' 
        CHECK (trigger_type IN ('member_signup', 'member_birthday', 'member_renewal', 'reservation_time', 'onboarding', 'reservation', 'birthday', 'custom')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create new campaign_messages table
CREATE TABLE campaign_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    recipient_type TEXT NOT NULL DEFAULT 'member' 
        CHECK (recipient_type IN ('member', 'all_members', 'specific_phone')),
    specific_phone TEXT,
    timing_type TEXT NOT NULL DEFAULT 'specific_time' 
        CHECK (timing_type IN ('specific_time', 'duration')),
    specific_time TEXT, -- HH:MM format
    duration_quantity INTEGER DEFAULT 1,
    duration_unit TEXT DEFAULT 'hr' 
        CHECK (duration_unit IN ('min', 'hr', 'day', 'month', 'year')),
    duration_proximity TEXT DEFAULT 'after' 
        CHECK (duration_proximity IN ('before', 'after')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create scheduled_messages table
CREATE TABLE scheduled_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_message_id UUID NOT NULL REFERENCES campaign_messages(id) ON DELETE CASCADE,
    member_id UUID REFERENCES members(member_id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    message_content TEXT NOT NULL,
    scheduled_time TIMESTAMPTZ NOT NULL,
    sent_time TIMESTAMPTZ,
    status TEXT DEFAULT 'pending' 
        CHECK (status IN ('pending', 'sent', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 3. ADD INDEXES FOR PERFORMANCE
-- =============================================================================

-- Campaigns indexes
CREATE INDEX idx_campaigns_name ON campaigns(name);
CREATE INDEX idx_campaigns_trigger_type ON campaigns(trigger_type);
CREATE INDEX idx_campaigns_is_active ON campaigns(is_active);

-- Campaign messages indexes
CREATE INDEX idx_campaign_messages_campaign_id ON campaign_messages(campaign_id);
CREATE INDEX idx_campaign_messages_is_active ON campaign_messages(is_active);
CREATE INDEX idx_campaign_messages_timing_type ON campaign_messages(timing_type);

-- Scheduled messages indexes
CREATE INDEX idx_scheduled_messages_campaign_message_id ON scheduled_messages(campaign_message_id);
CREATE INDEX idx_scheduled_messages_member_id ON scheduled_messages(member_id);
CREATE INDEX idx_scheduled_messages_scheduled_time ON scheduled_messages(scheduled_time);
CREATE INDEX idx_scheduled_messages_status ON scheduled_messages(status);

-- =============================================================================
-- 4. CREATE UPDATED_AT TRIGGERS
-- =============================================================================

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_campaign_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER trigger_update_campaigns_updated_at
    BEFORE UPDATE ON campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_campaigns_updated_at();

CREATE TRIGGER trigger_update_campaign_messages_updated_at
    BEFORE UPDATE ON campaign_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_campaign_messages_updated_at();

-- =============================================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admins can manage all campaigns"
    ON campaigns FOR ALL
    USING (is_admin());

CREATE POLICY "Anyone can view campaigns"
    ON campaigns FOR SELECT
    USING (true);

CREATE POLICY "Admins can manage all campaign messages"
    ON campaign_messages FOR ALL
    USING (is_admin());

CREATE POLICY "Anyone can view campaign messages"
    ON campaign_messages FOR SELECT
    USING (true);

CREATE POLICY "Admins can manage all scheduled messages"
    ON scheduled_messages FOR ALL
    USING (is_admin());

CREATE POLICY "Anyone can view scheduled messages"
    ON scheduled_messages FOR SELECT
    USING (true);

-- =============================================================================
-- 6. MIGRATE CAMPAIGNS FROM ALL SOURCES
-- =============================================================================

-- Migrate campaigns from campaigns table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaigns_backup') THEN
        INSERT INTO campaigns (id, name, description, trigger_type, is_active, created_at, updated_at)
        SELECT 
            id,
            COALESCE(name, campaign_id) as name,
            description,
            CASE 
                WHEN trigger_type = 'birthday' THEN 'member_birthday'
                WHEN trigger_type = 'onboarding' THEN 'member_signup'
                WHEN trigger_type = 'reservation' THEN 'reservation_time'
                WHEN trigger_type = 'custom' THEN 'member_signup'
                ELSE trigger_type
            END as trigger_type,
            is_active,
            created_at,
            updated_at
        FROM campaigns_backup
        ON CONFLICT (name) DO NOTHING;
        RAISE NOTICE 'Migrated campaigns from campaigns_backup';
    END IF;
END $$;

-- Migrate campaigns from campaigns table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaigns') THEN
        -- Check if campaigns table has campaign_id column
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'campaign_id') THEN
            -- Has campaign_id column
            INSERT INTO campaigns (id, name, description, trigger_type, is_active, created_at, updated_at)
            SELECT 
                id,
                COALESCE(name, campaign_id) as name,
                description,
                CASE 
                    WHEN trigger_type = 'birthday' THEN 'member_birthday'
                    WHEN trigger_type = 'onboarding' THEN 'member_signup'
                    WHEN trigger_type = 'reservation' THEN 'reservation_time'
                    WHEN trigger_type = 'custom' THEN 'member_signup'
                    ELSE trigger_type
                END as trigger_type,
                is_active,
                created_at,
                updated_at
            FROM campaigns
            ON CONFLICT (name) DO NOTHING;
        ELSE
            -- No campaign_id column, just use name
            INSERT INTO campaigns (id, name, description, trigger_type, is_active, created_at, updated_at)
            SELECT 
                id,
                name,
                description,
                CASE 
                    WHEN trigger_type = 'birthday' THEN 'member_birthday'
                    WHEN trigger_type = 'onboarding' THEN 'member_signup'
                    WHEN trigger_type = 'reservation' THEN 'reservation_time'
                    WHEN trigger_type = 'custom' THEN 'member_signup'
                    ELSE trigger_type
                END as trigger_type,
                is_active,
                created_at,
                updated_at
            FROM campaigns
            ON CONFLICT (name) DO NOTHING;
        END IF;
        RAISE NOTICE 'Migrated campaigns from campaigns table';
    END IF;
END $$;

-- =============================================================================
-- 7. MIGRATE CAMPAIGN MESSAGES FROM ALL SOURCES
-- =============================================================================

-- Migrate campaign messages from campaign_templates_backup
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaign_templates_backup') THEN
        INSERT INTO campaign_messages (id, campaign_id, name, description, content, recipient_type, specific_phone, timing_type, specific_time, duration_quantity, duration_unit, duration_proximity, is_active, created_at, updated_at)
        SELECT 
            ct.id,
            c.id as campaign_id,
            ct.name,
            ct.description,
            ct.content,
            ct.recipient_type,
            ct.specific_phone,
            ct.timing_type,
            ct.specific_time,
            ct.duration_quantity,
            ct.duration_unit,
            ct.duration_proximity,
            ct.is_active,
            ct.created_at,
            ct.updated_at
        FROM campaign_templates_backup ct
        JOIN campaigns c ON ct.campaign_id = c.name
        ON CONFLICT (id) DO NOTHING;
        RAISE NOTICE 'Migrated campaign messages from campaign_templates_backup';
    END IF;
END $$;

-- Migrate campaign messages from campaign_templates (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaign_templates') THEN
        INSERT INTO campaign_messages (id, campaign_id, name, description, content, recipient_type, specific_phone, timing_type, specific_time, duration_quantity, duration_unit, duration_proximity, is_active, created_at, updated_at)
        SELECT 
            ct.id,
            c.id as campaign_id,
            ct.name,
            ct.description,
            ct.content,
            ct.recipient_type,
            ct.specific_phone,
            ct.timing_type,
            ct.specific_time,
            ct.duration_quantity,
            ct.duration_unit,
            ct.duration_proximity,
            ct.is_active,
            ct.created_at,
            ct.updated_at
        FROM campaign_templates ct
        JOIN campaigns c ON ct.campaign_id = c.name
        ON CONFLICT (id) DO NOTHING;
        RAISE NOTICE 'Migrated campaign messages from campaign_templates';
    END IF;
END $$;

-- Migrate campaign messages from campaign_messages (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaign_messages') THEN
        INSERT INTO campaign_messages (id, campaign_id, name, description, content, recipient_type, specific_phone, timing_type, specific_time, duration_quantity, duration_unit, duration_proximity, is_active, created_at, updated_at)
        SELECT 
            cm.id,
            c.id as campaign_id,
            cm.name,
            cm.description,
            cm.content,
            COALESCE(cm.recipient_type, 'member') as recipient_type,
            cm.specific_phone,
            COALESCE(cm.timing_type, 'duration') as timing_type,
            cm.specific_time,
            COALESCE(cm.duration_quantity, 1) as duration_quantity,
            COALESCE(cm.duration_unit, 'hr') as duration_unit,
            COALESCE(cm.duration_proximity, 'before') as duration_proximity,
            COALESCE(cm.is_active, true) as is_active,
            cm.created_at,
            cm.updated_at
        FROM campaign_messages cm
        JOIN campaigns c ON cm.campaign_id = c.id
        ON CONFLICT (id) DO NOTHING;
        RAISE NOTICE 'Migrated campaign messages from campaign_messages table';
    END IF;
END $$;

-- =============================================================================
-- 8. CREATE DEFAULT CAMPAIGNS IF NONE EXIST
-- =============================================================================

-- Create default campaigns if none exist
INSERT INTO campaigns (name, description, trigger_type, is_active, created_at, updated_at)
VALUES 
    ('reservation-reminder', 'Reservation reminder messages', 'reservation_time', true, NOW(), NOW()),
    ('welcome-series', 'Welcome messages for new members', 'member_signup', true, NOW(), NOW()),
    ('birthday-campaign', 'Birthday messages for members', 'member_birthday', true, NOW(), NOW()),
    ('onboarding-followup', 'Follow-up messages for new members', 'member_signup', true, NOW(), NOW()),
    ('test-campaign', 'Test campaign for development', 'member_signup', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- 9. VERIFICATION AND CLEANUP
-- =============================================================================

-- Show the final structure
SELECT 
    'Final table counts' as info,
    'campaigns' as table_name,
    COUNT(*) as record_count
FROM campaigns
UNION ALL
SELECT 
    'Final table counts' as info,
    'campaign_messages' as table_name,
    COUNT(*) as record_count
FROM campaign_messages
UNION ALL
SELECT 
    'Final table counts' as info,
    'scheduled_messages' as table_name,
    COUNT(*) as record_count
FROM scheduled_messages;

-- Show campaigns with their message counts
SELECT 
    'Campaign summary' as info,
    c.name as campaign_name,
    c.description,
    c.trigger_type,
    c.is_active,
    COUNT(cm.id) as message_count
FROM campaigns c
LEFT JOIN campaign_messages cm ON c.id = cm.campaign_id
GROUP BY c.id, c.name, c.description, c.trigger_type, c.is_active
ORDER BY c.name;

-- Show sample campaign messages
SELECT 
    'Sample messages' as info,
    cm.name as message_name,
    c.name as campaign_name,
    LEFT(cm.content, 50) || '...' as content_preview,
    cm.timing_type,
    cm.duration_quantity,
    cm.duration_unit,
    cm.duration_proximity,
    cm.is_active
FROM campaign_messages cm
JOIN campaigns c ON cm.campaign_id = c.id
ORDER BY c.name, cm.name
LIMIT 10;

-- =============================================================================
-- 10. CLEANUP OLD TABLES (OPTIONAL)
-- =============================================================================

-- Uncomment these lines if you want to remove the old tables after successful migration
-- DROP TABLE IF EXISTS campaigns_backup CASCADE;
-- DROP TABLE IF EXISTS campaign_templates_backup CASCADE;
-- DROP TABLE IF EXISTS campaign_templates CASCADE;
-- DROP TABLE IF EXISTS campaign_messages CASCADE;

-- Final success message
DO $$
BEGIN
    RAISE NOTICE 'Migration completed successfully!';
END $$; 