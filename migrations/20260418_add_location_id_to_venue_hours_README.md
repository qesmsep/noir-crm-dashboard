# Migration: Add location_id to venue_hours

**Date**: 2026-04-18
**Author**: AI Migration Generator
**Status**: ⏳ Pending Application

---

## Description

This migration adds location-specific support to the `venue_hours` table, making custom open/closed days and base hours associated with specific venue locations (Noir KC, RooftopKC, etc.). This fixes the issue where RooftopKC displays Noir KC's calendar events in their settings tab.

**Business Problem Solved**:
- Custom open/closed days are currently global (apply to all locations)
- RooftopKC settings show Noir KC's closed days (see screenshot)
- Each venue needs independent calendar management

---

## Tables Affected

- `venue_hours` - **Modified** (adds `location_id` column, FK constraint, indexes)
- `locations` - **Referenced** (FK target)

---

## Breaking Changes

**NO** - Column is nullable

**Behavior Change**:
- ✅ Existing code continues to work
- ⚠️ **IMPORTANT**: Existing `venue_hours` records have `location_id = NULL`
- ⚠️ Component filters by `location_id`, so NULL records may not show up correctly
- 🔧 **RECOMMENDED**: Backfill existing records with Noir KC location (see Step 2 in SQL)

---

## Prerequisites

- [ ] **Backup database** before applying
- [ ] Decide on backfill strategy:
  - **Option A (RECOMMENDED)**: Backfill existing records to Noir KC
  - **Option B**: Leave NULL, handle in code
- [ ] Verify Noir KC location exists: `SELECT * FROM locations WHERE slug = 'noirkc'`

---

## Decision: Backfill Strategy

### Option A: Backfill to Noir KC (RECOMMENDED ✅)

**Pros**:
- Fixes the issue immediately (RooftopKC won't show Noir KC's events)
- Each venue sees only their own hours
- Cleaner data model

**Cons**:
- Assumes all historical data is Noir KC's
- Irreversible (unless you restore from backup)

**How to apply**:
- Uncomment STEP 2 in the migration SQL before running

---

### Option B: Leave NULL (NOT RECOMMENDED ❌)

