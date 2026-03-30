# Member Status Consolidation Plan

## Overview
Consolidate member status tracking from two fields (`status` + `deactivated`) to a single `status` field.

**Strategy:** Gradual migration (Phase 1) keeping both fields, then remove `deactivated` later (Phase 2)

---

## Status Values

```typescript
type MemberStatus =
  | 'active'     // Active paying member
  | 'inactive'   // Canceled or archived member
  | 'paused'     // Subscription is paused (can reactivate)
  | 'pending'    // In onboarding process
  | 'incomplete' // Failed/incomplete onboarding
```

---

## Phase 1: Dual Field Operation (Current)

Keep both `status` and `deactivated` working together during transition.

### Phase 1A: Data Migration ✅ READY
**File:** `supabase/migrations/20260330_consolidate_member_status.sql`

**What it does:**
1. Adds `'paused'` to status constraint
2. Fixes inconsistencies (status='active', deactivated=true → status='inactive')
3. Syncs member status with account subscription status
4. Creates trigger to keep fields in sync automatically
5. Adds performance index for status queries

**Run this first:** `psql $DATABASE_URL -f supabase/migrations/20260330_consolidate_member_status.sql`

---

### Phase 1B: Update Write Operations

Update APIs that archive/unarchive members to set **both** fields:

**Files to update (3):**
1. `src/pages/api/members/[memberId].js` (DELETE - archive)
2. `src/pages/api/members/[memberId]/unarchive.js` (POST - unarchive)
3. `src/pages/api/members/add-to-account.ts` (POST - create member)

**Changes:**
```typescript
// OLD: Archive
{ deactivated: true }

// NEW: Archive (set both)
{ deactivated: true, status: 'inactive' }

// OLD: Unarchive
{ deactivated: false }

// NEW: Unarchive (set both)
{ deactivated: false, status: 'active' }
```

---

### Phase 1C: Update Subscription Operations

Update subscription APIs to set member status when account status changes:

**Files to update (4):**
1. `src/pages/api/subscriptions/cancel.ts` - Set all members to `status='inactive'`
2. `src/pages/api/subscriptions/pause.ts` - Set all members to `status='paused'`
3. `src/pages/api/subscriptions/resume.ts` (if exists) - Set all members to `status='active'`
4. `src/pages/api/subscriptions/update-plan.ts` - Set members to `status='active'` when reactivating

**Example for cancel.ts:**
```typescript
// After updating account to canceled, update all members
await supabase
  .from('members')
  .update({ status: 'inactive' })
  .eq('account_id', account_id)
  .eq('deactivated', false); // Only update non-archived members
```

---

### Phase 1D: Update Read Operations

Update queries to use **both** fields for safety:

**Query Pattern:**
```typescript
// OLD: Only check deactivated
.eq('deactivated', false)

// NEW: Check both (during Phase 1)
.eq('deactivated', false)
.in('status', ['active', 'paused']) // or .eq('status', 'active')
```

**Files to update (~25 files):**
- All API endpoints that query members
- Admin pages
- Components
- Core libraries

**Priority files:**
1. `src/pages/admin/business.tsx` (Business Dashboard counts)
2. `src/lib/businessMetrics.ts` (Metrics calculations)
3. `src/pages/admin/members.tsx` (Member list)
4. Major API endpoints

---

### Phase 1E: Testing Checklist

After all Phase 1 updates:

- [ ] Archive a member → verify status='inactive' AND deactivated=true
- [ ] Unarchive a member → verify status='active' AND deactivated=false
- [ ] Cancel subscription → verify all members status='inactive'
- [ ] Pause subscription → verify all members status='paused'
- [ ] Business Dashboard counts match expected (active only)
- [ ] Member list shows correct filtered results
- [ ] Archived Members modal shows deactivated=true members
- [ ] No active members with deactivated=true

---

## Phase 2: Remove Deactivated Column (Future)

**Only after Phase 1 is stable and tested in production for 2+ weeks**

### Phase 2A: Remove Code References
1. Remove all `deactivated` field references
2. Update queries to use only `status`
3. Remove trigger function
4. Update TypeScript types

### Phase 2B: Database Cleanup
```sql
-- Drop trigger first
DROP TRIGGER IF EXISTS trigger_sync_member_status ON members;
DROP FUNCTION IF EXISTS sync_member_status();

-- Drop index
DROP INDEX IF EXISTS idx_members_deactivated;

-- Drop column
ALTER TABLE members DROP COLUMN deactivated;
```

---

## Current Status

- [x] Phase 1A: Migration created ✅
- [ ] Phase 1A: Migration executed
- [ ] Phase 1B: Write operations updated
- [ ] Phase 1C: Subscription operations updated
- [ ] Phase 1D: Read operations updated
- [ ] Phase 1E: Testing completed
- [ ] Phase 2: Scheduled (pending Phase 1 stability)

---

## Rollback Plan

If issues arise during Phase 1:
1. Trigger keeps fields in sync automatically
2. Can revert code changes without data loss
3. Both fields remain functional independently
4. No database schema changes needed to rollback

---

## Benefits After Completion

- Single source of truth for member status
- Clearer code (one field to check)
- Better status granularity (paused state)
- Consistent Business Dashboard counting
- Easier to maintain subscription lifecycle
- No more status/deactivated conflicts
