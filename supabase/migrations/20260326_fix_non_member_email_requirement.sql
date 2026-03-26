-- Fix: Make email optional for non-member reservations
-- Phone is sufficient contact info; email is nice-to-have but not required

CREATE OR REPLACE FUNCTION validate_reservation_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure required fields are present
    IF NEW.start_time IS NULL OR NEW.end_time IS NULL OR NEW.party_size IS NULL THEN
        RAISE EXCEPTION 'Reservation must have start_time, end_time, and party_size';
    END IF;

    -- Ensure party_size is positive
    IF NEW.party_size <= 0 THEN
        RAISE EXCEPTION 'Party size must be greater than 0';
    END IF;

    -- Ensure end_time is after start_time
    IF NEW.end_time <= NEW.start_time THEN
        RAISE EXCEPTION 'End time must be after start time';
    END IF;

    -- For non-members, ensure contact information is provided
    -- Email is optional - phone is sufficient for contact
    IF NEW.membership_type = 'non-member' THEN
        IF NEW.phone IS NULL OR NEW.first_name IS NULL OR NEW.last_name IS NULL THEN
            RAISE EXCEPTION 'Non-member reservations must include phone, first_name, and last_name';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Verify the fix
SELECT 'Email is now optional for non-member reservations. Phone, first_name, and last_name are still required.' as status;
