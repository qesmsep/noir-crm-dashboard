-- Fix Campaign ID System with Proper UUIDs
-- This migration fixes the campaign ID system to use proper UUIDs and prevent duplicates

-- =============================================================================
-- 1. BACKUP EXISTING DATA
-- =============================================================================

-- Backup existing campaigns table
CREATE TABLE IF NOT EXISTS backup_campaigns AS 
SELECT * FROM campaigns;

-- Backup existing campaign_templates table  
CREATE TABLE IF NOT EXISTS backup_campaign_templates AS 
SELECT * FROM campaign_templates;

-- =============================================================================
-- 2. DROP EXISTING TABLES (if they exist)
-- =============================================================================

-- Drop existing tables in correct order (due to foreign key constraints)
DROP TABLE IF EXISTS scheduled_campaign_messages CASCADE;
DROP TABLE IF EXISTS campaign_templates CASCADE;
DROP TABLE IF EXISTS campaigns CASCADE;

-- =============================================================================
-- 3. CREATE NEW CAMPAIGNS TABLE WITH PROPER UUID
-- =============================================================================

CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(), -- Changed to UUID
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL DEFAULT 'member_signup' 
        CHECK (trigger_type IN ('member_signup', 'member_birthday', 'member_renewal', 'reservation_time')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 4. CREATE NEW CAMPAIGN_TEMPLATES TABLE
-- =============================================================================

CREATE TABLE campaign_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(campaign_id) ON DELETE CASCADE, -- Changed to UUID reference
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
    trigger_type TEXT NOT NULL DEFAULT 'member_signup' 
        CHECK (trigger_type IN ('member_signup', 'member_birthday', 'member_renewal', 'reservation_time')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 5. CREATE SCHEDULED CAMPAIGN MESSAGES TABLE
-- =============================================================================

CREATE TABLE scheduled_campaign_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_template_id UUID REFERENCES campaign_templates(id) ON DELETE CASCADE,
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
CREATE INDEX idx_campaigns_campaign_id ON campaigns(campaign_id);
CREATE INDEX idx_campaigns_trigger_type ON campaigns(trigger_type);
CREATE INDEX idx_campaigns_is_active ON campaigns(is_active);

-- Campaign templates indexes
CREATE INDEX idx_campaign_templates_campaign_id ON campaign_templates(campaign_id);
CREATE INDEX idx_campaign_templates_trigger_type ON campaign_templates(trigger_type);
CREATE INDEX idx_campaign_templates_is_active ON campaign_templates(is_active);

-- Scheduled messages indexes
CREATE INDEX idx_scheduled_campaign_messages_template_id ON scheduled_campaign_messages(campaign_template_id);
CREATE INDEX idx_scheduled_campaign_messages_member_id ON scheduled_campaign_messages(member_id);
CREATE INDEX idx_scheduled_campaign_messages_scheduled_time ON scheduled_campaign_messages(scheduled_time);
CREATE INDEX idx_scheduled_campaign_messages_status ON scheduled_campaign_messages(status);

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

CREATE OR REPLACE FUNCTION update_campaign_templates_updated_at()
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

CREATE TRIGGER trigger_update_campaign_templates_updated_at
    BEFORE UPDATE ON campaign_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_campaign_templates_updated_at();

-- =============================================================================
-- 8. ENABLE ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_campaign_messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admins can manage all campaigns"
    ON campaigns FOR ALL
    USING (is_admin());

CREATE POLICY "Anyone can view campaigns"
    ON campaigns FOR SELECT
    USING (true);

CREATE POLICY "Admins can manage all campaign templates"
    ON campaign_templates FOR ALL
    USING (is_admin());

CREATE POLICY "Anyone can view campaign templates"
    ON campaign_templates FOR SELECT
    USING (true);

CREATE POLICY "Admins can manage all scheduled messages"
    ON scheduled_campaign_messages FOR ALL
    USING (is_admin());

CREATE POLICY "Anyone can view scheduled messages"
    ON scheduled_campaign_messages FOR SELECT
    USING (true);

-- =============================================================================
-- 9. MIGRATE EXISTING DATA (if any)
-- =============================================================================

-- Insert existing campaigns with new UUIDs
INSERT INTO campaigns (campaign_id, name, description, trigger_type, is_active, created_at, updated_at)
SELECT 
    uuid_generate_v4() as campaign_id,
    name,
    description,
    trigger_type,
    is_active,
    created_at,
    updated_at
FROM backup_campaigns
ON CONFLICT DO NOTHING;

-- Note: campaign_templates will need to be recreated since campaign_id changed to UUID
-- This is intentional to ensure clean data structure

-- =============================================================================
-- 10. VERIFICATION
-- =============================================================================

-- Check the new structure
SELECT 
    'campaigns' as table_name,
    COUNT(*) as record_count
FROM campaigns
UNION ALL
SELECT 
    'campaign_templates' as table_name,
    COUNT(*) as record_count
FROM campaign_templates
UNION ALL
SELECT 
    'scheduled_campaign_messages' as table_name,
    COUNT(*) as record_count
FROM scheduled_campaign_messages;

-- Show sample campaign data
SELECT 
    id,
    campaign_id,
    name,
    trigger_type,
    is_active
FROM campaigns
LIMIT 5; 