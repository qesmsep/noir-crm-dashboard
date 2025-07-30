-- Campaign Hierarchy Migration (Safe Version)
-- This migration creates a hierarchical campaign system with campaigns and templates
-- Handles cases where tables might already exist

-- Backup existing tables if they exist
CREATE TABLE IF NOT EXISTS backup_campaign_templates AS 
SELECT * FROM campaign_templates WHERE 1=0;

CREATE TABLE IF NOT EXISTS backup_onboarding_templates AS 
SELECT * FROM onboarding_templates WHERE 1=0;

-- Create campaigns table (top level) - safe creation
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'campaigns') THEN
        CREATE TABLE campaigns (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            campaign_id TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            description TEXT,
            trigger_type TEXT NOT NULL DEFAULT 'onboarding' CHECK (trigger_type IN ('onboarding', 'reservation', 'birthday', 'custom')),
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        RAISE NOTICE 'Created campaigns table';
    ELSE
        RAISE NOTICE 'campaigns table already exists';
    END IF;
END $$;

-- Create campaign_templates table (templates within campaigns) - safe creation
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'campaign_templates') THEN
        CREATE TABLE campaign_templates (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            campaign_id TEXT NOT NULL REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            description TEXT,
            content TEXT NOT NULL,
            recipient_type TEXT NOT NULL DEFAULT 'member' CHECK (recipient_type IN ('member', 'all_members', 'specific_phone')),
            specific_phone TEXT,
            timing_type TEXT NOT NULL DEFAULT 'specific_time' CHECK (timing_type IN ('specific_time', 'duration')),
            specific_time TEXT, -- HH:MM format
            duration_quantity INTEGER DEFAULT 1,
            duration_unit TEXT DEFAULT 'hr' CHECK (duration_unit IN ('min', 'hr', 'day', 'month', 'year')),
            duration_proximity TEXT DEFAULT 'after' CHECK (duration_proximity IN ('before', 'after')),
            trigger_type TEXT NOT NULL DEFAULT 'onboarding' CHECK (trigger_type IN ('onboarding', 'reservation', 'birthday', 'custom')),
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        RAISE NOTICE 'Created campaign_templates table';
    ELSE
        RAISE NOTICE 'campaign_templates table already exists';
    END IF;
END $$;

-- Create scheduled_campaign_messages table - safe creation
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'scheduled_campaign_messages') THEN
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
    ELSE
        -- Check if scheduled_time column exists
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'scheduled_campaign_messages' AND column_name = 'scheduled_time') THEN
            ALTER TABLE scheduled_campaign_messages ADD COLUMN scheduled_time TIMESTAMPTZ NOT NULL DEFAULT NOW();
            RAISE NOTICE 'Added scheduled_time column to existing scheduled_campaign_messages table';
        ELSE
            RAISE NOTICE 'scheduled_campaign_messages table already exists with scheduled_time column';
        END IF;
    END IF;
END $$;

