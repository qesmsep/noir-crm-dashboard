# Migration: Update RooftopKC Tables

**Date**: 2026-04-23
**Author**: AI Migration Generator
**Status**: Pending

---

## Description

This migration updates the table configuration for RooftopKC to reflect the new floor plan with 24 tables. It performs two operations:

1. **Updates seating capacity** for existing tables 1-17 to match new layout
2. **Adds 7 new tables** (18-24) with their respective seating capacities

This change expands RooftopKC's total capacity from 66 seats (17 tables) to 88 seats (24 tables).

**Business Impact**: Allows RooftopKC to accept more reservations and serve more customers simultaneously.

---

## Tables Affected

- `tables` - Modified (17 rows updated, 7 rows inserted)
- `locations` - Read only (to get RooftopKC location_id)

**Other Locations**: Noir KC tables remain completely untouched (20 tables unchanged).

---

## Breaking Changes

**NO** - This migration does not introduce breaking changes.

- All existing API routes use `seats` column correctly
- Reservation system will automatically recognize new tables
- No code changes required for migration to work

---

## Prerequisites

- [x] Schema Scout analysis completed (✅ Low risk)
- [ ] **Backup database before applying** (recommended but not critical - low data loss risk)
- [ ] Verify no active reservations on tables 11-17 during migration window
- [ ] Review affected components (calendar views will show new tables automatically)

---

## New Table Configuration

### Updated Seating (Tables 1-17)

| Table # | Old Seats | New Seats | Change |
|---------|-----------|-----------|--------|
| 1-6     | 2         | 2         | No change |
| 7       | 6         | 2         | -4 |
| 8       | 6         | 2         | -4 |
| 9       | 6         | 2         | -4 |
| 10      | 4         | 6         | +2 |
| 11      | 10        | 4         | -6 |
| 12      | 2         | 4         | +2 |
| 13      | 2         | 6         | +4 |
| 14      | 4         | 6         | +2 |
| 15      | 6         | 4         | -2 |
| 16      | 4         | 4         | No change |
| 17      | 4         | 10        | +6 |

### New Tables (18-24)

| Table # | Seats |
|---------|-------|
| 18      | 2     |
| 19      | 4     |
| 20      | 4     |
| 21      | 6     |
| 22      | 4     |
| 23      | 2     |
| 24      | 4     |

**Total Capacity Change**: 66 → 88 seats (+22 seats, +33% capacity)

---

## Migration Steps

### Apply Migration

1. **Backup database** (recommended)
   ```bash
   # In Supabase Dashboard: Settings > Database > Create Backup
   # Or use pg_dump if self-hosted
   ```

2. **Apply migration**
   ```bash
   # Using psql with DATABASE_URL from .env.local
   psql "$DATABASE_URL" -f supabase/migrations/20260423000000_update_rooftopkc_tables.sql
   ```

3. **Verify migration**
   - Check output shows 24 tables for RooftopKC
   - Verify total seats = 88
   - Verify Noir KC unchanged (20 tables)

---

### Rollback Migration

**Only if migration fails or needs reversal**

⚠️ **WARNING**: Rollback will DELETE tables 18-24 and any reservations on them (CASCADE delete)!

1. **Apply rollback script**
   ```bash
   psql "$DATABASE_URL" -f supabase/migrations/20260423000000_update_rooftopkc_tables_ROLLBACK.sql
   ```

2. **Verify rollback**
   - Check RooftopKC has 17 tables
   - Verify total seats = 66
   - Verify original seating capacities restored

3. **Check for orphaned reservations** (if any existed on tables 18-24)

---

## Testing Checklist

After applying migration:

### Database Validation
- [ ] RooftopKC has exactly 24 tables
- [ ] Total RooftopKC seats = 88
- [ ] Noir KC still has 20 tables (unchanged)
- [ ] All table numbers 1-24 exist for RooftopKC
- [ ] Unique constraint `(location_id, table_number)` intact

### Application Testing
- [ ] `/api/tables?location=rooftopkc` returns 24 tables
- [ ] `/api/tables?location=noirkc` returns 20 tables (unchanged)
- [ ] Reservation form shows 24 tables for RooftopKC
- [ ] Reservation calendar displays all 24 tables
- [ ] Can create test reservation on new table #24
- [ ] Existing reservations on tables 1-17 still work

### UI Testing
- [ ] Admin reservation calendar shows correct table count
- [ ] Table selector shows 24 options for RooftopKC
- [ ] No console errors in browser
- [ ] Mobile view displays correctly

---

## Code Changes Required

### Immediate (Required for Tim's Request)

| File | Change Required | Priority |
|------|-----------------|----------|
| `src/components/FullCalendarTimeline.tsx` | Add `seats` to SELECT query and display as "Table X (Y)" format | **HIGH** |
| `src/components/ReservationsTimeline.tsx` | Add `seats` to SELECT query and display with table number | **HIGH** |

### Optional (Type Safety & Documentation)

| File | Change Required | Priority |
|------|-----------------|----------|
| `src/types/index.ts` | Fix Table interface: use `seats` instead of `capacity`, remove non-existent `status` field | LOW |
| `HOWTO.md` | Update tables schema docs: remove `status` column | LOW |

---

## Rollback Plan

**Complexity**: EASY

**Data Loss Risk**: YES - If reservations exist on tables 18-24, they will be CASCADE deleted

**Recommended Approach**:
1. Check for reservations on tables 18-24 before rollback
2. If reservations exist, manually migrate them to other tables first
3. Then apply rollback script

**Rollback File**: `20260423000000_update_rooftopkc_tables_ROLLBACK.sql`

---

## Notes

- Migration uses `ON CONFLICT` to be idempotent (can be run multiple times safely)
- Uses DO blocks to get `location_id` dynamically (no hardcoded UUIDs)
- Only affects RooftopKC - Noir KC completely untouched
- All queries filtered by `location_id = rooftopkc` for safety
- Table IDs are auto-generated by existing `trg_tables_set_id` trigger
- Timestamps auto-managed by existing `trg_tables_updated_at` trigger

---

## Verification Queries

```sql
-- Check RooftopKC table count and capacity
SELECT
    l.name,
    COUNT(t.id) as table_count,
    SUM(t.seats) as total_seats
FROM locations l
LEFT JOIN tables t ON t.location_id = l.id
WHERE l.slug = 'rooftopkc'
GROUP BY l.name;
-- Expected: 24 tables, 88 seats

-- List all RooftopKC tables with seats
SELECT table_number, seats
FROM tables t
JOIN locations l ON t.location_id = l.id
WHERE l.slug = 'rooftopkc'
ORDER BY table_number;
-- Expected: 24 rows (tables 1-24)

-- Verify Noir KC unchanged
SELECT COUNT(*) as noir_table_count
FROM tables t
JOIN locations l ON t.location_id = l.id
WHERE l.slug = 'noirkc';
-- Expected: 20

-- Check for any reservations on new tables 18-24
SELECT COUNT(*) as reservations_on_new_tables
FROM reservations r
JOIN tables t ON r.table_id = t.id
JOIN locations l ON t.location_id = l.id
WHERE l.slug = 'rooftopkc'
  AND t.table_number BETWEEN 18 AND 24;
-- Should be 0 immediately after migration
```

---
