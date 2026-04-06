# Migration: Add referred_by_member_id Column to Waitlist

**Date**: 2026-04-06
**Author**: AI Migration Generator
**Status**: Pending

---

## Description

Adds the `referred_by_member_id` column to the `waitlist` table to track which member referred each waitlist entry. This column was missing from the database but was already being queried by the API code, causing the "Referrals" and "Review" filters to show 0 counts in the admin waitlist view.

**Problem Solved**:
- API code in `src/pages/api/waitlist.js` queries `referred_by_member_id` column (lines 156-162, 219-226)
- Column doesn't exist in database → queries fail or return empty results
- Admin sees "Referrals: 0" and "Review: 0" even when there are entries
- Code expects to filter: Referrals (has referred_by_member_id) vs Regular Review (no referred_by_member_id)

**Solution**:
- Add `referred_by_member_id UUID` column to waitlist table
- Foreign key references `members.member_id`
- Nullable (not all waitlist entries are referrals)
- ON DELETE SET NULL (preserve waitlist entry if referring member deleted)
- Add indexes for filtering performance

---

## Tables Affected

- `waitlist` - **Modified** (column added)
- `members` - Referenced via foreign key

---

## Breaking Changes

**NO** - This is a non-breaking change.

- Column is nullable (existing data unaffected)
- No default value needed
- No code changes required (code already expects this column)
- Existing queries will now work correctly

---

## Prerequisites

- [x] `waitlist` table exists
- [x] `members` table exists with `member_id` column
- [ ] Backup database before applying
- [ ] Review affected API route: `src/pages/api/waitlist.js`

---

## Migration Steps

### Apply Migration

1. **Backup database** (optional but recommended)
   ```bash
   # In Supabase Dashboard:
   # Database → Backups → Create Backup
   ```

2. **Apply migration in Supabase SQL Editor**
   - Open Supabase Dashboard → SQL Editor
   - Copy contents of `20260406_add_referred_by_member_id_to_waitlist.sql`
   - Paste into SQL Editor
   - Click "Run" or press Cmd/Ctrl + Enter

3. **Verify migration**
   ```sql
   -- Check column exists
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_name = 'waitlist' AND column_name = 'referred_by_member_id';
   -- Expected: uuid, YES

   -- Check foreign key exists
   SELECT constraint_name, table_name
   FROM information_schema.table_constraints
   WHERE table_name = 'waitlist' AND constraint_type = 'FOREIGN KEY'
     AND constraint_name LIKE '%referred%';
   -- Expected: 1 row

   -- Check indexes created
   SELECT indexname FROM pg_indexes
   WHERE tablename = 'waitlist' AND indexname LIKE '%referred%';
   -- Expected: 2 indexes (idx_waitlist_referred_by_member, idx_waitlist_status_referral)
   ```

4. **Test the admin waitlist view**
   - Visit `/admin/membership` → Waitlist tab
   - Click "Referrals" status card
   - Click "Review" status card
   - Verify counts are no longer showing 0 incorrectly

---

### Rollback Migration

**Only if migration fails or needs reversal**

1. **Apply rollback script**
   - Copy contents of `20260406_add_referred_by_member_id_to_waitlist_ROLLBACK.sql`
   - Paste into SQL Editor
   - Execute

2. **Verify rollback**
   ```sql
   SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'waitlist' AND column_name = 'referred_by_member_id';
   -- Expected: 0
   ```

---

## Testing Checklist

After applying migration:

**Schema Validation**
- [ ] Column exists with correct data type (UUID)
- [ ] Column is nullable
- [ ] Foreign key to `members.member_id` exists
- [ ] ON DELETE SET NULL behavior configured
- [ ] Indexes created successfully (2 indexes)

**API Validation**
- [ ] GET `/api/waitlist?status=referrals` returns correct count
- [ ] GET `/api/waitlist?status=review` returns correct count (excludes referrals)
- [ ] No database errors in server logs
- [ ] Status counts displayed correctly in UI

**Application Testing**
- [ ] Admin waitlist view loads without errors
- [ ] "Referrals" status card shows correct count (entries with referred_by_member_id)
- [ ] "Review" status card shows correct count (entries WITHOUT referred_by_member_id)
- [ ] Clicking status cards filters correctly
- [ ] No console errors in browser

**Performance**
- [ ] Queries use indexes (run EXPLAIN ANALYZE on filter queries)
- [ ] No significant slowdown in waitlist page load

---

## Code Changes Required

**NONE** - The code already expects this column and was querying for it. This migration simply adds the missing column that the code was looking for.

However, you may want to update documentation:

| File | Change Required | Priority |
|------|-----------------|----------|
| `HOWTO.md` | Add `referred_by_member_id` to waitlist schema documentation | LOW |

---

## Data Migration (Post-Migration)

After applying this migration, you may want to populate `referred_by_member_id` for existing waitlist entries:

```sql
-- If you have referral data stored elsewhere (e.g., in referral field)
-- you can backfill the referred_by_member_id column

-- Example: If referral field contains member_id values
UPDATE waitlist
SET referred_by_member_id = referral::UUID
WHERE referral IS NOT NULL
  AND referral ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND referred_by_member_id IS NULL;
```

**Note**: Only run data migration if you have existing referral data to backfill. Otherwise, leave NULL for non-referral entries.

---

## Rollback Plan

**Complexity**: EASY

**Data Loss Risk**: LOW - Referral relationship data will be lost, but waitlist entries themselves remain intact. The `referral_clicks` table (if exists) still contains referral analytics.

**Steps**: See `20260406_add_referred_by_member_id_to_waitlist_ROLLBACK.sql`

**When to Rollback**:
- Migration causes unexpected errors
- Foreign key constraint fails (members table issue)
- Need to redesign referral tracking differently

---

## Notes

**Why was this column missing?**
- The code to filter by `referred_by_member_id` was added in commit `a6f9d6d` (Apr 6, 2026)
- The migration to add the column was never created
- The API has been querying a non-existent column, causing filters to return 0 results

**Related Tables**:
- `referral_clicks` table tracks referral link clicks (created separately)
- This column links waitlist entries to the referring member after they complete the form

**Performance Considerations**:
- Two indexes added: single column + composite (status, referred_by_member_id)
- Composite index optimizes the common query pattern used in admin filters
- Foreign key automatically indexed by PostgreSQL

---

## Related Documentation

- See HOWTO.md Section 4 (Database Schema) for waitlist table structure
- See `src/pages/api/waitlist.js` lines 154-173 for filter logic
- See `src/components/admin/WaitlistManager.tsx` for UI that uses these filters
- See `migrations/20260406_create_referral_clicks_table.sql` for related referral tracking

---

## Verification Queries

After migration, run these queries to verify everything works:

```sql
-- 1. Check column structure
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'waitlist' AND column_name = 'referred_by_member_id';

-- 2. Check foreign key relationship
SELECT
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table,
  ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'waitlist'
  AND kcu.column_name = 'referred_by_member_id';

-- 3. Test filtering queries (same as API uses)
-- Referrals count
SELECT COUNT(*) as referrals_count
FROM waitlist
WHERE referred_by_member_id IS NOT NULL
  AND status IN ('review', 'submitted');

-- Regular review count (non-referrals)
SELECT COUNT(*) as review_count
FROM waitlist
WHERE referred_by_member_id IS NULL
  AND status = 'review';

-- 4. Check indexes
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'waitlist'
  AND indexname LIKE '%referred%';
```

---
