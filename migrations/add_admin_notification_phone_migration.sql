-- Migration to add admin notification phone number to settings table
-- This allows admins to receive SMS notifications when reservations are created or modified

-- Add admin notification phone number column to settings table
ALTER TABLE public.settings 
ADD COLUMN IF NOT EXISTS admin_notification_phone TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN public.settings.admin_notification_phone IS 'Phone number for admin SMS notifications (will be prefixed with +1)';

-- Create function to send admin notification SMS
CREATE OR REPLACE FUNCTION send_admin_reservation_notification(
    p_reservation_id UUID,
    p_action TEXT -- 'created' or 'modified'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    settings_record RECORD;
BEGIN
    -- Get admin notification phone from settings
    SELECT admin_notification_phone INTO settings_record
    FROM settings 
    LIMIT 1;
    
    IF NOT FOUND OR settings_record.admin_notification_phone IS NULL OR settings_record.admin_notification_phone = '' THEN
        -- No admin phone configured, skip notification
        RETURN FALSE;
    END IF;
    
    -- Note: The actual SMS sending will be handled by the application layer
    -- This function just checks if admin notifications are configured
    -- The application will call the admin-notifications API endpoint
    
    RETURN TRUE;
END;
$$;

-- Create trigger function for new reservations
CREATE OR REPLACE FUNCTION trigger_admin_notification_new_reservation()
RETURNS TRIGGER AS $$
BEGIN
    -- Send admin notification for new reservation
    PERFORM send_admin_reservation_notification(NEW.id, 'created');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function for reservation updates
CREATE OR REPLACE FUNCTION trigger_admin_notification_update_reservation()
RETURNS TRIGGER AS $$
BEGIN
    -- Only send notification if important fields changed
    IF (NEW.first_name IS DISTINCT FROM OLD.first_name OR
        NEW.last_name IS DISTINCT FROM OLD.last_name OR
        NEW.start_time IS DISTINCT FROM OLD.start_time OR
        NEW.party_size IS DISTINCT FROM OLD.party_size OR
        NEW.table_id IS DISTINCT FROM OLD.table_id OR
        NEW.event_type IS DISTINCT FROM OLD.event_type) THEN
        
        -- Send admin notification for modified reservation
        PERFORM send_admin_reservation_notification(NEW.id, 'modified');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS trg_admin_notification_new_reservation ON reservations;
CREATE TRIGGER trg_admin_notification_new_reservation
    AFTER INSERT ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION trigger_admin_notification_new_reservation();

DROP TRIGGER IF EXISTS trg_admin_notification_update_reservation ON reservations;
CREATE TRIGGER trg_admin_notification_update_reservation
    AFTER UPDATE ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION trigger_admin_notification_update_reservation();

-- Verify the migration
SELECT 'Migration completed successfully' as status; 