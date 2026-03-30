# Deactivated Field Removal Map

## Replacement Rules

### Query Patterns
```typescript
// OLD → NEW
.eq('deactivated', false) → .in('status', ['active', 'paused'])
.eq('deactivated', true) → .eq('status', 'inactive')
.or('deactivated.is.null,deactivated.eq.false') → .in('status', ['active', 'paused'])
!m.deactivated → m.status !== 'inactive'
m.deactivated → m.status === 'inactive'
```

### Update Operations
```typescript
// OLD → NEW
{ deactivated: true } → { status: 'inactive' }
{ deactivated: false } → { status: 'active' }  // Context dependent!
{ deactivated: true, status: 'inactive' } → { status: 'inactive' }  // Remove deactivated
{ deactivated: false, status: 'active' } → { status: 'active' }  // Remove deactivated
```

### TypeScript Types
```typescript
// Remove from interfaces
deactivated: boolean;  // DELETE THIS LINE

// Update select strings
'member_id, deactivated' → 'member_id, status'
```

---

## Files to Update (27 files)

### Category 1: API Routes - Write Operations (7 files)
**These set deactivated field - need to remove the field from updates**

1. **src/pages/api/members/[memberId].js**
   - Line 213: Remove `deactivated` field, keep only `status: 'inactive'`

2. **src/pages/api/members/[memberId]/unarchive.js**
   - Line 35: Remove `deactivated` field, keep only `status: 'active'`

3. **src/pages/api/members/add-to-account.ts**
   - Line 164: Remove `deactivated: false`, keep only `status: 'active'`

4. **src/pages/api/subscriptions/cancel.ts**
   - Line 56: Remove `.eq('deactivated', false)` - use `.in('status', ['active', 'paused'])`

5. **src/pages/api/subscriptions/pause.ts**
   - Line 58: Remove `.eq('deactivated', false)` - use `.in('status', ['active', 'paused'])`

6. **src/pages/api/subscriptions/resume.ts**
   - Line 58: Remove `.eq('deactivated', false)` - use `.eq('status', 'paused')`

7. **src/pages/api/subscriptions/update-plan.ts**
   - Line 82: Remove `.eq('deactivated', false)` from secondary member count
   - Line 181: Remove `.eq('deactivated', false)` from reactivation update

### Category 2: API Routes - Read Operations (12 files)
**These query with deactivated filter**

8. **src/pages/api/accounts/[accountId].ts**
   - Line 39: `.eq('deactivated', false)` → `.in('status', ['active', 'paused'])`

9. **src/pages/api/member/account-members.ts**
   - Line 48: Remove `.eq('deactivated', false)`, already has `.in('status', ['active', 'paused'])`

10. **src/pages/api/member/account-subscription.ts**
    - Line 71: `.eq('deactivated', false)` → `.in('status', ['active', 'paused'])`

11. **src/pages/api/member/verify-phone.ts**
    - Line 40: Remove `deactivated` from select
    - Line 41: Remove `.eq('deactivated', false)` - use `.in('status', ['active', 'paused'])`

12. **src/pages/api/member/referrals.ts**
    - Line 46: Remove `deactivated` from select, add `status`
    - Line 55: Change `!m.deactivated` → `m.status !== 'inactive'`

13. **src/pages/api/auth/send-phone-otp.ts**
    - Line 72: Remove `deactivated` from select
    - Line 73: Remove `.eq('deactivated', false)` - use `.in('status', ['active', 'paused'])`

14. **src/pages/api/auth/check-session.ts**
    - Line 48: Remove `deactivated` from select (keep status)

15. **src/pages/api/referral/validate.ts**
    - Line 21: Remove `.eq('deactivated', false)` - use `.in('status', ['active', 'paused'])`

16. **src/pages/api/cron-status.ts**
    - Line 35: Remove `.eq('deactivated', false)` (already has `.eq('status', 'active')`)

17. **src/pages/api/process-campaign-messages.ts**
    - Need to check usage

18. **src/pages/api/send-bulk-message.js**
    - Need to check usage

19. **src/pages/api/payment/confirm.ts**
    - Need to check usage

### Category 3: Frontend Pages (4 files)

20. **src/pages/admin/members.tsx**
    - Line 133: Remove `.eq('deactivated', false)` (already has status filter)

21. **src/pages/admin/members/[accountId].tsx**
    - Line 250: Replace with status filter
    - Line 299: Replace with status filter
    - Line 1093: Replace with status filter
    - Line 1560: Replace with status filter
    - Line 2828: Replace with status filter

22. **src/pages/admin/business.tsx**
    - Line 571: Remove `.eq('deactivated', false)` (already has `.eq('status', 'active')`)
    - Line 726, 731: Update UI text (cosmetic)

23. **src/pages/admin/dashboard.tsx**
    - Line 467: Update description text (cosmetic)

### Category 4: Components (4 files)

24. **src/components/MemberSubscriptionCard.tsx**
    - Check usage and update filters

25. **src/components/ArchivedMembersModal.tsx**
    - Line: `.eq('deactivated', true)` → `.eq('status', 'inactive')`

26. **src/components/PendingMembersModal.tsx**
    - Check usage

27. **src/components/CreateSubscriptionModal.tsx**
    - Check usage

### Category 5: Library Files (2 files)

28. **src/lib/businessMetrics.ts**
    - Line 260: Remove `deactivated` from select
    - Line 262: Replace `.or('deactivated.is.null,deactivated.eq.false')` with status filter
    - Line 324: Replace `!m.deactivated` with `m.status !== 'inactive'`

29. **src/lib/security.ts**
    - Line 70: Update comment
    - Line 88, 100, 117: Replace `.eq('deactivated', false)` with status filter
    - Line 161-162: Update `includeDeactivated` logic to use status

### Category 6: TypeScript Types (1 file)

30. **src/context/MemberAuthContext.tsx**
    - Line 20: Remove `deactivated: boolean;` from interface

---

## Files NOT to Update (UI Text Only)

These files contain "deactivated" in UI messages only (not the database field):
- src/pages/admin/campaigns/[id].tsx (line 282 - template activation message)
- src/pages/admin/communication.tsx (lines 183, 234 - UI toast messages)
- src/pages/admin/templates.tsx (lines 579, 586, 595 - UI toast messages)

---

## Verification Queries

After all code changes, verify with:
```sql
-- Should show no references to deactivated column
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_name = 'members' AND column_name = 'deactivated';

-- Check data distribution
SELECT status, COUNT(*)
FROM members
GROUP BY status;
```

---

## Database Migration (Final Step)

After all code is updated and tested:
```sql
-- Drop trigger
DROP TRIGGER IF EXISTS sync_member_status_trigger ON members;

-- Drop function
DROP FUNCTION IF EXISTS sync_member_status();

-- Drop column
ALTER TABLE members DROP COLUMN IF EXISTS deactivated;
```
