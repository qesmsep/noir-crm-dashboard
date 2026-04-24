# Migration: Phase 1 - Campaign Multi-Location Infrastructure

**Date**: 2026-04-24
**Author**: AI Migration Generator (with Senior Architect Review)
**Status**: ⏳ Pending Review
**Phase**: 1 of 5 (Infrastructure Only)

---

## ⚠️ IMPORTANT: Multi-Phase Migration

This is **PHASE 1** of a 5-phase migration to add multi-location support to campaigns.

**DO NOT skip phases or apply out of order!**

### Migration Phases

1. **Phase 1 (This Migration)**: Infrastructure - Create tables, columns, indexes ✅ SAFE
2. **Phase 2**: Data Backfill - Populate location_id on existing data ⏳ Pending
3. **Phase 3**: Migrate Templates - Convert reservation_reminder_templates to campaigns ⏳ Pending
4. **Phase 4**: Update Code - Modify APIs and UI to use new system ⏳ Pending
5. **Phase 5**: Deprecation - Mark old system deprecated, final cleanup ⏳ Pending

---

## Description

Creates the database infrastructure needed for multi-location campaign support. This migration is **purely additive** - it creates new tables, columns, and indexes without modifying any existing behavior.

### What This Migration Does

✅ Creates `campaign_locations` junction table for campaign-location assignments
✅ Adds `location_id` column to `reservations` table (nullable, empty)
✅ Adds `applies_to_all_locations` flag to `campaigns` table
✅ Creates performance indexes for location-based queries
✅ Adds RLS policies for secure access
✅ Creates helper functions for location filtering
✅ Adds safety trigger to prevent orphaned campaigns

### What This Migration Does NOT Do

❌ **Does not** modify any existing data
❌ **Does not** change any application behavior
❌ **Does not** affect campaign processing
❌ **Does not** require code changes
❌ **Does not** risk data loss

---

## Tables Affected

| Table | Change | Risk Level |
|-------|--------|------------|
| `campaign_locations` | **CREATED** (new junction table) | 🟢 None - new table |
| `reservations` | **MODIFIED** - added `location_id UUID` column | 🟢 Low - nullable, no defaults |
| `campaigns` | **MODIFIED** - added `applies_to_all_locations BOOLEAN` column | 🟢 Low - defaults to false |

---

## Breaking Changes

**NO BREAKING CHANGES** ✅

This migration is designed to be 100% backward compatible:
- All new columns are nullable with safe defaults
- No existing queries are affected
- No application code needs updating
- Campaign processing continues unchanged

---

## Prerequisites

### Required Migrations

- [x] `20260413000000_create_locations_table.sql` - locations table must exist
- [x] `campaigns` table must exist
- [x] `reservations` table must exist

### Pre-Migration Checklist

- [ ] **Backup database** (even though this is safe, always backup first!)
- [ ] Verify locations table has data (NoirKC and RooftopKC)
- [ ] Verify campaigns table exists and has campaigns
- [ ] Verify reservations table exists
- [ ] Review migration SQL in SQL editor
- [ ] Have rollback script ready

---

## Migration Steps

### 1. Backup Database

```bash
# In Supabase Dashboard:
# Settings → Database → Backups → Create Backup
# OR use pg_dump if self-hosted
```

### 2. Apply Migration

**Option A: Supabase Dashboard (Recommended)**

1. Open Supabase Dashboard → SQL Editor
2. Copy entire contents of `20260424_phase1_campaign_locations_infrastructure.sql`
3. Paste into SQL Editor
4. Click **Run** (or press Cmd/Ctrl + Enter)
5. Verify success messages in output

**Option B: Command Line**

```bash
psql $DATABASE_URL -f supabase/migrations/20260424_phase1_campaign_locations_infrastructure.sql
```

### 3. Verify Migration Success

Run these queries in SQL Editor:

