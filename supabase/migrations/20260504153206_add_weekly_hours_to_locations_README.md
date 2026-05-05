# Migration: Add weekly_hours to locations

**Date**: 2026-05-04
**Author**: AI Migration Generator
**Status**: Pending

---

## Description

Adds a `weekly_hours` JSONB column to the `locations` table to store week-specific operating hours for each venue (Noir KC, RooftopKC). This enables venue managers to set different hours on a week-by-week basis through the admin UI, accommodating:

- Weather variability (Midwest weather changes)
- Special events or closures
- Seasonal hour adjustments
- Per-location customization

The system will display the current week's hours on the landing pages and fall back to global `settings.operating_hours` if no week-specific hours are set.

**Business Problem Solved**: Previously, hours were either hardcoded or stored globally in settings. With this change, RooftopKC can have different hours than Noir KC, and hours can be updated weekly without code deployments.

---

## Tables Affected

- `locations` - Modified (weekly_hours column added)

---

## Breaking Changes

**NO**

- Column is nullable, so existing rows are not affected
- All existing queries use explicit column selection (no SELECT *)
- RLS policies automatically apply to new column
- No code changes required before migration

---

## Prerequisites

- [x] Schema Scout analysis completed (LOW RISK)
- [ ] Backup database before applying
- [ ] Review migration SQL
- [ ] Plan post-migration code updates

---

## Migration Steps

### Apply Migration

1. **Backup database**
   ```bash
   # In Supabase Dashboard:
   # Settings → Database → Create Backup
   ```

2. **Apply migration in Supabase SQL Editor**
   - Navigate to SQL Editor in Supabase Dashboard
   - Copy contents of `20260504153206_add_weekly_hours_to_locations.sql`
   - Paste into SQL Editor
   - Execute

3. **Verify migration**
   ```sql
   -- Check column exists
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_name = 'locations' AND column_name = 'weekly_hours';
   -- Expected: weekly_hours | jsonb | YES

   -- Check index created
   SELECT indexname FROM pg_indexes WHERE tablename = 'locations' AND indexname LIKE '%weekly_hours%';
   -- Expected: idx_locations_weekly_hours_gin

   -- Verify existing data intact
   SELECT id, name, slug, weekly_hours FROM locations;
   -- Expected: Both locations with weekly_hours = null
   ```

4. **Test data insertion** (optional)
   ```sql
   -- Test setting weekly hours for RooftopKC
   UPDATE locations
   SET weekly_hours = '{
     "2026-05-05": {
       "sunday": null,
       "monday": null,
       "tuesday": null,
       "wednesday": null,
       "thursday": { "open": "16:00", "close": "22:00" },
       "friday": { "open": "18:00", "close": "00:00" },
       "saturday": { "open": "18:00", "close": "00:00" }
     }
   }'::jsonb
   WHERE slug = 'rooftopkc';

   -- Verify query works
   SELECT name, weekly_hours->'2026-05-05' as current_week_hours
   FROM locations
   WHERE slug = 'rooftopkc';
   ```

---

### Rollback Migration

**Only if migration fails or needs reversal**

⚠️ **WARNING**: Rollback will delete all data in the `weekly_hours` column!

1. **Apply rollback script**
   - Copy contents of `20260504153206_add_weekly_hours_to_locations_ROLLBACK.sql`
   - Paste into SQL Editor
   - Execute

2. **Verify rollback**
   ```sql
   -- Check column removed
   SELECT COUNT(*) as column_exists
   FROM information_schema.columns
   WHERE table_name = 'locations' AND column_name = 'weekly_hours';
   -- Expected: 0

   -- Verify table still functional
   SELECT id, name, slug, status FROM locations;
   ```

3. **Restore weekly_hours data from backup if needed**

---

## Testing Checklist

After applying migration:

**Schema Validation**
- [ ] Column exists with JSONB data type
- [ ] Column is nullable
- [ ] GIN index created successfully
- [ ] Existing locations rows unchanged (weekly_hours = null)

**Policy Validation**
- [ ] Public can SELECT weekly_hours for active locations
- [ ] Service role can UPDATE weekly_hours
- [ ] RLS policies still work correctly

**Application Testing**
- [ ] API routes still load locations data
- [ ] Admin settings page loads without errors
- [ ] Landing pages load without errors
- [ ] No console errors in browser

**Performance**
- [ ] Queries on locations table remain fast
- [ ] JSONB queries use GIN index (check with EXPLAIN ANALYZE if needed)

---

## Code Changes Required

Post-migration code updates:

| File | Change Required | Priority |
|------|-----------------|----------|
| src/pages/admin/settings.tsx | Add weekly hours UI for each location tab | HIGH |
| src/app/rooftopkc/page.js | Display weekly_hours for current week | HIGH |
| src/types/index.ts | (Optional) Add weekly_hours to Location interface | LOW |
| HOWTO.md | Document weekly_hours in database schema section | MEDIUM |

