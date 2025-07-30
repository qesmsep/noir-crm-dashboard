-- Backup existing onboarding_templates table
CREATE TABLE IF NOT EXISTS backup_onboarding_templates AS 
SELECT * FROM onboarding_templates;

-- Create new campaign_templates table
CREATE TABLE IF NOT EXISTS campaign_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id TEXT NOT NULL,
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

-- Create index on campaign_id for efficient lookups
CREATE INDEX IF NOT EXISTS idx_campaign_templates_campaign_id ON campaign_templates(campaign_id);

-- Create index on trigger_type for filtering
CREATE INDEX IF NOT EXISTS idx_campaign_templates_trigger_type ON campaign_templates(trigger_type);

-- Create index on is_active for filtering
CREATE INDEX IF NOT EXISTS idx_campaign_templates_is_active ON campaign_templates(is_active);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_campaign_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_update_campaign_templates_updated_at
    BEFORE UPDATE ON campaign_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_campaign_templates_updated_at();

-- Insert sample campaign templates (migrating from onboarding_templates if they exist)
INSERT INTO campaign_templates (
    campaign_id,
    name,
    description,
    content,
    recipient_type,
    specific_phone,
    timing_type,
    specific_time,
    duration_quantity,
    duration_unit,
    duration_proximity,
    trigger_type,
    is_active
) VALUES 
-- Welcome campaign
(
    'onboarding-welcome',
    'Welcome Message',
    'Welcome message sent immediately after signup',
    'Welcome to Noir, {{first_name}}! We''re excited to have you as a member. If you have any questions, don''t hesitate to reach out.',
    'member',
    NULL,
    'specific_time',
    '10:00',
    NULL,
    NULL,
    NULL,
    'onboarding',
    true
),
-- Follow-up campaign
(
    'onboarding-followup',
    'Follow-up Message',
    'Follow-up message sent 1 day after signup',
    'Hi {{first_name}}! We hope you''re settling in well. Here''s a reminder that you can book reservations through our app. Let us know if you need anything!',
    'member',
    NULL,
    'duration',
    NULL,
    1,
    'day',
    'after',
    'onboarding',
    true
),
-- Reservation reminder campaign
(
    'reservation-reminder',
    'Reservation Reminder',
    'Reminder sent 2 hours before reservation',
    'Hi {{first_name}}! Just a friendly reminder that you have a reservation at Noir in 2 hours. We look forward to seeing you!',
    'member',
    NULL,
    'duration',
    NULL,
    2,
    'hr',
    'before',
    'reservation',
    true
),
-- Birthday campaign
(
    'birthday-wish',
    'Birthday Wish',
    'Birthday message sent on member birthday',
    'Happy Birthday, {{first_name}}! 🎉 We hope you have a wonderful day. Come celebrate with us at Noir!',
    'member',
    NULL,
    'specific_time',
    '09:00',
    NULL,
    NULL,
    NULL,
    'birthday',
    true
);

-- Create scheduled_campaign_messages table for tracking sent messages
CREATE TABLE IF NOT EXISTS scheduled_campaign_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_template_id UUID REFERENCES campaign_templates(id) ON DELETE CASCADE,
    member_id UUID REFERENCES members(member_id) ON DELETE CASCADE,
    recipient_phone TEXT NOT NULL,
    message_content TEXT NOT NULL,
    scheduled_send_time TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for scheduled_campaign_messages
CREATE INDEX IF NOT EXISTS idx_scheduled_campaign_messages_template_id ON scheduled_campaign_messages(campaign_template_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_campaign_messages_member_id ON scheduled_campaign_messages(member_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_campaign_messages_status ON scheduled_campaign_messages(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_campaign_messages_scheduled_send_time ON scheduled_campaign_messages(scheduled_send_time);

-- Create updated_at trigger for scheduled_campaign_messages
CREATE TRIGGER trigger_update_scheduled_campaign_messages_updated_at
    BEFORE UPDATE ON scheduled_campaign_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_campaign_templates_updated_at();

-- Enable RLS
ALTER TABLE campaign_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_campaign_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for campaign_templates
CREATE POLICY "Allow all operations for authenticated users" ON campaign_templates
    FOR ALL USING (auth.role() = 'authenticated');

-- RLS Policies for scheduled_campaign_messages
CREATE POLICY "Allow all operations for authenticated users" ON scheduled_campaign_messages
    FOR ALL USING (auth.role() = 'authenticated');

-- Grant permissions
GRANT ALL ON campaign_templates TO authenticated;
GRANT ALL ON scheduled_campaign_messages TO authenticated; 