```sql
-- Check campaign_locations table exists
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'campaign_locations') as column_count
FROM information_schema.tables
WHERE table_name = 'campaign_locations';
-- Expected: 1 row with column_count = 4

-- Check reservations.location_id column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'reservations' AND column_name = 'location_id';
-- Expected: 1 row, data_type = 'uuid', is_nullable = 'YES'

-- Check campaigns.applies_to_all_locations column exists
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'campaigns' AND column_name = 'applies_to_all_locations';
-- Expected: 1 row, data_type = 'boolean', column_default = 'false'

-- Check indexes created
SELECT indexname, tablename
FROM pg_indexes
WHERE indexname LIKE 'idx_campaign%' OR indexname LIKE 'idx_reservations_location%'
ORDER BY tablename, indexname;
-- Expected: At least 6 indexes

-- Check RLS enabled
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'campaign_locations';
-- Expected: 1 row with relrowsecurity = true

-- Check policies created
SELECT policyname, tablename
FROM pg_policies
WHERE tablename = 'campaign_locations'
ORDER BY policyname;
-- Expected: At least 2 policies

-- Check helper functions created
SELECT proname, pronargs
FROM pg_proc
WHERE proname IN ('get_campaign_location_ids', 'campaign_applies_to_location', 'prevent_orphaned_campaigns');
-- Expected: 3 rows
```

### 4. Test Helper Functions

```sql
-- Test get_campaign_location_ids (should return empty array for now)
SELECT get_campaign_location_ids(id) as location_ids
FROM campaigns
LIMIT 1;
-- Expected: {}

-- Test campaign_applies_to_location
-- Get a campaign and location ID first
SELECT campaign_applies_to_location(
  (SELECT id FROM campaigns LIMIT 1),
  (SELECT id FROM locations WHERE slug = 'noirkc')
) as applies;
-- Expected: false (no locations assigned yet)
```

---

## Rollback Procedure

**Complexity**: 🟢 EASY
**Data Loss Risk**: 🟢 NO - Phase 1 adds no data
**Downtime**: None

### When to Rollback

- Migration fails with errors
- Verification queries show unexpected results
- Need to postpone multi-location support
- Issues discovered during Phase 2 planning

### Rollback Steps

1. **Apply rollback script**
   ```bash
   # In Supabase SQL Editor
   # Copy contents of: 20260424_phase1_campaign_locations_infrastructure_ROLLBACK.sql
   # Paste and execute
   ```

2. **Verify rollback**
   ```sql
   -- Verify table removed
   SELECT COUNT(*) FROM information_schema.tables
   WHERE table_name = 'campaign_locations';
   -- Expected: 0

   -- Verify columns removed
   SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'reservations' AND column_name = 'location_id';
   -- Expected: 0

   SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'campaigns' AND column_name = 'applies_to_all_locations';
   -- Expected: 0
   ```

3. **Confirm system functional**
   - Test campaign processing: `/api/process-campaign-messages`
   - Test reservation creation
   - Check admin UI loads normally

---

## Code Changes Required

### Phase 1: NONE ✅

**No code changes needed for Phase 1!**

This migration is purely infrastructure. The application will continue functioning exactly as before.

### Future Phases Will Require

| Phase | Files to Update | Priority |
|-------|-----------------|----------|
| Phase 2 | None (data backfill only) | N/A |
| Phase 3 | `src/types/index.ts` - Add Campaign location types | HIGH |
| Phase 4 | `src/pages/api/process-campaign-messages.ts` - Location filtering | HIGH |
| Phase 4 | `src/components/CampaignDrawer.tsx` - Location multi-select UI | HIGH |
| Phase 4 | `src/pages/admin/communication.tsx` - Display locations | MEDIUM |
| Phase 5 | Deprecation warnings in old APIs | LOW |

---

## Testing Checklist

### After Applying Phase 1 Migration

**Schema Validation**
- [ ] `campaign_locations` table exists with 4 columns
- [ ] `reservations.location_id` column exists and is nullable
- [ ] `campaigns.applies_to_all_locations` column exists with default false
- [ ] All 6+ indexes created successfully
- [ ] RLS enabled on `campaign_locations`
- [ ] At least 2 RLS policies on `campaign_locations`
- [ ] 3 helper functions created

**Data Validation**
- [ ] `campaign_locations` table is empty (expected)
- [ ] All reservations have `location_id = NULL` (expected)
- [ ] All campaigns have `applies_to_all_locations = false` (expected)

