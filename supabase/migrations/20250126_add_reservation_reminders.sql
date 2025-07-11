-- Migration to add reservation reminder functionality
-- This extends the existing campaign system to support reservation-specific reminders

-- Add new enum for reminder types
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reminder_type') THEN
        CREATE TYPE reminder_type AS ENUM ('day_of', 'hour_before');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_status') THEN
        CREATE TYPE message_status AS ENUM ('pending', 'sent', 'failed', 'cancelled');
    END IF;
END $$;

-- Create reservation_reminder_templates table
CREATE TABLE IF NOT EXISTS public.reservation_reminder_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    message_template TEXT NOT NULL,
    reminder_type reminder_type NOT NULL,
    send_time TEXT NOT NULL DEFAULT '10:00', -- Time format: "HH:MM" for day_of, "H" or "H:M" for hour_before
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create scheduled_reservation_reminders table
CREATE TABLE IF NOT EXISTS public.scheduled_reservation_reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES reservation_reminder_templates(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_reservation_reminder_templates_active ON reservation_reminder_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_reservation_reminder_templates_type ON reservation_reminder_templates(reminder_type);
CREATE INDEX IF NOT EXISTS idx_scheduled_reservation_reminders_scheduled_for ON scheduled_reservation_reminders(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_reservation_reminders_status ON scheduled_reservation_reminders(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_reservation_reminders_reservation_id ON scheduled_reservation_reminders(reservation_id);

-- Enable RLS
ALTER TABLE public.reservation_reminder_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_reservation_reminders ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY "Admins can manage reservation reminder templates"
ON public.reservation_reminder_templates
FOR ALL
USING (true);

CREATE POLICY "Admins can manage scheduled reservation reminders"
ON public.scheduled_reservation_reminders
FOR ALL
USING (true);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_reservation_reminder_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_scheduled_reservation_reminders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_reservation_reminder_templates_updated_at
    BEFORE UPDATE ON public.reservation_reminder_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_reservation_reminder_templates_updated_at();

CREATE TRIGGER trigger_update_scheduled_reservation_reminders_updated_at
    BEFORE UPDATE ON public.scheduled_reservation_reminders
    FOR EACH ROW
    EXECUTE FUNCTION update_scheduled_reservation_reminders_updated_at();

-- Insert default reservation reminder templates
INSERT INTO public.reservation_reminder_templates (name, description, message_template, reminder_type, send_time) VALUES
(
    'Day of Reminder',
    'Reminder sent on the day of the reservation',
    'Hi {{first_name}}! This is a friendly reminder that you have a reservation at Noir today at {{reservation_time}} for {{party_size}} guests. We look forward to seeing you!',
    'day_of',
    '10:00'
),
(
    '1 Hour Before Reminder',
    'Reminder sent 1 hour before the reservation',
    'Hi {{first_name}}! Your reservation at Noir is in 1 hour at {{reservation_time}} for {{party_size}} guests. See you soon!',
    'hour_before',
    '1:00'
);

-- Create function to schedule reservation reminders
CREATE OR REPLACE FUNCTION schedule_reservation_reminders(p_reservation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    reservation_record RECORD;
    template_record RECORD;
    scheduled_time TIMESTAMPTZ;
    message_content TEXT;
    send_time_parts TEXT[];
    hours_before INTEGER;
    minutes_before INTEGER;
    business_timezone TEXT := 'America/Chicago';
BEGIN
    -- Get reservation details
    SELECT * INTO reservation_record 
    FROM reservations 
    WHERE id = p_reservation_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reservation not found';
    END IF;
    
    -- Get business timezone from settings
    SELECT timezone INTO business_timezone FROM settings LIMIT 1;
    IF business_timezone IS NULL THEN
        business_timezone := 'America/Chicago';
    END IF;
    
    -- Get all active reminder templates
    FOR template_record IN 
        SELECT * FROM reservation_reminder_templates 
        WHERE is_active = true
        ORDER BY reminder_type, send_time
    LOOP
        -- Calculate scheduled time based on reminder type
        IF template_record.reminder_type = 'day_of' THEN
            -- Schedule for the day of the reservation at the specified time
            -- send_time format: "HH:MM" (e.g., "10:05", "14:30")
            send_time_parts := string_to_array(template_record.send_time, ':');
            scheduled_time := date_trunc('day', reservation_record.start_time AT TIME ZONE 'UTC' AT TIME ZONE business_timezone) 
                             + (send_time_parts[1] || ' hours')::INTERVAL 
                             + (send_time_parts[2] || ' minutes')::INTERVAL;
            scheduled_time := scheduled_time AT TIME ZONE business_timezone AT TIME ZONE 'UTC';
        ELSIF template_record.reminder_type = 'hour_before' THEN
            -- Schedule for X hours and Y minutes before the reservation
            -- send_time format: "H:M" or "H" (e.g., "1:30", "2:00", "1")
            send_time_parts := string_to_array(template_record.send_time, ':');
            hours_before := send_time_parts[1]::INTEGER;
            minutes_before := CASE WHEN array_length(send_time_parts, 1) > 1 THEN send_time_parts[2]::INTEGER ELSE 0 END;
            scheduled_time := reservation_record.start_time - (hours_before || ' hours')::INTERVAL - (minutes_before || ' minutes')::INTERVAL;
        END IF;
        
        -- Only schedule if the time hasn't passed
        IF scheduled_time > NOW() THEN
            -- Create message content with placeholders
            message_content := template_record.message_template;
            message_content := replace(message_content, '{{first_name}}', COALESCE(reservation_record.first_name, 'Guest'));
            message_content := replace(message_content, '{{reservation_time}}', 
                to_char(reservation_record.start_time AT TIME ZONE 'UTC' AT TIME ZONE business_timezone, 'HH:MI AM'));
            message_content := replace(message_content, '{{party_size}}', reservation_record.party_size::TEXT);
            
            -- Insert scheduled reminder
            INSERT INTO scheduled_reservation_reminders (
                reservation_id,
                template_id,
                customer_name,
                customer_phone,
                message_content,
                scheduled_for
            ) VALUES (
                p_reservation_id,
                template_record.id,
                COALESCE(reservation_record.first_name || ' ' || reservation_record.last_name, 'Guest'),
                reservation_record.phone,
                message_content,
                scheduled_time
            );
        END IF;
    END LOOP;
END;
$$;

-- Create function to process pending reservation reminders
CREATE OR REPLACE FUNCTION process_reservation_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    reminder_record RECORD;
    processed_count INTEGER := 0;
BEGIN
    -- Get all pending reminders that are due to be sent
    FOR reminder_record IN 
        SELECT * FROM scheduled_reservation_reminders
        WHERE status = 'pending' 
        AND scheduled_for <= NOW()
        ORDER BY scheduled_for
    LOOP
        -- Mark as sent (actual SMS sending will be handled by external process)
        UPDATE scheduled_reservation_reminders 
        SET status = 'sent', sent_at = NOW()
        WHERE id = reminder_record.id;
        
        processed_count := processed_count + 1;
    END LOOP;
    
    RETURN processed_count;
END;
$$;

-- Create trigger to automatically schedule reminders when a reservation is created
CREATE OR REPLACE FUNCTION trigger_schedule_reservation_reminders()
RETURNS TRIGGER AS $$
BEGIN
    -- Only schedule reminders for confirmed reservations
    IF NEW.status = 'confirmed' THEN
        PERFORM schedule_reservation_reminders(NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_schedule_reservation_reminders
    AFTER INSERT ON public.reservations
    FOR EACH ROW
    EXECUTE FUNCTION trigger_schedule_reservation_reminders(); 