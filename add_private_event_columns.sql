-- Add private event columns to reservations table
ALTER TABLE reservations
ADD COLUMN is_private_event BOOLEAN DEFAULT FALSE,
ADD COLUMN private_event_id UUID REFERENCES private_events(id);

-- Add index for better query performance
CREATE INDEX idx_reservations_private_event ON reservations(is_private_event, private_event_id); 