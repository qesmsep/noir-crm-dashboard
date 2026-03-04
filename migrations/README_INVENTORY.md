# Inventory System Database Migration

## Migration File
`20240301_create_inventory_tables.sql`

## What This Migration Does
Creates the complete database schema for the inventory management system:
- `inventory_items` - Main inventory tracking table
- `inventory_transactions` - Transaction history for all inventory changes
- `inventory_recipes` - Cocktail/drink recipes
- `inventory_recipe_ingredients` - Recipe ingredient mappings

## How to Run This Migration

### Option 1: Using Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy the entire contents of `20240301_create_inventory_tables.sql`
4. Paste into the SQL editor
5. Click "Run" to execute

### Option 2: Using Supabase CLI
```bash
supabase db push migrations/20240301_create_inventory_tables.sql
```

### Option 3: Direct PostgreSQL Connection
```bash
psql -h your-db-host -U postgres -d your-database < migrations/20240301_create_inventory_tables.sql
```

## Verification
After running the migration, verify the tables were created:
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'inventory%';
```

You should see:
- inventory_items
- inventory_transactions
- inventory_recipes
- inventory_recipe_ingredients

## Rollback (if needed)
To rollback this migration:
```sql
DROP TABLE IF EXISTS inventory_recipe_ingredients CASCADE;
DROP TABLE IF EXISTS inventory_recipes CASCADE;
DROP TABLE IF EXISTS inventory_transactions CASCADE;
DROP TABLE IF EXISTS inventory_items CASCADE;
```

## Notes
- All tables have RLS (Row Level Security) enabled
- Authenticated users have full CRUD access
- The migration includes indexes for performance optimization
- Example data is commented out at the bottom (uncomment for testing)