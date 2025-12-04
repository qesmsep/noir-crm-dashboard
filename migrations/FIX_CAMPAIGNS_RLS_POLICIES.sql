-- Fix RLS policies for campaigns table
-- This script ensures that authenticated users can perform CRUD operations on the campaigns table

DO $$
BEGIN
    -- Check if campaigns table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaigns' AND table_schema = 'public') THEN
        
        -- Enable RLS if not already enabled
        ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
        
        -- Grant permissions to authenticated users
        GRANT ALL ON campaigns TO authenticated;
        
        -- Drop existing policies
        DROP POLICY IF EXISTS "Enable read access for authenticated users" ON campaigns;
        DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON campaigns;
        DROP POLICY IF EXISTS "Enable update access for authenticated users" ON campaigns;
        DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON campaigns;
        DROP POLICY IF EXISTS "Admins can manage campaigns" ON campaigns;
        DROP POLICY IF EXISTS "Super admins can manage campaigns" ON campaigns;
        
        -- Create simple policies that allow any authenticated user to perform all operations
        -- This is appropriate for the campaign management system
        CREATE POLICY "Allow authenticated users to read campaigns" ON campaigns
            FOR SELECT USING (auth.role() = 'authenticated');
            
        CREATE POLICY "Allow authenticated users to insert campaigns" ON campaigns
            FOR INSERT WITH CHECK (auth.role() = 'authenticated');
            
        CREATE POLICY "Allow authenticated users to update campaigns" ON campaigns
            FOR UPDATE USING (auth.role() = 'authenticated');
            
        CREATE POLICY "Allow authenticated users to delete campaigns" ON campaigns
            FOR DELETE USING (auth.role() = 'authenticated');
            
        RAISE NOTICE 'RLS policies for campaigns table have been updated successfully';
        
    ELSE
        RAISE NOTICE 'Campaigns table does not exist. Please run the campaign migration first.';
    END IF;
END $$;

-- Also fix campaign_templates table policies
DO $$
BEGIN
    -- Check if campaign_templates table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaign_templates' AND table_schema = 'public') THEN
        
        -- Enable RLS if not already enabled
        ALTER TABLE campaign_templates ENABLE ROW LEVEL SECURITY;
        
        -- Grant permissions to authenticated users
        GRANT ALL ON campaign_templates TO authenticated;
        
        -- Drop existing policies
        DROP POLICY IF EXISTS "Enable read access for authenticated users" ON campaign_templates;
        DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON campaign_templates;
        DROP POLICY IF EXISTS "Enable update access for authenticated users" ON campaign_templates;
        DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON campaign_templates;
        DROP POLICY IF EXISTS "Super admins can manage campaign templates" ON campaign_templates;
        
        -- Create simple policies that allow any authenticated user to perform all operations
        CREATE POLICY "Allow authenticated users to read campaign templates" ON campaign_templates
            FOR SELECT USING (auth.role() = 'authenticated');
            
        CREATE POLICY "Allow authenticated users to insert campaign templates" ON campaign_templates
            FOR INSERT WITH CHECK (auth.role() = 'authenticated');
            
        CREATE POLICY "Allow authenticated users to update campaign templates" ON campaign_templates
            FOR UPDATE USING (auth.role() = 'authenticated');
            
        CREATE POLICY "Allow authenticated users to delete campaign templates" ON campaign_templates
            FOR DELETE USING (auth.role() = 'authenticated');
            
        RAISE NOTICE 'RLS policies for campaign_templates table have been updated successfully';
        
    ELSE
        RAISE NOTICE 'Campaign_templates table does not exist. Please run the campaign migration first.';
    END IF;
END $$;

-- Also fix scheduled_campaign_messages table policies
DO $$
BEGIN
    -- Check if scheduled_campaign_messages table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scheduled_campaign_messages' AND table_schema = 'public') THEN
        
        -- Enable RLS if not already enabled
        ALTER TABLE scheduled_campaign_messages ENABLE ROW LEVEL SECURITY;
        
        -- Grant permissions to authenticated users
        GRANT ALL ON scheduled_campaign_messages TO authenticated;
        
        -- Drop existing policies
        DROP POLICY IF EXISTS "Enable read access for authenticated users" ON scheduled_campaign_messages;
        DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON scheduled_campaign_messages;
        DROP POLICY IF EXISTS "Enable update access for authenticated users" ON scheduled_campaign_messages;
        DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON scheduled_campaign_messages;
        
        -- Create simple policies that allow any authenticated user to perform all operations
        CREATE POLICY "Allow authenticated users to read scheduled campaign messages" ON scheduled_campaign_messages
            FOR SELECT USING (auth.role() = 'authenticated');
            
        CREATE POLICY "Allow authenticated users to insert scheduled campaign messages" ON scheduled_campaign_messages
            FOR INSERT WITH CHECK (auth.role() = 'authenticated');
            
        CREATE POLICY "Allow authenticated users to update scheduled campaign messages" ON scheduled_campaign_messages
            FOR UPDATE USING (auth.role() = 'authenticated');
            
        CREATE POLICY "Allow authenticated users to delete scheduled campaign messages" ON scheduled_campaign_messages
            FOR DELETE USING (auth.role() = 'authenticated');
            
        RAISE NOTICE 'RLS policies for scheduled_campaign_messages table have been updated successfully';
        
    ELSE
        RAISE NOTICE 'Scheduled_campaign_messages table does not exist. Please run the campaign migration first.';
    END IF;
END $$;

-- Verify the policies were created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' AND tablename IN ('campaigns', 'campaign_templates', 'scheduled_campaign_messages')
ORDER BY tablename, policyname;

-- Test if we can insert a campaign (this will help verify the policies work)
-- Note: This is just a verification query, not an actual insert
SELECT 
    'Campaigns table RLS status:' as status,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'campaigns'; 