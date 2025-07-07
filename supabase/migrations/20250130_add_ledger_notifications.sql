-- Migration to add ledger notification functionality
-- This allows automated SMS with PDF ledger to be sent to members before renewal

-- Create ledger_notification_settings table
CREATE TABLE IF NOT EXISTS public.ledger_notification_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    is_enabled BOOLEAN DEFAULT true,
    send_time TIME NOT NULL DEFAULT '10:00:00',
    days_before_renewal INTEGER NOT NULL DEFAULT 1,
    message_template TEXT NOT NULL DEFAULT 'Hi {{first_name}}, your monthly ledger is attached. Your renewal date is {{renewal_date}}. Thank you for being a Noir member!',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create scheduled_ledger_notifications table
CREATE TABLE IF NOT EXISTS public.scheduled_ledger_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id UUID NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
    account_id UUID NOT NULL,
    renewal_date DATE NOT NULL,
    ledger_start_date DATE NOT NULL,
    ledger_end_date DATE NOT NULL,
    scheduled_for TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    pdf_url TEXT,
    sms_message_id TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add ledger_notifications_enabled column to members table
ALTER TABLE members ADD COLUMN IF NOT EXISTS ledger_notifications_enabled BOOLEAN DEFAULT true;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_ledger_notification_settings_enabled ON ledger_notification_settings(is_enabled);
CREATE INDEX IF NOT EXISTS idx_scheduled_ledger_notifications_member_id ON scheduled_ledger_notifications(member_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_ledger_notifications_scheduled_for ON scheduled_ledger_notifications(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_ledger_notifications_status ON scheduled_ledger_notifications(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_ledger_notifications_renewal_date ON scheduled_ledger_notifications(renewal_date);

-- Enable RLS
ALTER TABLE public.ledger_notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_ledger_notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY "Admins can manage ledger notification settings"
ON public.ledger_notification_settings
FOR ALL
USING (true);

CREATE POLICY "Admins can manage scheduled ledger notifications"
ON public.scheduled_ledger_notifications
FOR ALL
USING (true);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_ledger_notification_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_scheduled_ledger_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ledger_notification_settings_updated_at
    BEFORE UPDATE ON public.ledger_notification_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_ledger_notification_settings_updated_at();

CREATE TRIGGER trigger_update_scheduled_ledger_notifications_updated_at
    BEFORE UPDATE ON public.scheduled_ledger_notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_scheduled_ledger_notifications_updated_at();

-- Insert default settings
INSERT INTO public.ledger_notification_settings (is_enabled, send_time, days_before_renewal, message_template) VALUES
(
    true,
    '10:00:00',
    1,
    'Hi {{first_name}}, your monthly ledger is attached. Your renewal date is {{renewal_date}}. Thank you for being a Noir member!'
)
ON CONFLICT DO NOTHING;

-- Create function to calculate next renewal date
CREATE OR REPLACE FUNCTION calculate_next_renewal_date(join_date DATE)
RETURNS DATE AS $$
DECLARE
    next_renewal DATE;
    current_date DATE := CURRENT_DATE;
BEGIN
    -- Start with the join date
    next_renewal := join_date;
    
    -- Keep adding months until we get a date in the future
    WHILE next_renewal <= current_date LOOP
        next_renewal := next_renewal + INTERVAL '1 month';
    END LOOP;
    
    RETURN next_renewal;
END;
$$ LANGUAGE plpgsql;

-- Create function to schedule ledger notifications
CREATE OR REPLACE FUNCTION schedule_ledger_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    member_record RECORD;
    settings_record RECORD;
    next_renewal DATE;
    notification_date DATE;
    scheduled_time TIMESTAMPTZ;
    ledger_start_date DATE;
    ledger_end_date DATE;
    scheduled_count INTEGER := 0;
    business_timezone TEXT := 'America/Chicago';
BEGIN
    -- Get business timezone from settings
    SELECT timezone INTO business_timezone FROM settings LIMIT 1;
    IF business_timezone IS NULL THEN
        business_timezone := 'America/Chicago';
    END IF;
    
    -- Get notification settings
    SELECT * INTO settings_record FROM ledger_notification_settings WHERE is_enabled = true LIMIT 1;
    IF NOT FOUND THEN
        RETURN 0;
    END IF;
    
    -- Process each active member
    FOR member_record IN 
        SELECT m.*, a.account_id 
        FROM members m 
        JOIN (
            SELECT DISTINCT account_id 
            FROM members 
            WHERE deactivated = false 
            AND ledger_notifications_enabled = true
        ) a ON m.account_id = a.account_id
        WHERE m.deactivated = false 
        AND m.ledger_notifications_enabled = true
        AND m.join_date IS NOT NULL
    LOOP
        -- Calculate next renewal date
        next_renewal := calculate_next_renewal_date(member_record.join_date);
        
        -- Calculate notification date (days before renewal)
        notification_date := next_renewal - INTERVAL '1 day' * settings_record.days_before_renewal;
        
        -- Calculate ledger period (from last renewal to day before next renewal)
        ledger_start_date := next_renewal - INTERVAL '1 month';
        ledger_end_date := next_renewal - INTERVAL '1 day';
        
        -- Calculate scheduled time in business timezone
        scheduled_time := (notification_date || ' ' || settings_record.send_time)::TIMESTAMPTZ;
        scheduled_time := scheduled_time AT TIME ZONE business_timezone AT TIME ZONE 'UTC';
        
        -- Check if notification is in the future and not already scheduled
        IF scheduled_time > NOW() AND NOT EXISTS (
            SELECT 1 FROM scheduled_ledger_notifications 
            WHERE member_id = member_record.member_id 
            AND renewal_date = next_renewal
        ) THEN
            -- Insert scheduled notification
            INSERT INTO scheduled_ledger_notifications (
                member_id,
                account_id,
                renewal_date,
                ledger_start_date,
                ledger_end_date,
                scheduled_for
            ) VALUES (
                member_record.member_id,
                member_record.account_id,
                next_renewal,
                ledger_start_date,
                ledger_end_date,
                scheduled_time
            );
            
            scheduled_count := scheduled_count + 1;
        END IF;
    END LOOP;
    
    RETURN scheduled_count;
END;
$$;

-- Create function to process pending ledger notifications
CREATE OR REPLACE FUNCTION process_ledger_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    notification_record RECORD;
    processed_count INTEGER := 0;
BEGIN
    -- Get all pending notifications that are due to be sent
    FOR notification_record IN 
        SELECT * FROM scheduled_ledger_notifications
        WHERE status = 'pending' 
        AND scheduled_for <= NOW()
        ORDER BY scheduled_for
    LOOP
        -- Mark as sent (actual processing will be handled by external process)
        UPDATE scheduled_ledger_notifications 
        SET status = 'sent', sent_at = NOW()
        WHERE id = notification_record.id;
        
        processed_count := processed_count + 1;
    END LOOP;
    
    RETURN processed_count;
END;
$$; 