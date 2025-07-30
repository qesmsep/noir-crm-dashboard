# Campaign ID System Fix

## Problem Identified

The current campaign system had several issues that could lead to data integrity problems:

1. **Non-Unique Campaign IDs**: The system was generating campaign IDs using `campaign-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` which could potentially create duplicates
2. **Mixed Data Types**: The `campaign_id` field was TEXT instead of UUID, making it less efficient and potentially causing collisions
3. **Inconsistent Schema**: Multiple migration files had different table structures for campaigns

## Solution Implemented

### 1. Database Schema Changes

**New Campaigns Table Structure:**
```sql
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(), -- Changed to UUID
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL DEFAULT 'member_signup',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**New Campaign Templates Table Structure:**
```sql
CREATE TABLE campaign_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(campaign_id) ON DELETE CASCADE, -- UUID reference
    name TEXT NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    recipient_type TEXT NOT NULL DEFAULT 'member',
    specific_phone TEXT,
    timing_type TEXT NOT NULL DEFAULT 'specific_time',
    specific_time TEXT, -- HH:MM format
    duration_quantity INTEGER DEFAULT 1,
    duration_unit TEXT DEFAULT 'hr',
    duration_proximity TEXT DEFAULT 'after',
    trigger_type TEXT NOT NULL DEFAULT 'member_signup',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. API Changes

**Campaign Creation API (`src/pages/api/campaigns.ts`):**
- Changed from timestamp-based ID generation to `crypto.randomUUID()`
- This ensures truly unique UUIDs that cannot collide

### 3. Component Updates

**CampaignDrawer.tsx:**
- Updated interface to reflect UUID campaign_id
- No functional changes needed since it already handles string IDs

**CampaignTemplateDrawer.tsx:**
- Updated interface to reflect UUID campaign_id
- Updated form initialization to properly set campaign_id from props

## Benefits of This Fix

1. **Guaranteed Uniqueness**: UUIDs are globally unique and cannot collide
2. **Better Performance**: UUID indexes are more efficient than text indexes
3. **Data Integrity**: Foreign key constraints ensure referential integrity
4. **Scalability**: UUIDs work better in distributed systems
5. **Future-Proof**: UUIDs are the standard for modern applications

## Migration Process

1. **Run the SQL Migration**: Execute `fix_campaign_id_system.sql` in Supabase
2. **Existing Data**: The migration will backup existing data and recreate tables with proper UUIDs
3. **Template Recreation**: Campaign templates will need to be recreated since the campaign_id reference changed
4. **Verification**: The migration includes verification queries to ensure everything is working

## Impact on Existing Code

- **Frontend**: Minimal changes needed, mostly interface updates
- **API**: Updated to use `crypto.randomUUID()` instead of timestamp-based generation
- **Database**: Complete restructure with proper UUIDs and foreign key constraints

## Testing Recommendations

1. **Create New Campaigns**: Test that new campaigns get proper UUIDs
2. **Create Templates**: Test that templates can be created within campaigns
3. **Message Processing**: Test that the campaign message processing still works
4. **Data Integrity**: Verify that foreign key constraints work properly

## Rollback Plan

If issues arise, the migration includes backup tables:
- `backup_campaigns`
- `backup_campaign_templates`

These can be used to restore the previous system if needed. 