**Pros**:
- "Backward compatible" (doesn't change existing data)

**Cons**:
- NULL records will show for ALL locations or NONE
- Doesn't fix the RooftopKC showing Noir KC issue
- Requires code changes to handle NULL specially
- Confusing for users

**Tim's Requirement**: Based on the conversation, you want each venue to only see their own events. This means **Option A is the right choice**.

---

## Migration Steps

### Apply Migration

1. **Backup database**
   ```bash
   # In Supabase Dashboard:
   # Settings → Database → Backup → Create backup
   ```

2. **Decide on backfill**
   - If choosing **Option A (RECOMMENDED)**: Uncomment STEP 2 in the SQL file
   - If choosing **Option B**: Leave STEP 2 commented out

3. **Verify prerequisites**
   ```sql
   -- Ensure Noir KC location exists
   SELECT id, name, slug FROM locations WHERE slug = 'noirkc';
   -- Should return Noir KC location record

   -- Check current venue_hours count and types
   SELECT type, COUNT(*) FROM venue_hours GROUP BY type;
   ```

4. **Apply migration in Supabase SQL Editor**
   - Open Supabase Dashboard → SQL Editor
   - Copy contents of `20260418_add_location_id_to_venue_hours.sql`
   - **If backfilling**: Uncomment the UPDATE block in STEP 2
   - Paste into SQL Editor
   - Click **Run**
   - Review output for any errors

5. **Verify migration succeeded**

   Check the distribution query output:
   ```
   If backfilled:
   ✓ All records show "Noir KC" location
   ✓ No "UNASSIGNED (NULL)" records

   If not backfilled:
   ⚠️ All records show "UNASSIGNED (NULL)"
   ```

6. **Test application**
   - Go to Settings → RooftopKC → Custom Closed Days
   - Should be EMPTY (or only show RooftopKC events if any were created)
   - Should NOT show Noir KC's events
   - Go to Settings → Noir KC → Custom Closed Days
   - Should show Noir KC's events (backfilled records)
   - Create a new closed day in Noir KC → verify it appears
   - Go back to RooftopKC → verify new Noir KC event does NOT appear

---

## Testing Checklist

### Schema Validation
- [ ] `location_id` column exists with type `UUID`
- [ ] `location_id` is `NULLABLE` (allows NULL)
- [ ] Foreign key `fk_venue_hours_location_id` points to `locations(id)`
- [ ] ON DELETE RESTRICT prevents location deletion if hours exist
- [ ] Indexes created: `idx_venue_hours_location_id`, `idx_venue_hours_location_type`

### Data Validation (if backfilled)
- [ ] All existing `venue_hours` have `location_id` set to Noir KC
- [ ] No NULL `location_id` values exist
- [ ] Distribution query shows all records under "Noir KC"

### Data Validation (if NOT backfilled)
- [ ] All existing `venue_hours` have `location_id = NULL`
- [ ] Distribution query shows all records under "UNASSIGNED (NULL)"

### Application Testing
- [ ] **RooftopKC Settings Tab**:
  - [ ] Custom Closed Days section is empty (if backfilled)
  - [ ] Can create new closed day
  - [ ] New event appears only in RooftopKC, NOT in Noir KC

- [ ] **Noir KC Settings Tab**:
  - [ ] Custom Closed Days shows existing events (if backfilled)
  - [ ] Can create new closed day
  - [ ] New event appears only in Noir KC, NOT in RooftopKC

- [ ] **Cross-venue isolation**:
  - [ ] Creating event in Noir KC → doesn't appear in RooftopKC ✅
  - [ ] Creating event in RooftopKC → doesn't appear in Noir KC ✅
  - [ ] Deleting event in Noir KC → doesn't affect RooftopKC ✅

### Performance
- [ ] Query performance acceptable
  ```sql
  EXPLAIN ANALYZE
  SELECT * FROM venue_hours
  WHERE location_id = '<some-uuid>'
  AND type = 'exceptional_closure';
  -- Should show "Index Scan using idx_venue_hours_location_type"
  ```

---

## Code Changes Required

✅ **Already completed** (changes made before migration):

| File | Change | Status |
|------|--------|--------|
| `src/components/CalendarAvailabilityControl.tsx` | Filters by `location_id` when loading hours | ✅ Done (lines 186-191) |
| `src/components/CalendarAvailabilityControl.tsx` | Adds `location_id` to INSERT for custom days | ✅ Done (lines 280-283, 329-332) |
| `src/pages/admin/settings.tsx` | Passes `locationSlug` prop to component | ✅ Done (lines 585, 589, 734, 738) |
| `HOWTO.md` | Document `location_id` in schema | ⏳ Pending |

---

## Rollback Plan

**Complexity**: 🟢 EASY

**Data Loss Risk**: NO (column removal doesn't delete venue_hours records, only location associations)

**Steps**:
1. Run `20260418_add_location_id_to_venue_hours_ROLLBACK.sql`
2. Existing data reverts to global hours (no location filter)
3. RooftopKC will show Noir KC's events again (original issue returns)

**Recovery**:
- Re-apply forward migration (with or without backfill)

---

## Important Notes

### Issue Explained

**Before migration**:
- `venue_hours` has no `location_id` column
- All custom open/closed days are global
- Component code tries to filter by `location_id` → finds nothing (or ignores filter)
- Result: RooftopKC shows Noir KC's events (see screenshot)

**After migration (with backfill)**:
- Existing Noir KC events have `location_id = <noirkc-id>`
- RooftopKC filters for `location_id = <rooftopkc-id>`
- RooftopKC sees no results (correct!)
- Each venue is isolated

**After migration (without backfill)**:
- Existing events have `location_id = NULL`
- RooftopKC filters for `location_id = <rooftopkc-id>`
- NULL records don't match either location
- Both venues see nothing (half-broken state)
- Need code change to show NULL records for all locations (not recommended)

### Recommendation

**Backfill is strongly recommended** because:
1. Fixes the reported issue immediately
2. Clean data model (no NULL handling needed)
3. Assumption is safe (all pre-existing data was Noir KC's)
4. Future-proof for multi-location support

---

## Verification Queries

Run these after migration:

```sql
-- 1. Check schema
\d venue_hours

-- 2. Distribution by location
SELECT
  COALESCE(l.name, 'UNASSIGNED (NULL)') as location,
  vh.type,
  COUNT(*) as count
FROM venue_hours vh
LEFT JOIN locations l ON l.id = vh.location_id
GROUP BY l.name, vh.type
ORDER BY location, vh.type;

-- 3. Test location filtering (Noir KC)
SELECT id, type, date, location_id
FROM venue_hours
WHERE location_id = (SELECT id FROM locations WHERE slug = 'noirkc')
ORDER BY date DESC
LIMIT 5;

-- 4. Test location filtering (RooftopKC)
SELECT id, type, date, location_id
FROM venue_hours
WHERE location_id = (SELECT id FROM locations WHERE slug = 'rooftopkc')
ORDER BY date DESC
LIMIT 5;

-- 5. Find any NULL location_id records
SELECT COUNT(*) as null_count FROM venue_hours WHERE location_id IS NULL;

-- 6. Verify indexes exist
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'venue_hours'
AND indexname LIKE '%location%';
```

---

**Migration Ready for Tim's Review** ✅

**CRITICAL DECISION NEEDED**: Uncomment STEP 2 in SQL to backfill (recommended) or leave commented to keep NULL.
