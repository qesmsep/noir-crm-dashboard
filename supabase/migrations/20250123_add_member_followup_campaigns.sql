-- Migration to add member followup campaign functionality
-- This allows automated SMS campaigns to be sent to new members after activation

-- Add new enum for campaign status
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'campaign_status') THEN
        CREATE TYPE campaign_status AS ENUM ('draft', 'active', 'paused', 'completed');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_status') THEN
        CREATE TYPE message_status AS ENUM ('pending', 'sent', 'failed', 'cancelled');
    END IF;
END $$;

-- Create campaign_templates table
CREATE TABLE IF NOT EXISTS public.campaign_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    message_template TEXT NOT NULL,
    default_delay_days INTEGER NOT NULL DEFAULT 1,
    default_send_time TIME NOT NULL DEFAULT '10:00:00',
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create member_campaigns table to track campaigns for each member
CREATE TABLE IF NOT EXISTS public.member_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id UUID NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES campaign_templates(id) ON DELETE CASCADE,
    campaign_status campaign_status DEFAULT 'active',
    activation_date TIMESTAMPTZ NOT NULL,
    scheduled_messages JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(member_id, template_id)
);

-- Create scheduled_messages table to track individual messages
CREATE TABLE IF NOT EXISTS public.scheduled_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id UUID NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES member_campaigns(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES campaign_templates(id) ON DELETE CASCADE,
    message_content TEXT NOT NULL,
    scheduled_for TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    status message_status DEFAULT 'pending',
    openphone_message_id TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaign_templates_active ON campaign_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_member_campaigns_member_id ON member_campaigns(member_id);
CREATE INDEX IF NOT EXISTS idx_member_campaigns_status ON member_campaigns(campaign_status);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_scheduled_for ON scheduled_messages(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status ON scheduled_messages(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_member_id ON scheduled_messages(member_id);

-- Enable RLS
ALTER TABLE public.campaign_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY "Admins can manage campaign templates"
ON public.campaign_templates
FOR ALL
USING (true);

CREATE POLICY "Admins can manage member campaigns"
ON public.member_campaigns
FOR ALL
USING (true);

CREATE POLICY "Admins can manage scheduled messages"
ON public.scheduled_messages
FOR ALL
USING (true);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_campaign_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_member_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_scheduled_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_campaign_templates_updated_at
    BEFORE UPDATE ON public.campaign_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_campaign_templates_updated_at();

CREATE TRIGGER trigger_update_member_campaigns_updated_at
    BEFORE UPDATE ON public.member_campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_member_campaigns_updated_at();

CREATE TRIGGER trigger_update_scheduled_messages_updated_at
    BEFORE UPDATE ON public.scheduled_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_scheduled_messages_updated_at();

-- Insert default campaign templates
INSERT INTO public.campaign_templates (name, description, message_template, default_delay_days, default_send_time) VALUES
(
    'Welcome Followup - Day 1',
    'First followup message sent 1 day after member activation',
    'Hi {{first_name}}! Welcome to Noir! We''re excited to have you as a member. How was your first experience? We''d love to hear your feedback and see you again soon.',
    1,
    '10:00:00'
),
(
    'Member Engagement - Day 3',
    'Engagement message sent 3 days after member activation',
    'Hi {{first_name}}! Just checking in to see how you''re enjoying your Noir membership. Don''t forget to make your first reservation - we have some great availability this week!',
    3,
    '14:00:00'
),
(
    'First Visit Reminder - Day 7',
    'Reminder to make first visit sent 7 days after member activation',
    'Hi {{first_name}}! It''s been a week since you joined Noir. We''d love to see you for your first visit! What''s your preferred day and time? We can help you get that reservation set up.',
    7,
    '11:00:00'
);

-- Create function to generate scheduled messages for a campaign
CREATE OR REPLACE FUNCTION generate_campaign_messages(
    p_member_id UUID,
    p_template_id UUID,
    p_activation_date TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    template_record RECORD;
    scheduled_messages JSONB := '[]';
    message_date TIMESTAMPTZ;
    message_content TEXT;
BEGIN
    -- Get template details
    SELECT * INTO template_record 
    FROM campaign_templates 
    WHERE id = p_template_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Template not found';
    END IF;
    
    -- Calculate scheduled date
    message_date := p_activation_date + (template_record.default_delay_days || ' days')::INTERVAL;
    message_date := date_trunc('day', message_date) + template_record.default_send_time;
    
    -- Create message content with member name placeholder
    message_content := template_record.message_template;
    
    -- Return scheduled message data
    scheduled_messages := jsonb_build_object(
        'scheduled_for', message_date,
        'message_content', message_content,
        'template_id', p_template_id
    );
    
    RETURN scheduled_messages;
END;
$$;

-- Create function to process pending scheduled messages
CREATE OR REPLACE FUNCTION process_scheduled_messages()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    message_record RECORD;
    processed_count INTEGER := 0;
BEGIN
    -- Get all pending messages that are due to be sent
    FOR message_record IN 
        SELECT sm.*, m.first_name, m.phone
        FROM scheduled_messages sm
        JOIN members m ON sm.member_id = m.member_id
        WHERE sm.status = 'pending' 
        AND sm.scheduled_for <= NOW()
        ORDER BY sm.scheduled_for
    LOOP
        -- Mark as sent (actual SMS sending will be handled by external process)
        UPDATE scheduled_messages 
        SET status = 'sent', sent_at = NOW()
        WHERE id = message_record.id;
        
        processed_count := processed_count + 1;
    END LOOP;
    
    RETURN processed_count;
END;
$$; 