-- Add indexes for better performance (safe creation)
CREATE INDEX IF NOT EXISTS idx_campaigns_campaign_id ON campaigns(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_trigger_type ON campaigns(trigger_type);
CREATE INDEX IF NOT EXISTS idx_campaigns_is_active ON campaigns(is_active);
CREATE INDEX IF NOT EXISTS idx_campaign_templates_campaign_id ON campaign_templates(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_templates_trigger_type ON campaign_templates(trigger_type);
CREATE INDEX IF NOT EXISTS idx_campaign_templates_is_active ON campaign_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_scheduled_campaign_messages_template_id ON scheduled_campaign_messages(campaign_template_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_campaign_messages_member_id ON scheduled_campaign_messages(member_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_campaign_messages_scheduled_time ON scheduled_campaign_messages(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_scheduled_campaign_messages_status ON scheduled_campaign_messages(status);

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

-- Create triggers for updated_at (safe creation)
DROP TRIGGER IF EXISTS update_campaigns_updated_at_trigger ON campaigns;
CREATE TRIGGER update_campaigns_updated_at_trigger
    BEFORE UPDATE ON campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_campaigns_updated_at();

DROP TRIGGER IF EXISTS update_campaign_templates_updated_at_trigger ON campaign_templates;
CREATE TRIGGER update_campaign_templates_updated_at_trigger
    BEFORE UPDATE ON campaign_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_campaign_templates_updated_at();

-- Insert sample campaigns (only if they don't exist)
INSERT INTO campaigns (campaign_id, name, description, trigger_type, is_active) 
SELECT 'welcome-series', 'Welcome Series', 'Automated welcome messages for new members', 'onboarding', true
WHERE NOT EXISTS (SELECT 1 FROM campaigns WHERE campaign_id = 'welcome-series');

INSERT INTO campaigns (campaign_id, name, description, trigger_type, is_active) 
SELECT 'reservation-followup', 'Reservation Follow-up', 'Follow-up messages after reservations', 'reservation', true
WHERE NOT EXISTS (SELECT 1 FROM campaigns WHERE campaign_id = 'reservation-followup');

INSERT INTO campaigns (campaign_id, name, description, trigger_type, is_active) 
SELECT 'birthday-campaign', 'Birthday Wishes', 'Birthday messages for members', 'birthday', true
WHERE NOT EXISTS (SELECT 1 FROM campaigns WHERE campaign_id = 'birthday-campaign');

INSERT INTO campaigns (campaign_id, name, description, trigger_type, is_active) 
SELECT 'custom-campaign', 'Custom Campaign', 'Custom campaign for special events', 'custom', true
WHERE NOT EXISTS (SELECT 1 FROM campaigns WHERE campaign_id = 'custom-campaign');

-- Insert sample campaign templates (only if they don't exist)
INSERT INTO campaign_templates (campaign_id, name, description, content, recipient_type, timing_type, specific_time, trigger_type, is_active) 
SELECT 'welcome-series', 'Welcome Message', 'Initial welcome message', 'Welcome to Noir, {{first_name}}! We''re excited to have you as a member. {{member_name}}', 'member', 'specific_time', '10:00', 'onboarding', true
WHERE NOT EXISTS (SELECT 1 FROM campaign_templates WHERE campaign_id = 'welcome-series' AND name = 'Welcome Message');

INSERT INTO campaign_templates (campaign_id, name, description, content, recipient_type, timing_type, duration_quantity, duration_unit, duration_proximity, trigger_type, is_active) 
SELECT 'welcome-series', 'Follow-up Message', 'Follow-up after 24 hours', 'Hi {{first_name}}! How are you enjoying your Noir membership so far?', 'member', 'duration', 24, 'hr', 'after', 'onboarding', true
WHERE NOT EXISTS (SELECT 1 FROM campaign_templates WHERE campaign_id = 'welcome-series' AND name = 'Follow-up Message');

INSERT INTO campaign_templates (campaign_id, name, description, content, recipient_type, timing_type, specific_time, trigger_type, is_active) 
SELECT 'reservation-followup', 'Reservation Confirmation', 'Confirm reservation details', 'Your reservation at Noir is confirmed for {{reservation_time}}. We look forward to seeing you!', 'member', 'specific_time', '10:00', 'reservation', true
WHERE NOT EXISTS (SELECT 1 FROM campaign_templates WHERE campaign_id = 'reservation-followup' AND name = 'Reservation Confirmation');

INSERT INTO campaign_templates (campaign_id, name, description, content, recipient_type, timing_type, duration_quantity, duration_unit, duration_proximity, trigger_type, is_active) 
SELECT 'reservation-followup', 'Post-Visit Follow-up', 'Follow-up after visit', 'Thank you for visiting Noir, {{first_name}}! We hope you had a great experience.', 'member', 'duration', 2, 'hr', 'after', 'reservation', true
WHERE NOT EXISTS (SELECT 1 FROM campaign_templates WHERE campaign_id = 'reservation-followup' AND name = 'Post-Visit Follow-up');

INSERT INTO campaign_templates (campaign_id, name, description, content, recipient_type, timing_type, specific_time, trigger_type, is_active) 
SELECT 'birthday-campaign', 'Birthday Wish', 'Birthday message', 'Happy Birthday, {{first_name}}! We hope you have a wonderful day celebrating at Noir.', 'member', 'specific_time', '09:00', 'birthday', true
WHERE NOT EXISTS (SELECT 1 FROM campaign_templates WHERE campaign_id = 'birthday-campaign' AND name = 'Birthday Wish');

-- Enable RLS
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_campaign_messages ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON campaigns TO authenticated;
GRANT ALL ON campaign_templates TO authenticated;
GRANT ALL ON scheduled_campaign_messages TO authenticated;

-- Create RLS policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON campaigns;
CREATE POLICY "Enable read access for authenticated users" ON campaigns
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON campaigns;
CREATE POLICY "Enable insert access for authenticated users" ON campaigns
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable update access for authenticated users" ON campaigns;
CREATE POLICY "Enable update access for authenticated users" ON campaigns
    FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON campaigns;
CREATE POLICY "Enable delete access for authenticated users" ON campaigns
    FOR DELETE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON campaign_templates;
CREATE POLICY "Enable read access for authenticated users" ON campaign_templates
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON campaign_templates;
CREATE POLICY "Enable insert access for authenticated users" ON campaign_templates
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable update access for authenticated users" ON campaign_templates;
CREATE POLICY "Enable update access for authenticated users" ON campaign_templates
    FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON campaign_templates;
CREATE POLICY "Enable delete access for authenticated users" ON campaign_templates
    FOR DELETE USING (auth.role() = 'authenticated');

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

-- Migration complete
SELECT 'Campaign hierarchy migration completed successfully' as status; 