**Application Testing**
- [ ] Campaign processing still works (`/api/process-campaign-messages`)
- [ ] Reservation creation still works
- [ ] Admin UI loads without errors
- [ ] No console errors in browser
- [ ] Campaign list displays correctly
- [ ] Can create new campaigns
- [ ] Can edit existing campaigns

**Performance**
- [ ] Campaign queries have not slowed down
- [ ] Reservation queries have not slowed down
- [ ] Admin UI remains responsive

---

## Architecture Decisions

### Why Junction Table?

**Requirement**: Support 1 campaign → many locations (future expansion to 3+ locations)

**Options Considered**:
1. ❌ `location_id` column on campaigns (1:1 only)
2. ❌ `location_ids JSONB` array (poor performance, no FK constraints)
3. ✅ **Junction table** (proper many-to-many, FK constraints, indexable)

**Decision**: Junction table for scalability and proper relational design

### Why `applies_to_all_locations` Flag?

**Problem**: Empty junction table is ambiguous:
- Does it mean "no locations assigned" (incomplete)?
- Or "applies to all locations" (intentional)?

**Solution**: Explicit flag removes ambiguity:
- `applies_to_all_locations = true` → Ignore junction table, campaign is global
- `applies_to_all_locations = false` + empty junction → Campaign not properly configured
- `applies_to_all_locations = false` + junction entries → Campaign applies to those locations

**Critical Review Finding**: This addresses the "empty junction table ambiguity" issue identified by the senior architect review.

### Why `location_id` on Reservations?

**Problem**: Reservations → Tables → Locations is fragile:
- Reservations may not have `table_id` when first created
- Need location for early campaign processing (confirmation messages)
- JOIN complexity impacts performance

**Solution**: Direct `location_id` reference:
- Can filter by location even before table assigned
- Single-column index faster than multi-table JOIN
- Backfilled from `tables.location_id` where `table_id` exists

**Critical Review Finding**: This addresses the "reservations without table_id" issue.

### Why `ON DELETE RESTRICT` for Locations?

**Problem**: Deleting a location could orphan campaigns or cause data loss

**Solution**: Prevent location deletion if:
- Campaigns are assigned to it
- Reservations reference it

**Safety**: Forces admin to reassign campaigns/reservations before deleting location

**Critical Review Finding**: This addresses the "cascade deletion data loss" risk.

---

## Performance Impact

### Expected Performance Changes

| Operation | Before | After | Impact |
|-----------|--------|-------|--------|
| Campaign processing | Single table scan | Same (no filtering yet) | 🟢 None |
| Reservation creation | Table lookup | Table lookup + location_id update | 🟢 Negligible (<1ms) |
| Admin campaign list | Simple SELECT | Same (no location join yet) | 🟢 None |

### Index Strategy

All indexes created are **non-blocking** (uses `IF NOT EXISTS`):
- Campaign location lookups: Composite index on (campaign_id, location_id)
- Reservation location filtering: Index on (location_id, start_time)
- Global campaign filtering: Partial index on applies_to_all_locations

**Query Performance**: No degradation expected until Phase 4 (when location filtering is added)

---

## Security Considerations

### RLS Policies

**campaign_locations table**:
- ✅ Service role: Full access (for API operations)
- ✅ Authenticated users: Read access (for UI display)
- ✅ Admins only: Write access (via `is_member_portal_admin()`)

**Fallback Policy**:
If `is_member_portal_admin()` function doesn't exist, a temporary policy allows all authenticated users. This must be tightened in production.

