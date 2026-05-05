# 🚨 URGENT: Locations Table RLS Security Fix

## Issue Summary

**Problem**: Mobile users cannot see available reservation dates
**Root Cause**: Anonymous users cannot access locations table due to missing RLS policy
**Critical Finding**: Security audit discovered anonymous users CAN write to locations table (unrelated bug)

---

## Security Audit Results

### 🔴 CRITICAL: Anonymous Write Access Vulnerability

**Discovered Issue**: The existing service role policy does not specify `TO service_role`, allowing ALL users (including anonymous) to INSERT/UPDATE/DELETE locations.

**Impact**: HIGH - Unauthenticated users can modify venue data

**Fix**: Deploy migration `20260504_fix_service_role_policy_URGENT.sql` immediately

---

### ✅ Public Read Access (Secure View)

**Implementation:** Uses a database view (`public_locations`) instead of direct table access

**What's exposed to anonymous users:**
- `slug`, `name` - Venue identifiers (public info)
- `timezone` - For date calculations
- `weekly_hours`, `booking_start_date`, `booking_end_date` - Availability
- `cover_enabled`, `cover_price` - Pricing (public info)
- Only locations where `status = 'active'`

**What's protected:**
- Inactive locations (filtered by view)
- Write operations (blocked after fix)
- **`minaka_ical_url`** (EXCLUDED from view - contains iCal feed tokens)
  - Even though iCal tokens are shareable, we apply principle of least privilege
  - Not needed for reservation booking flow

---

## Deployment Steps (MUST RUN IN ORDER)

### Step 1: Apply Urgent Security Fix

```sql
-- File: migrations/20260504_fix_service_role_policy_URGENT.sql
-- Purpose: Prevent anonymous write access
```

**In Supabase SQL Editor:**
1. Copy contents of `20260504_fix_service_role_policy_URGENT.sql`
2. Execute in SQL editor
3. Verify:
   ```sql
   SELECT policyname, roles::text[]
   FROM pg_policies
   WHERE tablename = 'locations'
     AND policyname = 'Service role has full access to locations';
   -- Should show roles = {service_role}
   ```

---

### Step 2: Create Public Locations View

```sql
-- File: migrations/20260504_create_public_locations_view.sql
-- Purpose: Create secure view that excludes minaka_ical_url from anonymous access
```

**In Supabase SQL Editor:**
1. Copy contents of `20260504_create_public_locations_view.sql`
2. Execute in SQL editor
3. Verify view was created:
   ```sql
   -- Check view exists
   SELECT table_name, table_type
   FROM information_schema.tables
   WHERE table_name = 'public_locations';
   -- Expected: 1 row, table_type = 'VIEW'

   -- Verify minaka_ical_url is excluded
   SELECT column_name
   FROM information_schema.columns
   WHERE table_name = 'public_locations'
   ORDER BY ordinal_position;
   -- Expected: Should NOT include minaka_ical_url

   -- Verify grant to anon
   SELECT grantee, privilege_type
   FROM information_schema.role_table_grants
   WHERE table_name = 'public_locations';
   -- Expected: anon with SELECT
   ```

**Expected result:**
- View `public_locations` created
- Contains all columns EXCEPT `minaka_ical_url`
- Anonymous users can SELECT from view
- Filters to `status = 'active'` only

---

### Step 3: Run Security Tests

```bash
node test-locations-policy.js
```

**Expected Results:**
- ✅ Test 1: Anonymous users can READ locations via public_locations view
- ✅ Test 2: minaka_ical_url is HIDDEN from anonymous users
- ✅ Test 3: Only active locations visible
- ✅ Test 4: Admins have full access to locations table
- ✅ Test 5: Anonymous users CANNOT write to locations (should be fixed now)

---

## Rollback Plan (If Needed)

### Rollback Step 2 (Public View):
```sql
-- File: migrations/20260504_create_public_locations_view_ROLLBACK.sql
```
**Impact**: Mobile reservation booking will break again (frontend queries public_locations view)

### Rollback Step 1 (Security Fix):
```sql
-- File: migrations/20260504_fix_service_role_policy_URGENT_ROLLBACK.sql
```
**⚠️ WARNING**: This re-introduces the security vulnerability

---

## Testing Checklist

After deployment:

**Security Validation:**
- [ ] Anonymous users can read active locations
- [ ] Anonymous users CANNOT modify locations
- [ ] Inactive locations are hidden from anonymous users
- [ ] Authenticated members can still read locations
- [ ] Admins have full access

**Functionality:**
- [ ] Mobile reservation modal shows available dates
- [ ] Desktop reservation modal still works
- [ ] Weekly hours display correctly
- [ ] Booking window dates respected
- [ ] Cover charge pricing displays

**Code Changes Required:**
- [x] Update `SimpleReservationRequestModal.tsx` to query `public_locations` view (DONE)
  - Line 197: Changed from `locations` to `public_locations`
  - Line 313: Changed from `locations` to `public_locations`

---

## Files Created

**Migrations:**
1. `migrations/20260504_fix_service_role_policy_URGENT.sql` - Security fix (DEPLOY FIRST)
2. `migrations/20260504_fix_service_role_policy_URGENT_ROLLBACK.sql` - Rollback for #1
3. `migrations/20260504_create_public_locations_view.sql` - Create secure view
4. `migrations/20260504_create_public_locations_view_ROLLBACK.sql` - Rollback for #3

**Testing & Documentation:**
5. `test-locations-policy.js` - Security test script
6. `DEPLOYMENT_GUIDE_locations_rls.md` - This guide

**Code Changes:**
7. `src/components/member/SimpleReservationRequestModal.tsx` - Updated to use public_locations view

---

## Additional Fixes Applied to SimpleReservationRequestModal.tsx

Fixed timezone consistency issues:
- Line 366: `DateTime.fromJSDate(newDate, { zone: locationTimezone })`
- Line 901: `DateTime.fromJSDate(date, { zone: locationTimezone })`

These ensure date formatting uses location timezone, not device timezone.

---

## Why Desktop Works But Mobile Doesn't

**Desktop**: User is logged in as a member
→ "Members can view locations" policy allows access
→ Location data fetched successfully
→ Dates display correctly

**Mobile**: User is NOT logged in (anonymous)
→ No RLS policy for anonymous users
→ Location query returns empty (RLS blocks)
→ No timezone/hours data
→ Calendar shows no dates

**After fix**: Anonymous users have read access → Mobile works!

---

## Compliance Notes

- ✅ Read-only access for anonymous users
- ✅ Write operations protected (after Step 1)
- ✅ Sensitive data not exposed
- ✅ Active locations only
- ✅ Existing policies preserved
- ✅ Full rollback capability
- ✅ Comprehensive test coverage

---

## Questions?

Review the security audit report generated by the migration review agent for detailed analysis.
