# Migration: Add is_member_event to private_events

**Date**: 2026-03-05
**Author**: AI Migration Generator
**Status**: Pending

---

## Description

Adds a `is_member_event` boolean column to the `private_events` table to enable admins to tag specific events as visible to NOAA members in the member portal calendar.

**Business Problem**: Currently, all private events are admin-only. Members need to see select events (NOAA member events) in their portal calendar, but other private events should remain hidden from members.

**Solution**: Add a simple boolean flag that defaults to `false` (private). Admins can toggle this to `true` for events they want members to see.

---

## Tables Affected

- `private_events` - Added column `is_member_event` (BOOLEAN, DEFAULT false, NOT NULL)

---

## Breaking Changes

**NO** - This is an additive migration. All existing events default to `false` (remain private).

---

## Prerequisites

- [ ] Review Schema Scout report (completed)
- [ ] Existing RLS policies allow members to view `private_events` where `status = 'active'`
- [ ] Affected API routes identified: `src/pages/api/noir-member-events.ts`
- [ ] Affected components identified: `src/components/member/UpcomingEventsModal.tsx`, `src/components/admin/PrivateEventsManager.tsx`

---

## Migration Steps

### Apply Migration

1. **Run migration in Supabase SQL Editor**
   - Copy contents of `20260305_add_is_member_event_to_private_events.sql`
   - Paste into SQL Editor
   - Execute

2. **Verify migration**
   ```sql
   -- Check column exists
   SELECT column_name, data_type, column_default
   FROM information_schema.columns
   WHERE table_name = 'private_events' AND column_name = 'is_member_event';

   -- Check indexes created
   SELECT indexname FROM pg_indexes
   WHERE tablename = 'private_events' AND indexname LIKE '%is_member_event%';

   -- Verify all existing events defaulted to false
   SELECT COUNT(*) as total,
          COUNT(*) FILTER (WHERE is_member_event = false) as private
   FROM private_events;
   ```

3. **Test column update**
   ```sql
   -- Test setting a test event to member-visible
   UPDATE private_events
   SET is_member_event = true
   WHERE id = '<test_event_id>';

   -- Verify
   SELECT id, title, is_member_event FROM private_events WHERE id = '<test_event_id>';
   ```

---

### Rollback Migration

**Only if migration fails or needs reversal**

1. **Apply rollback script**
   - Copy contents of `20260305_add_is_member_event_to_private_events_ROLLBACK.sql`
   - Execute in SQL Editor

2. **Verify rollback**
   ```sql
   SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'private_events' AND column_name = 'is_member_event';
   -- Expected: 0
   ```

---

## Testing Checklist

After applying migration:

### Schema Validation
- [ ] Column `is_member_event` exists with type BOOLEAN
- [ ] Column has DEFAULT false NOT NULL
- [ ] All existing events have `is_member_event = false`
- [ ] Indexes created: `idx_private_events_is_member_event`, `idx_private_events_member_event_status`

### Database Operations
- [ ] Can UPDATE event to set `is_member_event = true`
- [ ] Can INSERT new event with `is_member_event = true`
- [ ] Can INSERT new event without specifying (defaults to false)

### Application Testing (After Code Updates)
- [ ] Admin event form shows checkbox for "Show in Member Portal"
- [ ] Checkbox saves correctly to database
- [ ] Member portal calendar displays tagged events
- [ ] Member portal does NOT display non-tagged events
- [ ] Member portal only shows events where `status = 'active'` AND `is_member_event = true`

---

## Code Changes Required

| File | Change Required | Priority |
|------|-----------------|----------|
| `src/types/index.ts:144` | Add `is_member_event?: boolean` to `PrivateEvent` interface | HIGH |
| `src/components/admin/PrivateEventsManager.tsx` | Add checkbox in create/edit form | HIGH |
| `src/pages/admin/event-calendar.tsx:49` | Add `is_member_event?: boolean` to local interface | HIGH |
| `src/pages/admin/event-calendar.tsx:404-549` | Include `is_member_event` in save handler | HIGH |
| `src/components/member/UpcomingEventsModal.tsx:46-104` | Replace hardcoded events with real API call | HIGH |
| `src/pages/api/noir-member-events.ts:50` | Add `.eq('is_member_event', true)` filter | HIGH |
| `HOWTO.md` | Update `private_events` schema documentation | MEDIUM |

---

## Rollback Plan

**Complexity**: EASY

**Data Loss Risk**: YES - Any events tagged as `is_member_event = true` will lose that flag. However, no event data is lost, only the member visibility flag.

**Steps**: Run `20260305_add_is_member_event_to_private_events_ROLLBACK.sql`

---

## Performance Notes

- Partial indexes created for optimal member portal queries
- Index on `is_member_event WHERE is_member_event = true` - small, fast
- Composite index on `(is_member_event, status)` for common query pattern
- Member portal queries will be efficient even with many events

---

## Notes

- Existing RLS policies already allow members to SELECT from `private_events` where `status = 'active'`
- Application code will add additional filter for `is_member_event = true`
- No RLS policy changes needed - security is maintained
- Default `false` ensures backward compatibility

---
