-- Create Hierarchical Campaign System
-- Separate tables for campaigns and campaign messages with proper UUID relationships

-- =============================================================================
-- 1. BACKUP EXISTING DATA
-- =============================================================================

-- Backup existing tables (only if they exist)
CREATE TABLE IF NOT EXISTS backup_campaigns AS 
SELECT * FROM campaigns WHERE 1=0;

-- Only backup campaign_templates if the table exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'campaign_templates') THEN
        CREATE TABLE IF NOT EXISTS backup_campaign_templates AS 
        SELECT * FROM campaign_templates;
        RAISE NOTICE 'Backed up campaign_templates table';
    ELSE
        RAISE NOTICE 'campaign_templates table does not exist, skipping backup';
    END IF;
END $$;

-- =============================================================================
-- 2. DROP EXISTING TABLES (if they exist)
-- =============================================================================

-- Drop existing tables in correct order (due to foreign key constraints)
DROP TABLE IF EXISTS scheduled_campaign_messages CASCADE;
DROP TABLE IF EXISTS campaign_templates CASCADE;
DROP TABLE IF EXISTS campaigns CASCADE;

-- =============================================================================
-- 3. CREATE NEW CAMPAIGNS TABLE
-- =============================================================================

CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    trigger_type TEXT NOT NULL DEFAULT 'member_signup' 
        CHECK (trigger_type IN ('member_signup', 'member_birthday', 'member_renewal', 'reservation_time')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 4. CREATE NEW CAMPAIGN_MESSAGES TABLE
-- =============================================================================

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

-- =============================================================================
-- 5. CREATE SCHEDULED_MESSAGES TABLE
-- =============================================================================

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
-- 6. ADD INDEXES FOR PERFORMANCE
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
-- 7. CREATE UPDATED_AT TRIGGERS
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
-- 8. ENABLE ROW LEVEL SECURITY
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
-- 9. MIGRATE EXISTING DATA
-- =============================================================================

-- Insert campaigns from backup (only if backup has data)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM backup_campaigns LIMIT 1) THEN
        INSERT INTO campaigns (id, name, description, trigger_type, is_active, created_at, updated_at)
        SELECT 
            id,
            name,
            description,
            trigger_type,
            is_active,
            created_at,
            updated_at
        FROM backup_campaigns
        ON CONFLICT (name) DO NOTHING;
        RAISE NOTICE 'Migrated campaigns from backup';
    ELSE
        RAISE NOTICE 'No campaigns to migrate from backup';
    END IF;
END $$;

-- Insert campaign messages from backup (only if backup table exists and has data)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'backup_campaign_templates') THEN
        IF EXISTS (SELECT 1 FROM backup_campaign_templates LIMIT 1) THEN
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
            FROM backup_campaign_templates ct
            JOIN campaigns c ON ct.campaign_id = c.name
            ON CONFLICT (id) DO NOTHING;
            RAISE NOTICE 'Migrated campaign messages from backup';
        ELSE
            RAISE NOTICE 'No campaign messages to migrate from backup';
        END IF;
    ELSE
        RAISE NOTICE 'No backup_campaign_templates table to migrate from';
    END IF;
END $$;

-- =============================================================================
-- 10. CREATE DEFAULT CAMPAIGNS
-- =============================================================================

-- Create default campaigns if they don't exist
INSERT INTO campaigns (name, description, trigger_type, is_active, created_at, updated_at)
VALUES 
    ('reservation-reminder', 'Reservation reminder messages', 'reservation_time', true, NOW(), NOW()),
    ('welcome-series', 'Welcome messages for new members', 'member_signup', true, NOW(), NOW()),
    ('birthday-campaign', 'Birthday messages for members', 'member_birthday', true, NOW(), NOW()),
    ('onboarding-followup', 'Follow-up messages for new members', 'member_signup', true, NOW(), NOW()),
    ('test-campaign', 'Test campaign for development', 'member_signup', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- 11. VERIFICATION
-- =============================================================================

-- Show the new structure
SELECT 
    'Campaigns' as table_name,
    COUNT(*) as record_count
FROM campaigns
UNION ALL
SELECT 
    'Campaign Messages' as table_name,
    COUNT(*) as record_count
FROM campaign_messages
UNION ALL
SELECT 
    'Scheduled Messages' as table_name,
    COUNT(*) as record_count
FROM scheduled_messages;

-- Show campaigns with their message counts
SELECT 
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
    cm.name as message_name,
    c.name as campaign_name,
    cm.content,
    cm.timing_type,
    cm.duration_quantity,
    cm.duration_unit,
    cm.duration_proximity,
    cm.is_active
FROM campaign_messages cm
JOIN campaigns c ON cm.campaign_id = c.id
ORDER BY c.name, cm.name; 