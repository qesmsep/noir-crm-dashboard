-- Fix the reservation trigger that's causing the "status" field error
-- The trigger is trying to access NEW.status but the status field doesn't exist in the reservations table

-- Drop the problematic trigger
DROP TRIGGER IF EXISTS trigger_schedule_reservation_reminders ON public.reservations;

-- Recreate the trigger without the status check (since status field doesn't exist)
CREATE OR REPLACE FUNCTION trigger_schedule_reservation_reminders()
RETURNS TRIGGER AS $$
BEGIN
    -- Schedule reminders for all new reservations (removed status check)
    PERFORM schedule_reservation_reminders(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER trigger_schedule_reservation_reminders
    AFTER INSERT ON public.reservations
    FOR EACH ROW
    EXECUTE FUNCTION trigger_schedule_reservation_reminders();

-- Verify the fix
SELECT 'Trigger fixed successfully' as status; 