# Migration: Add Status Column to Tables

**Date**: 2026-07-03
**Author**: AI Migration Generator
**Status**: Pending

---

## Description

This migration adds a `status` column to the `tables` table to track whether a table is available for reservations. Tables can be marked as:
- **active**: Available for reservations (default)
- **inactive**: Temporarily unavailable (maintenance, repairs, etc.)

This allows admins to temporarily remove tables from the booking system without deleting them.

---

## Tables Affected

- `tables` - Modified (status column added)

---

## Breaking Changes

**NO** - This is a backward-compatible change. The column defaults to 'active' for all existing tables.

---

## Prerequisites

- [ ] Backup database before applying
- [ ] Ensure tables table exists in database
- [ ] Review affected API routes (see below)

---

## Migration Steps

### Apply Migration

1. **Backup database**
   ```
   Create backup in Supabase dashboard:
   - Go to Database → Backups
   - Click "Create backup"
   - Wait for backup completion
   ```

2. **Apply migration in Supabase SQL Editor**
   ```sql
   -- Copy contents of 20260703_add_status_to_tables.sql
   -- Paste into SQL Editor
   -- Click "Run"
   ```

3. **Verify migration**
   ```sql
   -- Check column exists
   SELECT column_name, data_type, column_default
   FROM information_schema.columns
   WHERE table_name = 'tables'
     AND column_name = 'status';

   -- Check all tables have status
   SELECT COUNT(*) as total,
          COUNT(status) as with_status
   FROM tables;
   ```

4. **Test functionality**
   - Navigate to `/admin/settings`
   - Select Noir KC or RooftopKC tab
   - Verify tables display with status
   - Test editing table status

---

### Rollback Migration

**Only if migration fails or needs reversal**

1. **Apply rollback script**
   ```sql
   -- Copy contents of 20260703_add_status_to_tables_ROLLBACK.sql
   -- Paste into SQL Editor
   -- Click "Run"
   ```

2. **Verify rollback**
   ```sql
   -- Check column removed
   SELECT COUNT(*)
   FROM information_schema.columns
   WHERE table_name = 'tables'
     AND column_name = 'status';
   -- Expected: 0
   ```

---

## Testing Checklist

After applying migration:

**Schema Validation**
- [ ] Status column exists on tables table
- [ ] CHECK constraint enforces 'active' or 'inactive' only
- [ ] All existing tables have status = 'active'
- [ ] Indexes created successfully

**API Testing**
- [ ] GET `/api/tables` returns tables with status
- [ ] POST `/api/tables` creates table with status
- [ ] PUT `/api/tables/[id]` updates status correctly
- [ ] DELETE `/api/tables/[id]` still works

**UI Testing**
- [ ] Tables Management section displays in settings
- [ ] Status shows as Active/Inactive badges
- [ ] Edit drawer allows status changes
- [ ] Changes persist after save

**Reservation Impact**
- [ ] Active tables appear in reservation system
- [ ] Inactive tables excluded from availability
- [ ] Existing reservations on now-inactive tables preserved

---

## Code Changes Required

| File | Change Status | Notes |
|------|---------------|-------|
| src/app/api/tables/route.ts | ✅ Updated | Handles status field, defaults to 'active' |
| src/app/api/tables/[id]/route.ts | ✅ Ready | Already supports status updates |
| src/components/tables/TablesList.tsx | ✅ Ready | Displays status badges |
| src/components/tables/TableEditDrawer.tsx | ✅ Ready | Has status dropdown |

---

## Performance Impact

**Positive**:
- Indexes on status column enable fast filtering
- Composite index on (location_id, status) optimizes common query pattern

**Neutral**:
- Minimal storage increase (one TEXT column)
- No impact on existing queries

---

## Security Considerations

- No RLS policy changes needed
- Status changes require admin authentication (existing policies)
- No new attack vectors introduced

---

## Rollback Plan

**Complexity**: EASY

**Data Loss Risk**: YES - Status data will be lost

**Steps**:
1. Run `20260703_add_status_to_tables_ROLLBACK.sql`
2. Update application code to remove status references
3. Redeploy application

---

## Notes

- Consider future enhancement: status history tracking
- May want to add status reasons (maintenance, private event, etc.)
- Could add scheduled status changes (e.g., maintenance windows)

---

## Monitoring

After deployment, monitor:
- Error rates on `/api/tables` endpoints
- Reservation creation success rate
- Admin settings page load times

---