-- Campaign Hierarchy Migration
-- This migration creates a hierarchical campaign system with campaigns and templates

-- Backup existing tables if they exist
CREATE TABLE IF NOT EXISTS backup_campaign_templates AS 
SELECT * FROM campaign_templates WHERE 1=0;

CREATE TABLE IF NOT EXISTS backup_onboarding_templates AS 
SELECT * FROM onboarding_templates WHERE 1=0;

-- Create campaigns table (top level)
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL DEFAULT 'onboarding' CHECK (trigger_type IN ('onboarding', 'reservation', 'birthday', 'custom')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create campaign_templates table (templates within campaigns)
CREATE TABLE IF NOT EXISTS campaign_templates (
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

-- Create scheduled_campaign_messages table
CREATE TABLE IF NOT EXISTS scheduled_campaign_messages (
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

-- Add indexes for better performance
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

-- Create triggers for updated_at
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

-- Insert sample campaigns
INSERT INTO campaigns (campaign_id, name, description, trigger_type, is_active) VALUES
('welcome-series', 'Welcome Series', 'Automated welcome messages for new members', 'onboarding', true),
('reservation-followup', 'Reservation Follow-up', 'Follow-up messages after reservations', 'reservation', true),
('birthday-campaign', 'Birthday Wishes', 'Birthday messages for members', 'birthday', true),
('custom-campaign', 'Custom Campaign', 'Custom campaign for special events', 'custom', true);

-- Insert sample campaign templates
INSERT INTO campaign_templates (campaign_id, name, description, content, recipient_type, timing_type, specific_time, trigger_type, is_active) VALUES
('welcome-series', 'Welcome Message', 'Initial welcome message', 'Welcome to Noir, {{first_name}}! We''re excited to have you as a member. {{member_name}}', 'member', 'specific_time', '10:00', 'onboarding', true),
('welcome-series', 'Follow-up Message', 'Follow-up after 24 hours', 'Hi {{first_name}}! How are you enjoying your Noir membership so far?', 'member', 'duration', '24', 'hr', 'after', 'onboarding', true),
('reservation-followup', 'Reservation Confirmation', 'Confirm reservation details', 'Your reservation at Noir is confirmed for {{reservation_time}}. We look forward to seeing you!', 'member', 'specific_time', '10:00', 'reservation', true),
('reservation-followup', 'Post-Visit Follow-up', 'Follow-up after visit', 'Thank you for visiting Noir, {{first_name}}! We hope you had a great experience.', 'member', 'duration', '2', 'hr', 'after', 'reservation', true),
('birthday-campaign', 'Birthday Wish', 'Birthday message', 'Happy Birthday, {{first_name}}! We hope you have a wonderful day celebrating at Noir.', 'member', 'specific_time', '09:00', 'birthday', true);

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

-- Create API endpoints for campaigns
-- Note: You'll need to create these API files in your Next.js app

-- Migration complete
SELECT 'Campaign hierarchy migration completed successfully' as status; 