-- Create venue_hours table
CREATE TABLE venue_hours (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('base', 'exceptional_open', 'exceptional_closure')),
    day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
    date DATE,
    time_ranges JSONB,
    label TEXT,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for better query performance
CREATE INDEX idx_venue_hours_type ON venue_hours(type);
CREATE INDEX idx_venue_hours_date ON venue_hours(date);
CREATE INDEX idx_venue_hours_day_of_week ON venue_hours(day_of_week);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_venue_hours_updated_at
    BEFORE UPDATE ON venue_hours
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 