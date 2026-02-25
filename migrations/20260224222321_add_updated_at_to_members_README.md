# Migration: Add updated_at Column to Members Table

**Date**: 2026-02-24
**Author**: AI Migration Generator
**Status**: Pending

---

## Description

This migration adds the missing `updated_at` column to the `members` table. The table already has a trigger (`trigger_update_members_updated_at`) that attempts to automatically update this column whenever a member record is modified, but the column itself was never created. This causes **all UPDATE operations on the members table to fail** with the error:

```
ERROR: record "new" has no field "updated_at"
```

This migration fixes the broken state by:
1. Adding the `updated_at TIMESTAMPTZ` column (matching the type of `created_at`)
2. Setting default value to `NOW()`
3. Backfilling existing rows with their `created_at` timestamp (or `NOW()` if null)

After this migration, the existing trigger will work correctly and automatically update the `updated_at` timestamp on every UPDATE operation.

---

## Tables Affected

- `members` - **Modified** (column added)

---

## Breaking Changes

**NO**

This is a non-breaking, additive change. All existing code will continue to work:
- No queries need to be updated (column is auto-populated)
- No API responses change (unless explicitly selecting `updated_at`)
- No components break (column is optional and backward compatible)

**This migration FIXES a critical bug** - member updates currently fail in production.

---

## Prerequisites

- [ ] Backup database before applying (standard precaution)
- [ ] Verify current members table has the broken trigger:
  ```sql
  SELECT tgname FROM pg_trigger WHERE tgrelid = 'members'::regclass AND tgname = 'trigger_update_members_updated_at';
  ```
- [ ] Confirm UPDATE operations are currently failing:
  ```sql
  -- This should fail with "record new has no field updated_at"
  UPDATE members SET stripe_customer_id = stripe_customer_id WHERE member_id = (SELECT member_id FROM members LIMIT 1);
  ```

---

## Migration Steps

### Apply Migration

1. **Backup database**
   - In Supabase Dashboard: Go to Database → Backups → Create Backup

2. **Apply migration in Supabase SQL Editor**
   - Copy contents of `20260224222321_add_updated_at_to_members.sql`
   - Paste into SQL Editor (Database → SQL Editor)
   - Click "Run" or press Cmd+Enter

3. **Verify migration**
   ```sql
   -- Check column exists
   SELECT column_name, data_type, is_nullable, column_default
   FROM information_schema.columns
   WHERE table_name = 'members' AND column_name = 'updated_at';

   -- Expected: updated_at | timestamp with time zone | NO | now()
   ```

4. **Test that updates now work**
   ```sql
   -- This should now succeed
   UPDATE members
   SET stripe_customer_id = 'cus_SH6Kr9Xkf5cRTj'
   WHERE member_id = 'a0d72e7c-b739-482a-9d64-fc33b4cd7450';

   -- Verify updated_at was automatically set
   SELECT member_id, stripe_customer_id, created_at, updated_at
   FROM members
   WHERE member_id = 'a0d72e7c-b739-482a-9d64-fc33b4cd7450';

   -- updated_at should be more recent than created_at
   ```

---

### Rollback Migration

**Only if migration causes unexpected issues**

1. **Apply rollback script**
   - Copy contents of `20260224222321_add_updated_at_to_members_ROLLBACK.sql`
   - Paste into SQL Editor
   - Execute

2. **Verify rollback**
   ```sql
   -- Check column removed
   SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'members' AND column_name = 'updated_at';
   -- Expected: 0
   ```

3. **WARNING**: After rollback, member updates will fail again!

---

## Testing Checklist

After applying migration:

**Schema Validation**
- [x] Column exists with correct data type (TIMESTAMPTZ)
- [x] Column is NOT NULL
- [x] Column has default value (NOW())
- [x] Trigger exists and is enabled

**Functionality Testing**
- [ ] Member UPDATE operations succeed (were failing before)
- [ ] Stripe webhook can update members (was failing before)
- [ ] updated_at is automatically set on UPDATE operations
- [ ] updated_at does NOT change on SELECT operations

**Webhook Testing** (Critical - this was the original issue)
- [ ] Update a subscription in Stripe dashboard
- [ ] Check Vercel logs - webhook should succeed (not fail with "updated_at" error)
- [ ] Verify member record was updated in database
- [ ] Verify `updated_at` timestamp was set

**Application Testing**
- [ ] Admin members page loads correctly
- [ ] Member details page displays correctly
- [ ] Member portal profile page works
- [ ] No console errors in browser
- [ ] No API errors in Vercel logs

---

## Code Changes Required

**None!** This is purely a database schema fix. No code changes needed.

The `updated_at` column will be automatically populated by the existing trigger. Code can optionally use it in the future for:
- Displaying "Last updated" timestamps in UI
- Filtering recently updated members
- Audit trails

---

## Rollback Plan

**Complexity**: EASY

**Data Loss Risk**: LOW - Only the `updated_at` timestamps will be lost (not critical data)

**Steps**: Run `20260224222321_add_updated_at_to_members_ROLLBACK.sql`

**Impact**: Member UPDATE operations will break again (same as before migration)

---

## Notes

### Why This Happened

The trigger `trigger_update_members_updated_at` was created (likely in an earlier migration) but the corresponding column was never added. This could have happened due to:
- Migration script that only created the trigger
- Incomplete rollback that removed column but left trigger
- Manual database changes

### Future Prevention

When creating `updated_at` triggers in future migrations:
1. Always create the column BEFORE creating the trigger
2. Test the trigger immediately after creation
3. Document both column and trigger in migration README

### Performance Impact

Minimal - adding a single timestamp column does not impact query performance. The column is:
- Auto-populated (no application logic needed)
- Indexed if needed later for filtering
- Standard pattern across most tables

---
