# Migration: Add location_id to private_events

**Date**: 2026-04-18
**Author**: AI Migration Generator
**Status**: ⏳ Pending Application

---

## Description

This migration adds location-specific support to the `private_events` table, making each private event associated with a specific venue location (Noir KC, RooftopKC, etc.). This prevents cross-venue conflicts where a private event at Noir KC would incorrectly block reservations at RooftopKC.

**Business Problem Solved**:
- Private events are currently global and affect all locations
- A private event at Noir KC blocks calendar availability at RooftopKC
- This migration scopes events per location for proper multi-venue management

---

## Tables Affected

- `private_events` - **Modified** (adds `location_id` column, FK constraint, indexes)
- `locations` - **Referenced** (FK target)

---

## Breaking Changes

**NO** - But new API behavior:

- ✅ Existing code continues to work
- ✅ All existing events backfilled with Noir KC location
- ⚠️ New private event creation **requires** `location_id` parameter
- ⚠️ Code already updated to pass `location_id` (changes already made)

---

## Prerequisites

- [x] Code changes already applied to handle `location_id`:
  - `CalendarAvailabilityControl.tsx` - passes `location_id` in INSERT
  - `src/app/api/private-events/route.ts` - requires and validates `location_id`
  - `event-calendar.tsx` - uses API with location filtering support
- [ ] **Backup database** before applying migration
- [ ] Verify Noir KC location exists (`SELECT * FROM locations WHERE slug = 'noirkc'`)

---

## Migration Steps

### Apply Migration

1. **Backup database**
   ```bash
   # In Supabase Dashboard:
   # Settings → Database → Backup → Create backup
   ```

2. **Verify prerequisites**
   ```sql
   -- Ensure Noir KC location exists
   SELECT id, name, slug FROM locations WHERE slug = 'noirkc';
   -- Should return Noir KC location record

   -- Check current private events count
   SELECT COUNT(*) FROM private_events;
   ```

3. **Apply migration in Supabase SQL Editor**
   - Open Supabase Dashboard → SQL Editor
   - Copy contents of `20260418_add_location_id_to_private_events.sql`
   - Paste into SQL Editor
   - Click **Run**
   - Review output for any errors

4. **Verify migration succeeded**

   The migration includes verification queries. Check output shows:
   ```
   ✓ Column added: location_id UUID NOT NULL
   ✓ Foreign key: fk_private_events_location_id → locations(id)
   ✓ Indexes created: idx_private_events_location_id, idx_private_events_location_start_time
   ✓ All events have location_id (events_without_location = 0)
   ✓ Distribution shows events assigned to Noir KC
   ```

5. **Test application**
   - Go to Settings → Noir KC → Custom Closed Days
   - Create a test private event (closed day)
   - Verify it appears in Noir KC tab but NOT in RooftopKC tab
   - Go to Settings → RooftopKC → Custom Closed Days
   - Create a test private event
   - Verify it appears in RooftopKC tab but NOT in Noir KC tab

---

### Rollback Migration

**Only if migration fails or needs reversal**

⚠️ **WARNING**: Rollback will remove location associations. All private events will become global again.

1. **Apply rollback script**
   - Copy contents of `20260418_add_location_id_to_private_events_ROLLBACK.sql`
   - Paste into SQL Editor
   - Execute

2. **Verify rollback**
   ```sql
   SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'private_events' AND column_name = 'location_id';
   -- Expected: 0 (column removed)
   ```

3. **Revert code changes** (if rolling back permanently)
   - Revert `CalendarAvailabilityControl.tsx` changes
   - Revert `src/app/api/private-events/route.ts` changes
   - Revert `event-calendar.tsx` changes

---

## Testing Checklist

After applying migration:

### Schema Validation
- [ ] `location_id` column exists with type `UUID`
- [ ] `location_id` is `NOT NULL`
- [ ] Foreign key `fk_private_events_location_id` points to `locations(id)`
- [ ] ON DELETE RESTRICT prevents location deletion if events exist
- [ ] Indexes created: `idx_private_events_location_id`, `idx_private_events_location_start_time`

### Data Validation
- [ ] All existing private events have `location_id` set
- [ ] All existing events assigned to Noir KC (verify with distribution query)
- [ ] No NULL `location_id` values exist

