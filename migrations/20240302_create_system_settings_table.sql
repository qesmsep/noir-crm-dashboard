-- Create system_settings table for storing configuration
-- This table can be used for any system-wide settings like inventory categories

CREATE TABLE IF NOT EXISTS system_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    key VARCHAR(255) NOT NULL UNIQUE,
    value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for fast key lookups
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);

-- Add RLS policies
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read settings
CREATE POLICY "Enable read access for authenticated users" ON system_settings
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to update settings
CREATE POLICY "Enable update for authenticated users" ON system_settings
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert settings
CREATE POLICY "Enable insert for authenticated users" ON system_settings
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Insert default inventory categories settings
INSERT INTO system_settings (key, value, description)
VALUES (
    'inventory_categories',
    '{
        "inventoryCategories": ["spirits", "wine", "beer", "mixers", "garnishes", "supplies", "other"],
        "inventorySubcategories": {
            "spirits": ["Vodka", "Gin", "Rum", "Tequila", "Whiskey", "Bourbon", "Scotch", "Brandy", "Cognac", "Mezcal", "Liqueur", "Other"],
            "wine": ["Red", "White", "Rosé", "Sparkling", "Champagne", "Other"],
            "beer": ["Lager", "IPA", "Stout", "Pilsner", "Wheat", "Sour", "Craft", "Import", "Other"],
            "mixers": ["Juice", "Soda", "Tonic", "Syrup", "Bitters", "Cream", "Other"],
            "garnishes": ["Citrus", "Olives", "Cherries", "Herbs", "Other"],
            "supplies": ["Glassware", "Ice", "Straws", "Napkins", "Other"],
            "other": ["Other"]
        },
        "recipeCategories": ["Classic Cocktails", "Signature Cocktails", "Mocktails", "Shots", "Wine", "Beer", "Other"]
    }'::jsonb,
    'Inventory system category configuration'
)
ON CONFLICT (key) DO NOTHING;