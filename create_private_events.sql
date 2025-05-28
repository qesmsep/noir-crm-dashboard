-- Create private_events table
CREATE TABLE private_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for better query performance
CREATE INDEX idx_private_events_start_time ON private_events(start_time);
CREATE INDEX idx_private_events_end_time ON private_events(end_time);
CREATE INDEX idx_private_events_status ON private_events(status);

-- Add trigger to update updated_at timestamp
CREATE TRIGGER update_private_events_updated_at
    BEFORE UPDATE ON private_events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 