### Application Testing
- [ ] **Noir KC Settings Tab**:
  - [ ] Can create custom closed day (private event)
  - [ ] Event appears in Noir KC closed days list
  - [ ] Event does NOT appear in RooftopKC list

- [ ] **RooftopKC Settings Tab**:
  - [ ] Can create custom closed day (private event)
  - [ ] Event appears in RooftopKC closed days list
  - [ ] Event does NOT appear in Noir KC list

- [ ] **Event Calendar Page**:
  - [ ] Private events load without errors
  - [ ] Future: Add location filter dropdown (TODO in code)

- [ ] **Private Events Manager**:
  - [ ] Can create new private event with location selection
  - [ ] Event creation requires location_id
  - [ ] No console errors

### Performance
- [ ] Query performance acceptable (indexes being used)
  ```sql
  EXPLAIN ANALYZE
  SELECT * FROM private_events
  WHERE location_id = '<some-uuid>'
  AND start_time >= NOW()
  ORDER BY start_time;
  -- Should show "Index Scan using idx_private_events_location_start_time"
  ```

---

## Code Changes Required

✅ **Already completed** (changes made before migration):

| File | Change | Status |
|------|--------|--------|
| `src/components/CalendarAvailabilityControl.tsx` | Add `location_id` to INSERT, validate locationId present | ✅ Done |
| `src/app/api/private-events/route.ts` | Require `location_id` in POST, add to INSERT | ✅ Done |
| `src/pages/admin/event-calendar.tsx` | Use API endpoint with location filtering | ✅ Done |
| `HOWTO.md` | Document `location_id` in schema | ⏳ Pending |

---

## Rollback Plan

**Complexity**: 🟢 EASY

**Data Loss Risk**: NO (column removal doesn't delete event records, only location associations)

**Steps**:
1. Run `20260418_add_location_id_to_private_events_ROLLBACK.sql`
2. Revert code changes (or leave them - code will handle missing column gracefully)

**Recovery**:
- Re-apply forward migration to restore location associations
- All events will be re-backfilled to Noir KC

---

## Performance Impact

**Before Migration**:
- Private events queries: `SELECT * FROM private_events` (full table scan)

**After Migration**:
- Location-filtered queries use index: `idx_private_events_location_id`
- Date range + location queries use composite index: `idx_private_events_location_start_time`
- **Expected Performance**: ✅ Improved (faster queries with indexes)

---

## Security Considerations

- Foreign key uses `ON DELETE RESTRICT` - prevents accidental location deletion if events exist
- RLS policies (if any) on `private_events` remain unchanged
- Location-based filtering already enforced at application layer via locationSlug prop

---

## Notes

- **Future Enhancement**: Support multi-location events (one event at multiple venues)
  - Would require junction table: `private_event_locations`
  - Current implementation: one event = one location (simpler, sufficient for now)

- **Backfill Logic**: All existing events assigned to Noir KC
  - Assumption: Historical data pre-dates multi-location support
  - If this is incorrect, manual data correction may be needed

- **NULL Handling**: Migration validates NO NULL values after backfill
  - If backfill fails, migration will RAISE EXCEPTION and rollback
  - This prevents partial migration state

---

## Verification Queries

Run these after migration:

```sql
-- 1. Check schema
\d private_events

-- 2. Verify all events have location
SELECT COUNT(*) as total,
       COUNT(location_id) as with_location,
       COUNT(*) - COUNT(location_id) as without_location
FROM private_events;

-- 3. Distribution by location
SELECT l.name, l.slug, COUNT(pe.id) as events
FROM locations l
LEFT JOIN private_events pe ON pe.location_id = l.id
GROUP BY l.id, l.name, l.slug;

-- 4. Test location filtering
SELECT id, title, start_time, location_id
FROM private_events
WHERE location_id = (SELECT id FROM locations WHERE slug = 'noirkc')
ORDER BY start_time DESC
LIMIT 5;

-- 5. Verify indexes exist
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'private_events'
AND indexname LIKE '%location%';
```

---

**Migration Ready for Tim's Review** ✅

Next Steps:
1. Tim reviews this README
2. Tim applies migration in Supabase
3. Tim tests using checklist above
4. Tim updates HOWTO.md with new schema
