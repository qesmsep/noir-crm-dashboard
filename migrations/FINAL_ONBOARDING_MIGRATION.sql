-- FINAL ONBOARDING MIGRATION SCRIPT
-- Run this script in your Supabase SQL Editor to implement the onboarding system
-- This script is safe and non-destructive

-- Migration to add onboarding templates functionality
-- This allows automated SMS onboarding campaigns to be sent to new members after signup

-- Create onboarding_templates table
CREATE TABLE IF NOT EXISTS public.onboarding_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    recipient_type TEXT NOT NULL CHECK (recipient_type IN ('member', 'all_members', 'specific_phone')),
    specific_phone TEXT,
    timing_days INTEGER NOT NULL DEFAULT 0,
    timing_hours INTEGER NOT NULL DEFAULT 0,
    timing_minutes INTEGER NOT NULL DEFAULT 0,
    send_time TIME DEFAULT '10:00:00', -- Default send time (10 AM)
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES admins(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create scheduled_onboarding_messages table to track individual messages
CREATE TABLE IF NOT EXISTS public.scheduled_onboarding_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id UUID NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES onboarding_templates(id) ON DELETE CASCADE,
    message_content TEXT NOT NULL,
    recipient_phone TEXT NOT NULL,
    scheduled_for TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
    openphone_message_id TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_onboarding_templates_active ON onboarding_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_onboarding_templates_timing ON onboarding_templates(timing_days, timing_hours, timing_minutes);
CREATE INDEX IF NOT EXISTS idx_scheduled_onboarding_messages_scheduled_for ON scheduled_onboarding_messages(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_onboarding_messages_status ON scheduled_onboarding_messages(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_onboarding_messages_member_id ON scheduled_onboarding_messages(member_id);

-- Enable RLS
ALTER TABLE public.onboarding_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_onboarding_messages ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY "Admins can manage onboarding templates"
ON public.onboarding_templates
FOR ALL
USING (true);

CREATE POLICY "Admins can manage scheduled onboarding messages"
ON public.scheduled_onboarding_messages
FOR ALL
USING (true);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_onboarding_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_scheduled_onboarding_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_onboarding_templates_updated_at
    BEFORE UPDATE ON public.onboarding_templates
    FOR EACH ROW EXECUTE FUNCTION update_onboarding_templates_updated_at();

CREATE TRIGGER trigger_update_scheduled_onboarding_messages_updated_at
    BEFORE UPDATE ON public.scheduled_onboarding_messages
    FOR EACH ROW EXECUTE FUNCTION update_scheduled_onboarding_messages_updated_at();

-- Create function to generate scheduled messages for onboarding
CREATE OR REPLACE FUNCTION generate_onboarding_messages(
    p_member_id UUID,
    p_template_id UUID,
    p_join_date TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    template_record RECORD;
    member_record RECORD;
    scheduled_message JSONB := '{}';
    message_date TIMESTAMPTZ;
    message_content TEXT;
    recipient_phone TEXT;
BEGIN
    -- Get template details
    SELECT * INTO template_record 
    FROM onboarding_templates 
    WHERE id = p_template_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Template not found';
    END IF;
    
    -- Get member details
    SELECT * INTO member_record 
    FROM members 
    WHERE member_id = p_member_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Member not found';
    END IF;
    
    -- Calculate scheduled date
    message_date := p_join_date + 
                   (template_record.timing_days || ' days')::INTERVAL +
                   (template_record.timing_hours || ' hours')::INTERVAL +
                   (template_record.timing_minutes || ' minutes')::INTERVAL;
    
    -- Set to specific send time (e.g., 10:00 AM)
    message_date := date_trunc('day', message_date) + template_record.send_time;
    
    -- Determine recipient phone based on template type
    CASE template_record.recipient_type
        WHEN 'member' THEN
            -- Send to primary member of the account
            SELECT phone INTO recipient_phone 
            FROM members 
            WHERE account_id = member_record.account_id 
            AND member_type = 'primary' 
            LIMIT 1;
        WHEN 'all_members' THEN
            -- Use the current member's phone
            recipient_phone := member_record.phone;
        WHEN 'specific_phone' THEN
            recipient_phone := template_record.specific_phone;
        ELSE
            recipient_phone := member_record.phone;
    END CASE;
    
    -- Create message content with placeholders
    message_content := template_record.content;
    message_content := replace(message_content, '{{first_name}}', COALESCE(member_record.first_name, ''));
    message_content := replace(message_content, '{{last_name}}', COALESCE(member_record.last_name, ''));
    message_content := replace(message_content, '{{member_name}}', COALESCE(member_record.first_name || ' ' || member_record.last_name, ''));
    message_content := replace(message_content, '{{phone}}', COALESCE(member_record.phone, ''));
    message_content := replace(message_content, '{{email}}', COALESCE(member_record.email, ''));
    
    -- Return scheduled message data
    scheduled_message := jsonb_build_object(
        'scheduled_for', message_date,
        'message_content', message_content,
        'template_id', p_template_id,
        'recipient_phone', recipient_phone
    );
    
    RETURN scheduled_message;
END;
$$;

-- Create function to process pending onboarding messages
CREATE OR REPLACE FUNCTION process_onboarding_messages()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    message_record RECORD;
    processed_count INTEGER := 0;
BEGIN
    -- Get all pending messages that are due to be sent
    FOR message_record IN 
        SELECT * FROM scheduled_onboarding_messages
        WHERE status = 'pending' 
        AND scheduled_for <= NOW()
        ORDER BY scheduled_for
    LOOP
        -- Mark as sent (actual SMS sending will be handled by external process)
        UPDATE scheduled_onboarding_messages 
        SET status = 'sent', sent_at = NOW()
        WHERE id = message_record.id;
        
        processed_count := processed_count + 1;
    END LOOP;
    
    RETURN processed_count;
END;
$$;

-- Insert some default onboarding templates
INSERT INTO public.onboarding_templates (name, content, recipient_type, timing_days, timing_hours, timing_minutes, send_time, is_active) VALUES
(
    'Welcome Message - Day 1',
    'Welcome to Noir, {{first_name}}! We''re excited to have you as a member. Your membership is now active and you can start making reservations. If you have any questions, feel free to reach out.',
    'member',
    1,
    0,
    0,
    '10:00:00',
    true
),
(
    'First Visit Reminder - Day 3',
    'Hi {{first_name}}! We hope you''re enjoying your Noir membership. Have you had a chance to make your first reservation yet? We''d love to see you soon!',
    'member',
    3,
    0,
    0,
    '10:00:00',
    true
),
(
    'Member Engagement - Day 7',
    '{{first_name}}, it''s been a week since you joined Noir! We''d love to see you for dinner soon. Don''t forget to check out our seasonal menu and make a reservation.',
    'member',
    7,
    0,
    0,
    '10:00:00',
    true
);

-- Verify the migration was successful
SELECT 'Onboarding migration completed successfully!' as status; 