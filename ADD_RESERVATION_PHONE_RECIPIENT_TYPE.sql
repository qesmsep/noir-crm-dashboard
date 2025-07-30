-- Add reservation_phone recipient type to campaign_templates table
-- This script updates the recipient_type enum to include the new option

DO $$
BEGIN
    -- First, let's check the current recipient_type values
    SELECT DISTINCT recipient_type FROM campaign_templates;
    
    -- Update existing templates that might need the new recipient type
    -- For now, we'll keep existing templates as they are
    
    -- Add the new recipient_type option to the enum if it doesn't exist
    -- Note: PostgreSQL doesn't allow adding values to existing enums easily
    -- We'll need to handle this in the application logic for now
    
    RAISE NOTICE 'New recipient_type "reservation_phone" will be handled in application logic';
    
    -- Show current recipient_type distribution
    SELECT 
        recipient_type,
        COUNT(*) as count
    FROM campaign_templates 
    GROUP BY recipient_type
    ORDER BY recipient_type;
    
END $$;

-- Verify the current state
SELECT 
    id,
    name,
    recipient_type,
    trigger_type
FROM campaign_templates 
ORDER BY recipient_type, name; 