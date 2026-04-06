-- ========================================
-- ROLLBACK: SMS Intake Campaigns System
-- Created: 2026-04-06
-- Description: Rollback migration for SMS Intake Campaigns System
--
-- WARNING: This will permanently remove:
--   - All SMS intake campaigns
--   - All campaign messages
--   - All enrollments
--   - All scheduled messages
--
-- ⚠️  BACKUP DATABASE BEFORE RUNNING THIS ROLLBACK! ⚠️
--
-- Data Loss: YES - All campaign data, enrollments, and scheduled messages will be deleted
-- Reversible: YES - Can re-apply forward migration, but data will be lost
-- ========================================

-- ========================================
-- STEP 1: DROP RLS POLICIES
-- ========================================

-- Drop policies on sms_intake_scheduled_messages
DROP POLICY IF EXISTS "Service role full access on sms_intake_scheduled_messages"
  ON sms_intake_scheduled_messages;

-- Drop policies on sms_intake_enrollments
DROP POLICY IF EXISTS "Service role full access on sms_intake_enrollments"
  ON sms_intake_enrollments;

-- Drop policies on sms_intake_campaign_messages
DROP POLICY IF EXISTS "Service role full access on sms_intake_campaign_messages"
  ON sms_intake_campaign_messages;

-- Drop policies on sms_intake_campaigns
DROP POLICY IF EXISTS "Service role full access on sms_intake_campaigns"
  ON sms_intake_campaigns;

-- ========================================
-- STEP 2: DISABLE RLS
-- ========================================

ALTER TABLE sms_intake_scheduled_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE sms_intake_enrollments DISABLE ROW LEVEL SECURITY;
ALTER TABLE sms_intake_campaign_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE sms_intake_campaigns DISABLE ROW LEVEL SECURITY;

-- ========================================
-- STEP 3: DROP TRIGGERS
-- ========================================

-- Drop campaign messages updated_at trigger
DROP TRIGGER IF EXISTS sms_intake_campaign_messages_updated_at_trigger
  ON sms_intake_campaign_messages;

DROP FUNCTION IF EXISTS update_sms_intake_campaign_messages_updated_at();

-- Drop campaigns updated_at trigger
DROP TRIGGER IF EXISTS sms_intake_campaigns_updated_at_trigger
  ON sms_intake_campaigns;

DROP FUNCTION IF EXISTS update_sms_intake_campaigns_updated_at();

-- ========================================
-- STEP 4: DROP INDEXES
-- ========================================

-- Drop indexes on sms_intake_scheduled_messages
DROP INDEX IF EXISTS idx_sms_intake_scheduled_enrollment;
DROP INDEX IF EXISTS idx_sms_intake_scheduled_pending;

-- Drop indexes on sms_intake_enrollments
DROP INDEX IF EXISTS idx_sms_intake_enrollments_campaign;
DROP INDEX IF EXISTS idx_sms_intake_enrollments_unique_active;

-- Drop indexes on sms_intake_campaign_messages
DROP INDEX IF EXISTS idx_sms_intake_campaign_messages_campaign;

-- Drop indexes on sms_intake_campaigns
DROP INDEX IF EXISTS idx_sms_intake_campaigns_trigger_word;

-- ========================================
-- STEP 5: DROP TABLES (in reverse dependency order)
-- ========================================

-- Drop child tables first (those with foreign keys)
DROP TABLE IF EXISTS sms_intake_scheduled_messages CASCADE;
DROP TABLE IF EXISTS sms_intake_enrollments CASCADE;
DROP TABLE IF EXISTS sms_intake_campaign_messages CASCADE;

-- Drop parent table last
DROP TABLE IF EXISTS sms_intake_campaigns CASCADE;

-- ========================================
-- ROLLBACK COMPLETE
-- ========================================

-- Verify all tables removed
SELECT
  COUNT(*) as remaining_tables,
  STRING_AGG(table_name, ', ') as table_names
FROM information_schema.tables
WHERE table_name IN (
  'sms_intake_campaigns',
  'sms_intake_campaign_messages',
  'sms_intake_enrollments',
  'sms_intake_scheduled_messages'
);
-- Expected: remaining_tables = 0, table_names = NULL

-- Verify no policies remain
SELECT
  COUNT(*) as remaining_policies,
  STRING_AGG(tablename || '.' || policyname, ', ') as policy_names
FROM pg_policies
WHERE tablename IN (
  'sms_intake_campaigns',
  'sms_intake_campaign_messages',
  'sms_intake_enrollments',
  'sms_intake_scheduled_messages'
);
-- Expected: remaining_policies = 0, policy_names = NULL

-- Verify no indexes remain
SELECT
  COUNT(*) as remaining_indexes,
  STRING_AGG(indexname, ', ') as index_names
FROM pg_indexes
WHERE indexname LIKE 'idx_sms_intake%';
-- Expected: remaining_indexes = 0, index_names = NULL

-- Verify no functions remain
SELECT
  COUNT(*) as remaining_functions,
  STRING_AGG(proname, ', ') as function_names
FROM pg_proc
WHERE proname LIKE '%sms_intake%';
-- Expected: remaining_functions = 0, function_names = NULL
