# Migration: Add Booking Windows to Locations

**Date**: 2026-04-18
**Author**: AI Migration Generator
**Status**: ⏳ Pending Application

---

## Description

This migration adds location-specific booking window columns to the `locations` table, enabling each venue (Noir KC, RooftopKC, etc.) to have independent booking availability windows. This solves the issue where updating RooftopKC's booking window was incorrectly affecting Noir KC reservations (and vice versa).

**Business Problem Solved**:
- Global `settings.booking_start_date` and `booking_end_date` apply to ALL locations
- RooftopKC may want different availability (e.g., seasonal rooftop, weather-dependent)
- Each location can now set independent booking windows or fall back to global settings

**Implementation**:
- New columns: `locations.booking_start_date`, `locations.booking_end_date` (both nullable DATE)
- If NULL → use global `settings.booking_start_date` / `settings.booking_end_date`
- If set → use location-specific values

---

## Tables Affected

- `locations` - **Modified** (adds 2 nullable DATE columns)

---

## Breaking Changes

**NO** - Zero breaking changes

**Behavior**:
- ✅ Existing code continues to work (columns are nullable)
- ✅ All locations start with NULL → use global settings (current behavior)
- ✅ Application code will need updates to use location-specific values (see below)

---

## Prerequisites

- [ ] **Backup database** before applying
- [ ] Verify global settings exist: `SELECT booking_start_date, booking_end_date FROM settings LIMIT 1;`

---

## Migration Steps

### Apply Migration

1. **Backup database**
   ```bash
   # In Supabase Dashboard:
   # Settings → Database → Backup → Create backup
   ```

2. **Apply migration in Supabase SQL Editor**
   - Open Supabase Dashboard → SQL Editor
   - Copy contents of `20260418_add_booking_windows_to_locations.sql`
   - Paste into SQL Editor
   - Click **Run**
   - Review output for any errors

3. **Verify migration succeeded**

   The migration includes verification queries. Check output shows:
   ```
   ✓ booking_start_date: DATE, nullable, no default
   ✓ booking_end_date: DATE, nullable, no default
   ✓ All locations show NULL for new columns (will use global fallback)
   ```

4. **Set location-specific booking windows (optional)**

   ```sql
   -- Set RooftopKC to different booking window
   UPDATE locations
   SET
     booking_start_date = CURRENT_DATE,
     booking_end_date = CURRENT_DATE + INTERVAL '30 days'
   WHERE slug = 'rooftopkc';

   -- Noir KC continues using global settings (NULL)
   -- No update needed for Noir KC
   ```

5. **Test application** (after code updates deployed)
   - Go to Member Portal → Make Reservation
   - Select RooftopKC table → verify booking window matches RooftopKC settings
   - Select Noir KC table → verify booking window matches global settings

---

## Testing Checklist

### Schema Validation
- [ ] `booking_start_date` column exists with type `DATE`
- [ ] `booking_end_date` column exists with type `DATE`
- [ ] Both columns are nullable
- [ ] All existing locations have NULL values (default)

### Data Validation
- [ ] Query shows correct fallback logic:
  ```sql
  SELECT
    name,
    booking_start_date,
    booking_end_date,
    COALESCE(booking_start_date, (SELECT booking_start_date FROM settings LIMIT 1)) as effective_start,
    COALESCE(booking_end_date, (SELECT booking_end_date FROM settings LIMIT 1)) as effective_end
  FROM locations
  WHERE status = 'active';
  ```

### Application Testing (after code updates)
- [ ] **Admin Settings**: Can set booking window per location
- [ ] **Member Portal Reservations**:
  - [ ] RooftopKC uses location-specific window (if set)
  - [ ] Noir KC uses global window (if NULL)
  - [ ] Cannot book outside effective window
- [ ] **No errors** in browser console

---

## Code Changes Required

**REQUIRED** (application won't use new columns until these are deployed):

| File | Change Required | Priority |
|------|-----------------|----------|
| `src/context/SettingsContext.tsx` | Fetch location-specific booking windows alongside global settings | **HIGH** |
| `src/components/CalendarAvailabilityControl.tsx` | Save booking window to `locations` table (not `settings`) when `locationSlug` provided | **HIGH** |
| `src/components/ReservationForm.tsx` | Use location-specific booking window (fetch from table's location) | **HIGH** |
| `src/pages/admin/settings.tsx` | Show booking window inputs in Noir KC / RooftopKC tabs (location-specific) | **MEDIUM** |
| `HOWTO.md` | Document `booking_start_date`, `booking_end_date` in locations schema | **LOW** |

---

## Rollback Plan

**Complexity**: 🟢 EASY

**Data Loss Risk**: YES - Location-specific booking window data will be lost (can be manually re-entered)

**Steps**:
1. Run `20260418_add_booking_windows_to_locations_ROLLBACK.sql`
2. Verify columns removed
3. Revert code changes (or leave them - code will gracefully fall back to global settings)

**Recovery**:
- Re-apply forward migration
- Manually re-enter location-specific booking windows via SQL or admin UI

---

## Usage Examples

### Query Effective Booking Window for a Location

```sql
-- Get effective booking window for RooftopKC
SELECT
  l.name,
  COALESCE(l.booking_start_date, s.booking_start_date) as start_date,
  COALESCE(l.booking_end_date, s.booking_end_date) as end_date
FROM locations l
CROSS JOIN settings s
WHERE l.slug = 'rooftopkc';
```

### Set Location-Specific Window

```sql
-- RooftopKC: 30-day rolling window
UPDATE locations
SET
  booking_start_date = CURRENT_DATE,
  booking_end_date = CURRENT_DATE + INTERVAL '30 days'
WHERE slug = 'rooftopkc';

-- Noir KC: Use global settings (60-day window from settings table)
UPDATE locations
SET
  booking_start_date = NULL,
  booking_end_date = NULL
WHERE slug = 'noirkc';
```

### Admin UI Integration (TypeScript)

```typescript
// Fetch booking window for specific location
const getBookingWindow = async (locationSlug: string) => {
  const { data } = await supabase
    .from('locations')
    .select(`
      booking_start_date,
      booking_end_date,
      settings!inner(booking_start_date, booking_end_date)
    `)
    .eq('slug', locationSlug)
    .single();

  return {
    startDate: data.booking_start_date || data.settings.booking_start_date,
    endDate: data.booking_end_date || data.settings.booking_end_date,
  };
};
```

---

## Verification Queries

Run these after migration:

```sql
-- 1. Check schema
\d locations

-- 2. Verify columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'locations'
AND column_name LIKE 'booking_%';

-- 3. Show all locations with effective booking windows
SELECT
  l.name,
  l.slug,
  l.booking_start_date as location_start,
  l.booking_end_date as location_end,
  s.booking_start_date as global_start,
  s.booking_end_date as global_end,
  COALESCE(l.booking_start_date, s.booking_start_date) as effective_start,
  COALESCE(l.booking_end_date, s.booking_end_date) as effective_end
FROM locations l
CROSS JOIN settings s
WHERE l.status = 'active';

-- 4. Test NULL fallback behavior
SELECT
  'Test' as scenario,
  COALESCE(NULL::date, CURRENT_DATE) as result;
-- Expected: Shows CURRENT_DATE (fallback works)
```

---

**Migration Ready for Tim's Review** ✅

**Next Steps**:
1. Tim applies migration in Supabase
2. Tim verifies schema changes
3. Deploy code updates to use location-specific booking windows
4. Test in production with both locations