---

## Weekly Hours Data Structure

```typescript
// TypeScript interface (add to src/types/index.ts)
interface WeeklyHours {
  /**
   * Week key format: YYYY-MM-DD
   * MUST be a Monday date calculated in the location's timezone.
   * Use getMondayOfWeek(date, location.timezone) to generate keys.
   */
  [weekStartMonday: string]: {
    sunday?: { open: string; close: string } | null;
    monday?: { open: string; close: string } | null;
    tuesday?: { open: string; close: string } | null;
    wednesday?: { open: string; close: string } | null;
    thursday?: { open: string; close: string } | null;
    friday?: { open: string; close: string } | null;
    saturday?: { open: string; close: string } | null;
  };
}
```

**Example**:
```json
{
  "2026-05-05": {
    "sunday": null,
    "monday": null,
    "tuesday": null,
    "wednesday": null,
    "thursday": { "open": "16:00", "close": "22:00" },
    "friday": { "open": "18:00", "close": "00:00" },
    "saturday": { "open": "18:00", "close": "00:00" }
  },
  "2026-05-12": {
    "thursday": { "open": "17:00", "close": "23:00" },
    "friday": { "open": "18:00", "close": "01:00" },
    "saturday": { "open": "18:00", "close": "01:00" }
  }
}
```

---

## ⚠️ CRITICAL: Timezone Handling

**The Noir CRM operates in America/Chicago timezone. All week keys MUST be calculated in the location's timezone.**

### Why Timezone Matters

**Scenario**: It's Sunday 11:30 PM in Chicago (America/Chicago timezone)
- **UTC time**: Monday 5:30 AM (next day in UTC!)
- **Location timezone**: Sunday 11:30 PM

**If you use UTC**: You'll get Monday's date (2026-05-12), which is the NEXT week's Monday
**If you use location timezone**: You'll get this week's Monday (2026-05-05), which is correct

**Result**: Using UTC will show next week's hours instead of this week's hours!

---

## Usage in Code (TIMEZONE-AWARE)

**CORRECT Implementation**:

```typescript
import { DateTime } from 'luxon';

/**
 * Get the Monday of the week for a given date in the specified timezone.
 *
 * CRITICAL: Always pass the location's timezone!
 */
export function getMondayOfWeek(
  date: Date = new Date(),
  timezone: string = 'America/Chicago'
): string {
  const dt = DateTime.fromJSDate(date).setZone(timezone);
  const monday = dt.startOf('week');
  return monday.toFormat('yyyy-LL-dd');
}

// Get current week's hours for a location
const currentWeekStart = getMondayOfWeek(new Date(), location.timezone);
const weeklyHours = location.weekly_hours?.[currentWeekStart];

// Fall back to global settings if not set
const hours = weeklyHours ?? globalSettings.operating_hours;
```

**❌ INCORRECT Implementation** (DO NOT USE):

```typescript
// ❌ WRONG: Uses server/UTC timezone
const getMondayOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().split('T')[0];
};
```

---

## Rollback Plan

**Complexity**: EASY

**Data Loss Risk**: YES - All data in `weekly_hours` column will be lost

**When to Rollback**:
- Migration fails to apply
- Critical bug discovered in implementation
- Business requirements change

**Steps**: Execute `20260504153206_add_weekly_hours_to_locations_ROLLBACK.sql`

---

## Notes

- **Nullability**: Column is nullable to avoid breaking existing rows
- **Index**: GIN index added for efficient JSONB queries
- **RLS**: No RLS changes needed - existing policies cover all columns
- **Fallback**: Application should fall back to `settings.operating_hours` if `weekly_hours` is null or week not found
- **Week Key**: Use Monday's date (YYYY-MM-DD) as the key for each week's hours
- **Closed Days**: Use `null` for closed days (not `{ open: null, close: null }`)

### ⚠️ CRITICAL: Timezone Handling Requirements

**Week keys MUST be calculated in the location's timezone, NOT UTC or server timezone!**

**Why this matters**:
- A location in America/Chicago has a different "Monday" than UTC at certain times
- At Sunday 11:00 PM Chicago time, it's Monday 5:00 AM UTC
- Using UTC would show NEXT week's hours instead of current week's hours
- DST transitions can cause 1-hour time shifts twice per year

**Implementation checklist**:
- [ ] Use `getMondayOfWeek(date, location.timezone)` - NEVER omit the timezone parameter
- [ ] Import utility from `@/utils/dateUtils` which uses Luxon for timezone handling
- [ ] Test during DST transitions (March/November) and midnight boundaries
- [ ] Display timezone in admin UI when editing weekly hours
- [ ] Add timezone to any logs or error messages for debugging

**Reference**: See `src/utils/dateUtils.ts` for timezone-aware date functions using Luxon library.

---
