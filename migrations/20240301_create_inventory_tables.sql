-- Create inventory tables for Noir CRM Dashboard
-- Author: System
-- Date: 2024-03-01

-- Create inventory_items table
CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('spirits', 'wine', 'beer', 'mixers', 'garnishes', 'supplies', 'other')),
    subcategory VARCHAR(100) DEFAULT '',
    brand VARCHAR(255) DEFAULT '',
    quantity DECIMAL(10, 2) DEFAULT 0,
    unit VARCHAR(20) DEFAULT 'bottle' CHECK (unit IN ('bottle', 'can', 'keg', 'case', 'each', 'liter', 'oz')),
    volume_ml INTEGER DEFAULT 750,
    cost_per_unit DECIMAL(10, 2) DEFAULT 0,
    price_per_serving DECIMAL(10, 2) DEFAULT 0,
    par_level DECIMAL(10, 2) DEFAULT 0,
    notes TEXT DEFAULT '',
    image_url TEXT DEFAULT '',
    last_counted TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create inventory_transactions table for tracking changes
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('add', 'remove', 'adjust', 'count', 'waste')),
    quantity DECIMAL(10, 2) NOT NULL,
    quantity_before DECIMAL(10, 2),
    quantity_after DECIMAL(10, 2),
    notes TEXT DEFAULT '',
    created_by VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create inventory_recipes table for cocktail recipes
CREATE TABLE IF NOT EXISTS inventory_recipes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    instructions TEXT,
    price DECIMAL(10, 2),
    image_url TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create inventory_recipe_ingredients junction table
CREATE TABLE IF NOT EXISTS inventory_recipe_ingredients (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    recipe_id UUID NOT NULL REFERENCES inventory_recipes(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    quantity DECIMAL(10, 2) NOT NULL,
    unit VARCHAR(20) DEFAULT 'oz',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_inventory_items_name ON inventory_items(name);
CREATE INDEX IF NOT EXISTS idx_inventory_items_low_stock ON inventory_items(quantity, par_level);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item_id ON inventory_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_created_at ON inventory_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_recipes_active ON inventory_recipes(is_active);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON inventory_recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_item ON inventory_recipe_ingredients(item_id);

-- Add RLS policies for inventory_items
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all authenticated users" ON inventory_items
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON inventory_items
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON inventory_items
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON inventory_items
    FOR DELETE USING (auth.role() = 'authenticated');

-- Add RLS policies for inventory_transactions
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all authenticated users" ON inventory_transactions
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON inventory_transactions
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Add RLS policies for inventory_recipes
ALTER TABLE inventory_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all authenticated users" ON inventory_recipes
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON inventory_recipes
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON inventory_recipes
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON inventory_recipes
    FOR DELETE USING (auth.role() = 'authenticated');

-- Add RLS policies for inventory_recipe_ingredients
ALTER TABLE inventory_recipe_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all authenticated users" ON inventory_recipe_ingredients
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON inventory_recipe_ingredients
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON inventory_recipe_ingredients
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON inventory_recipe_ingredients
    FOR DELETE USING (auth.role() = 'authenticated');

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON inventory_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_recipes_updated_at BEFORE UPDATE ON inventory_recipes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add some example data (optional - comment out in production)
/*
INSERT INTO inventory_items (name, category, subcategory, brand, quantity, unit, volume_ml, cost_per_unit, price_per_serving, par_level)
VALUES
    ('Grey Goose Vodka', 'spirits', 'vodka', 'Grey Goose', 12, 'bottle', 750, 45.00, 12.00, 6),
    ('Hendricks Gin', 'spirits', 'gin', 'Hendricks', 8, 'bottle', 750, 38.00, 11.00, 4),
    ('Patron Silver Tequila', 'spirits', 'tequila', 'Patron', 6, 'bottle', 750, 52.00, 14.00, 3),
    ('Champagne Veuve Clicquot', 'wine', 'sparkling', 'Veuve Clicquot', 24, 'bottle', 750, 65.00, 18.00, 12),
    ('Stella Artois', 'beer', 'lager', 'Stella Artois', 48, 'bottle', 330, 2.50, 6.00, 24);
*/