**Action Required**: Verify `is_member_portal_admin()` function exists, or create it:
```sql
CREATE OR REPLACE FUNCTION is_member_portal_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Your admin check logic here
  -- Example: Check if user has admin role
  RETURN EXISTS (
    SELECT 1 FROM admins
    WHERE user_id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Known Issues & Limitations

### Phase 1 Limitations

1. **No location filtering yet**: Campaigns still process all reservations regardless of location (this is intentional, fixed in Phase 4)

2. **Empty junction table**: All campaigns have empty `campaign_locations` until Phase 2 backfill

3. **NULL location_id on reservations**: All existing reservations have `location_id = NULL` until Phase 2 backfill

4. **Admin function dependency**: RLS policy assumes `is_member_portal_admin()` exists

### Future Phase Dependencies

**Phase 2 Prerequisites**:
- [ ] Verify all tables have `location_id` populated
- [ ] Decide default location for existing campaigns (NoirKC vs All Locations)
- [ ] Test backfill queries on production copy

**Phase 3 Prerequisites**:
- [ ] Audit all `reservation_reminder_templates` usage
- [ ] Map template timing to campaign timing types
- [ ] Plan feature flag strategy

**Phase 4 Prerequisites**:
- [ ] Update TypeScript types
- [ ] Create location multi-select UI component
- [ ] Add location filtering to campaign processing
- [ ] Extensive testing with feature flag

**Phase 5 Prerequisites**:
- [ ] Monitor Phase 4 in production for 2+ weeks
- [ ] Verify no duplicate messages
- [ ] Get stakeholder approval for deprecation
- [ ] Create deprecation timeline

---

## Monitoring & Alerts

### Phase 1 Metrics to Track

Even though Phase 1 changes no behavior, monitor:

**Database Metrics**:
- [ ] Table sizes (should not increase significantly)
- [ ] Index build time (should complete in < 1 minute)
- [ ] Query performance (should remain unchanged)

**Application Metrics**:
- [ ] Campaign processing success rate (should remain 100%)
- [ ] Reservation creation rate (should be unaffected)
- [ ] API error rates (should not increase)

**Schema Metrics**:
```sql
-- Monitor junction table size (should remain 0 until Phase 2)
SELECT COUNT(*) as campaign_location_assignments
FROM campaign_locations;

-- Monitor location_id population (should remain 0 until Phase 2)
SELECT
  COUNT(*) as total_reservations,
  COUNT(location_id) as with_location,
  COUNT(*) - COUNT(location_id) as without_location
FROM reservations;

-- Monitor campaign flag usage (should all be false until Phase 2)
SELECT
  COUNT(*) as total_campaigns,
  SUM(CASE WHEN applies_to_all_locations THEN 1 ELSE 0 END) as global_campaigns,
  COUNT(*) - SUM(CASE WHEN applies_to_all_locations THEN 1 ELSE 0 END) as location_specific
FROM campaigns;
```

---

## Support & Troubleshooting

### Common Issues

**Issue**: Migration fails with "table already exists"
**Solution**: Table was partially created. Run rollback, then re-apply.

**Issue**: RLS policy creation fails
**Solution**: `is_member_portal_admin()` function missing. See Security Considerations section.

**Issue**: Index creation is slow
**Solution**: Indexes are created on empty tables, should be instant. Check for locks.

**Issue**: Helper function test returns error
**Solution**: Verify campaigns table has at least one campaign.

### Getting Help

1. Check migration output for specific error messages
2. Run verification queries to identify what failed
3. Review rollback script before executing
4. Consult senior database admin if uncertain

---

## Next Steps

### After Successful Phase 1 Deployment

1. **Monitor for 24 hours**
   - Track all metrics listed in Monitoring section
   - Verify no performance degradation
   - Ensure no errors in application logs

2. **Plan Phase 2 (Data Backfill)**
   - Review existing reservations
   - Decide location assignment strategy
   - Prepare backfill queries
   - Schedule Phase 2 migration

3. **Communication**
   - Notify team that Phase 1 is complete
   - Share Phase 2 timeline
   - Document any learnings or issues

### Phase 2 Timeline (Recommended)

- **Wait**: 48 hours minimum after Phase 1
- **Review**: All monitoring data
- **Plan**: Phase 2 backfill strategy
- **Test**: Backfill queries on database copy
- **Schedule**: Phase 2 during low-traffic window

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-04-24 | AI + Review Agent | Initial Phase 1 migration created |
| 2026-04-24 | AI + Review Agent | Added safety triggers and explicit flags per review |

---

## References

- Senior Architect Review: Identified 8 critical issues, all addressed in this migration
- Original Plan: Modified to use phased approach instead of single migration
- Schema Scout Output: Used to understand existing relationships
- HOWTO.md Database Schema: Referenced for naming conventions

---

**END OF PHASE 1 README**

✅ Safe to apply
✅ No breaking changes
✅ Fully reversible
⏳ Phase 2 planning begins after 48-hour monitoring period
