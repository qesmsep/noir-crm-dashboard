# Migration: Add location_id to venue_hours

**Date**: 2026-04-18
**Author**: AI Migration Generator
**Status**: Pending

---

## Description

This migration adds a `location_id` column to the `venue_hours` table to enable location-specific operating hours, exceptional opens, and exceptional closures. Previously, all venue hours applied globally to both Noir KC and RooftopKC. Now each location can have independent:

- Base operating hours (e.g., Noir KC open Thu-Sat, RooftopKC open Fri-Sat)
- Exceptional open days (e.g., special holiday hours for one location)
- Exceptional closures (e.g., Noir KC closed on 4/24/2026 for RooftopKC grand opening)

**Business Problem Solved**: Enables multi-location operations with independent hours and closures.

---

## Tables Affected

- `venue_hours` - Modified (column added: `location_id`)
- `locations` - Referenced (foreign key target)

---

## Breaking Changes

**NO**

Adding a nullable column is backwards compatible. Existing queries will continue to work:
- Existing `venue_hours` records will have `NULL` for `location_id`
- New code filters by `location_id` when provided
- Legacy code without location filtering still works (returns all records)

---

## Prerequisites

- [x] Schema Scout analysis completed
- [x] Backup database before applying (recommended)
- [x] Code changes already implemented in:
  - `CalendarAvailabilityControl.tsx` - saves/filters by location
  - `ReservationsTimeline.tsx` - filters closures by location
  - `check-date-availability.ts` - filters by location
  - `available-slots/route.ts` - filters by location
- [x] Verify `locations` table has entries for 'noirkc' and 'rooftopkc'

---

## Migration Steps

### Apply Migration

1. **Verify prerequisites**
   ```sql
   -- Check locations exist
   SELECT id, slug, name FROM public.locations WHERE slug IN ('noirkc', 'rooftopkc');
   -- Expected: 2 rows

   -- Check existing RooftopKC Grand Opening closure exists
   SELECT * FROM public.venue_hours
   WHERE reason = 'RooftopKC Grand Opening'
     AND date = '2026-04-24'
     AND type = 'exceptional_closure';
   -- Expected: 1 row
   ```

2. **Backup database** (optional but recommended)
   - In Supabase Dashboard → Settings → Database → Create Backup
   - Or use `pg_dump` if self-hosted

3. **Apply migration in Supabase SQL Editor**
   - Open Supabase Dashboard → SQL Editor
   - Copy contents of `20260418184127_add_location_to_venue_hours.sql`
   - Paste and execute

4. **Verify migration**
   ```sql
   -- Check column was added
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_name = 'venue_hours' AND column_name = 'location_id';
   -- Expected: location_id | uuid | YES

   -- Check indexes were created
   SELECT indexname FROM pg_indexes
   WHERE tablename = 'venue_hours' AND indexname LIKE '%location%';
   -- Expected: 2 rows

   -- Verify data migration
   SELECT id, date, reason, location_id
   FROM public.venue_hours
   WHERE reason = 'RooftopKC Grand Opening';
   -- Expected: location_id should be Noir KC's UUID
   ```

---

### Rollback Migration

**Only if migration fails or needs reversal**

1. **Apply rollback script**
   - Open Supabase Dashboard → SQL Editor
   - Copy contents of `20260418184127_add_location_to_venue_hours_ROLLBACK.sql`
   - Paste and execute

2. **Verify rollback**
   ```sql
   -- Check column removed
   SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'venue_hours' AND column_name = 'location_id';
   -- Expected: 0

   -- Check indexes removed
   SELECT COUNT(*) FROM pg_indexes
   WHERE tablename = 'venue_hours' AND indexname LIKE '%location%';
   -- Expected: 0
   ```

---

## Testing Checklist

After applying migration:

### Schema Validation
- [ ] Column `location_id` exists with type UUID
- [ ] Column is nullable (allows NULL values)
- [ ] Foreign key references `locations(id)` with ON DELETE CASCADE
- [ ] Index `idx_venue_hours_location_id` created
- [ ] Index `idx_venue_hours_type_date_location` created

### Data Validation
- [ ] Existing "RooftopKC Grand Opening" closure updated with Noir KC location_id
- [ ] Other existing `venue_hours` records have NULL location_id (expected)

### Application Testing

**Admin Settings Page** (`/admin/settings`)
- [ ] Navigate to Noir KC tab → Custom Closed Days
- [ ] Create a test closure (e.g., "Test Noir KC Closure" on a future date)
- [ ] Verify it saves with `location_id` for Noir KC
- [ ] Navigate to RooftopKC tab → Custom Closed Days
- [ ] Create a test closure (e.g., "Test RooftopKC Closure" on a different date)
- [ ] Verify it saves with `location_id` for RooftopKC
- [ ] Verify Noir KC closures don't appear in RooftopKC list and vice versa

**Admin Reservation Calendar** (`/admin/reservations`)
- [ ] Switch to Noir KC location
- [ ] Navigate to 4/24/2026
- [ ] Verify "RooftopKC Grand Opening" closure appears as gray blocking event
- [ ] Switch to RooftopKC location
- [ ] Navigate to 4/24/2026
- [ ] Verify NO closure appears (RooftopKC is open on that day)

**Member Reservation Flow** (`/member/dashboard`)
- [ ] As Noir KC member, try to make reservation for 4/24/2026
- [ ] Verify no time slots available (date is blocked)
- [ ] Try a different date - verify time slots appear normally

**API Testing**
- [ ] Test `/api/check-date-availability?date=2026-04-24&location=noirkc`
  - Should return blockedTimeRanges for full day
- [ ] Test `/api/check-date-availability?date=2026-04-24&location=rooftopkc`
  - Should return empty blockedTimeRanges (not blocked)

### Performance
- [ ] Query with location filter uses index (check with EXPLAIN ANALYZE)
  ```sql
  EXPLAIN ANALYZE
  SELECT * FROM venue_hours
  WHERE type = 'exceptional_closure'
    AND date = '2026-04-24'
    AND location_id = '<noirkc-uuid>';
  -- Should show "Index Scan using idx_venue_hours_type_date_location"
  ```

---

## Code Changes Required

All code changes have been **completed** in advance:

| File | Change Required | Status |
|------|-----------------|--------|
| `CalendarAvailabilityControl.tsx` | Accept locationSlug prop, save location_id | ✅ DONE |
| `ReservationsTimeline.tsx` | Filter closures by location | ✅ DONE |
| `check-date-availability.ts` | Accept location param, filter by location_id | ✅ DONE |
| `available-slots/route.ts` | Accept location param, filter by location_id | ✅ DONE |
| `SimpleReservationRequestModal.tsx` | Pass location to API | ✅ DONE |
| `admin/settings.tsx` | Pass locationSlug to CalendarAvailabilityControl | ✅ DONE |

**No additional code changes required after migration.**

---

## Rollback Plan

**Complexity**: EASY

**Data Loss Risk**: NO
- Rolling back only removes the `location_id` column
- All `venue_hours` records remain intact
- Location-specific filtering will stop working, but data is preserved
- Can re-apply forward migration to restore functionality

**Steps**: Execute `20260418184127_add_location_to_venue_hours_ROLLBACK.sql`

---

## Notes

### Important Context

The "RooftopKC Grand Opening" closure is intentionally assigned to **Noir KC** (not RooftopKC). This is because:
- On April 24, 2026, RooftopKC is having its grand opening event
- Noir KC staff and members will be attending the RooftopKC grand opening
- Therefore, Noir KC needs to be closed that day
- RooftopKC will be open (hosting the grand opening)

### Future Closures

When creating new closures:
- Closures created in "Noir KC Settings" → automatically get Noir KC location_id
- Closures created in "RooftopKC Settings" → automatically get RooftopKC location_id
- Each location's closures only block that specific location's reservations

### NULL location_id Handling

Records with `NULL` location_id represent legacy data from before multi-location support. These can be:
- Ignored (if no longer needed)
- Updated manually to assign to a specific location
- Left as-is (will be filtered out by new location-specific queries)

---

## Verification Queries

```sql
-- Count venue_hours by location
SELECT
  COALESCE(l.name, 'No Location') as location_name,
  vh.type,
  COUNT(*) as count
FROM venue_hours vh
LEFT JOIN locations l ON vh.location_id = l.id
GROUP BY l.name, vh.type
ORDER BY l.name, vh.type;

-- Show all closures with their locations
SELECT
  vh.date,
  vh.reason,
  COALESCE(l.name, 'Global') as location,
  vh.full_day
FROM venue_hours vh
LEFT JOIN locations l ON vh.location_id = l.id
WHERE vh.type = 'exceptional_closure'
ORDER BY vh.date;

-- Verify RooftopKC Grand Opening is assigned to Noir KC
SELECT
  vh.date,
  vh.reason,
  l.name as blocks_location,
  l.slug as location_slug
FROM venue_hours vh
JOIN locations l ON vh.location_id = l.id
WHERE vh.reason = 'RooftopKC Grand Opening';
-- Expected: blocks_location = 'Noir KC', location_slug = 'noirkc'
```

---
