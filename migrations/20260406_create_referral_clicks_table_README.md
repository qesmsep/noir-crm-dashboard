# Migration: Create Referral Clicks Tracking Table

**Date**: 2026-04-06
**Author**: AI Migration Generator
**Status**: Pending

---

## Description

Creates a new `referral_clicks` table to track referral link clicks separately from waitlist entries. This solves the problem of cluttering the waitlist admin view with incomplete "Pending Referral" entries (showing as "000-000-0000" phone numbers).

**Problem Solved**:
- Waitlist currently shows placeholder entries when someone clicks a referral link but doesn't complete the form
- No way to see which member's referral links are getting clicked vs completing
- Admin view cluttered with fake "Pending Referral, 000-000-0000" entries

**Solution**:
- Track clicks immediately in `referral_clicks` table (for analytics)
- Only create waitlist entry AFTER user enters their phone number in the form
- Add "Referral Analytics" admin view to see click-through rates per member
- Keep waitlist clean with only real, actionable applications

---

## Tables Affected

- `referral_clicks` - **Created** (new table)
- `members` - Referenced via foreign key
- `waitlist` - Referenced via foreign key (nullable)

---

## Breaking Changes

**NO** - This is a new table with no impact on existing functionality.

---

## Prerequisites

- [x] `members` table exists with `member_id` column
- [x] `waitlist` table exists with `id` column
- [x] `is_member_portal_admin()` function exists
- [ ] Backup database before applying
- [ ] Review affected API routes (listed below)

---

## Migration Steps

### Apply Migration

1. **Backup database**
   ```bash
   # In Supabase Dashboard:
   # Database → Backups → Create Backup (optional but recommended)
   ```

2. **Apply migration in Supabase SQL Editor**
   - Open Supabase Dashboard → SQL Editor
   - Copy contents of `20260406_create_referral_clicks_table.sql`
   - Paste into SQL Editor
   - Click "Run" or press Cmd/Ctrl + Enter

3. **Verify migration**
   ```sql
   -- Check table exists
   SELECT * FROM referral_clicks LIMIT 1;

   -- Check RLS enabled
   SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'referral_clicks';

   -- Check policies
   SELECT policyname FROM pg_policies WHERE tablename = 'referral_clicks';
   -- Expected: admin_referral_clicks_all, member_referral_clicks_select_own

   -- Check indexes
   SELECT indexname FROM pg_indexes WHERE tablename = 'referral_clicks';
   -- Expected: 5-6 indexes
   ```

4. **Test with different user roles**
   - Test as admin (should have full access)
   - Test as member (should see own referral clicks only)
   - Test unauthenticated (should be denied)

---

### Rollback Migration

**Only if migration fails or needs reversal**

1. **Apply rollback script**
   - Copy contents of `20260406_create_referral_clicks_table_ROLLBACK.sql`
   - Paste into SQL Editor
   - Execute

2. **Verify rollback**
   ```sql
   SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'referral_clicks';
   -- Expected: 0
   ```

---

## Testing Checklist

After applying migration:

**Schema Validation**
- [ ] Table exists with correct structure (`SELECT * FROM referral_clicks LIMIT 1;`)
- [ ] All columns have correct data types
- [ ] Foreign keys to `members.member_id` and `waitlist.id` exist
- [ ] Indexes created successfully (5 indexes)
- [ ] RLS is enabled
- [ ] Check constraint on `referral_code` format works

**Policy Validation**
- [ ] Admin can SELECT, INSERT, UPDATE, DELETE
- [ ] Members can SELECT only their own referral clicks
- [ ] Members cannot INSERT, UPDATE, or DELETE
- [ ] Unauthenticated users are denied all access

**Application Testing** (after code changes)
- [ ] Clicking referral link logs entry to `referral_clicks`
- [ ] Completing form sets `converted = TRUE` and `waitlist_id`
- [ ] Waitlist admin view no longer shows "000-000-0000" entries
- [ ] Referral Analytics view shows click data per member
- [ ] No console errors in browser

**Performance**
- [ ] Queries use indexes (`EXPLAIN ANALYZE` on common queries)
- [ ] No significant slowdown in affected pages

---

## Code Changes Required

After migration is applied, update these files:

| File | Change Required | Priority |
|------|-----------------|----------|
| `src/lib/types.ts` | Add `ReferralClick` interface | HIGH |
| `src/pages/api/referral/create-onboard.ts` | Insert into `referral_clicks` instead of `waitlist` | HIGH |
| `src/app/onboard/[token]/page.tsx` | Create waitlist entry after phone number entered | HIGH |
| `src/pages/api/referral/submit.ts` | Update `referral_clicks.converted` and `waitlist_id` | HIGH |
| `src/pages/admin/membership.tsx` | Add "Referral Analytics" tab | MEDIUM |
| `src/components/admin/ReferralAnalytics.tsx` | Create analytics component (new) | MEDIUM |
| `HOWTO.md` | Document new table in database schema section | LOW |

---

## Implementation Plan

**Phase 1: Migration** ✅ (this file)
1. Create `referral_clicks` table
2. Apply migration in Supabase

**Phase 2: Update Referral Click Tracking** (HIGH priority)
1. Modify `/api/referral/create-onboard.ts`:
   - Instead of creating waitlist entry, create `referral_clicks` entry
   - Return token for tracking purposes
   - Log IP address and user agent

**Phase 3: Update Form Submission** (HIGH priority)
1. Modify onboarding form (after phone number entered):
   - Create waitlist entry with real phone number
   - Update corresponding `referral_clicks` entry: `converted = TRUE`, `waitlist_id = <new_id>`

2. Modify `/api/referral/submit.ts`:
   - After creating waitlist entry, update `referral_clicks` table
   - Set `converted = TRUE` and link `waitlist_id`

**Phase 4: Clean Up Existing Data** (optional)
1. Delete existing "Pending Referral" entries from waitlist:
   ```sql
   DELETE FROM waitlist
   WHERE first_name = 'Pending'
     AND last_name = 'Referral'
     AND phone = '+10000000000';
   ```

**Phase 5: Add Analytics UI** (MEDIUM priority)
1. Create `ReferralAnalytics.tsx` component
2. Add tab in `/admin/membership` page
3. Show:
   - Member name
   - Total clicks
   - Total conversions
   - Conversion rate
   - Recent clicks (unconverted)

---

## Sample Queries for Analytics

```sql
-- Referral clicks by member (for analytics dashboard)
SELECT
  m.first_name,
  m.last_name,
  m.referral_code,
  COUNT(*) as total_clicks,
  COUNT(*) FILTER (WHERE rc.converted = TRUE) as conversions,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE rc.converted = TRUE) / COUNT(*),
    1
  ) as conversion_rate
FROM members m
LEFT JOIN referral_clicks rc ON rc.referred_by_member_id = m.member_id
GROUP BY m.member_id, m.first_name, m.last_name, m.referral_code
ORDER BY total_clicks DESC;

-- Recent unconverted clicks (people who clicked but didn't complete)
SELECT
  m.first_name || ' ' || m.last_name as referrer_name,
  rc.clicked_at,
  rc.ip_address,
  rc.converted
FROM referral_clicks rc
JOIN members m ON m.member_id = rc.referred_by_member_id
WHERE rc.converted = FALSE
ORDER BY rc.clicked_at DESC
LIMIT 20;

-- Conversion funnel
SELECT
  COUNT(*) FILTER (WHERE converted = FALSE) as clicks_no_conversion,
  COUNT(*) FILTER (WHERE converted = TRUE) as completed_forms,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE converted = TRUE) / COUNT(*),
    1
  ) as overall_conversion_rate
FROM referral_clicks;
```

---

## Rollback Plan

**Complexity**: EASY

**Data Loss Risk**: YES - All referral click analytics data will be lost

**Steps**: See `20260406_create_referral_clicks_table_ROLLBACK.sql`

**When to Rollback**:
- Migration causes unexpected errors
- Need to redesign table structure
- Decision to track differently

---

## Notes

**Why separate table instead of adding columns to waitlist?**
- Waitlist is for actionable applications (review/approve/deny)
- Click tracking is pure analytics
- Keeps waitlist clean and focused
- Allows infinite clicks per referral code without clutter

**Why track unconverted clicks?**
- See which members are actively sharing links
- Identify drop-off rates (clicks vs completions)
- Reward members for referral activity even if not converted yet
- Potential for future: "You have 5 people who clicked but didn't complete - send them a reminder?"

**Security Considerations**:
- RLS enabled by default
- Members can see their own analytics (how many clicks their link got)
- Only admins can see all clicks across all members
- System uses service role to insert (bypasses RLS)

---

## Related Documentation

- See HOWTO.md Section 5 (Core Systems) for membership signup flows
- See HOWTO.md Section 17 (Changelog) entry #8 for previous referral tracking attempt
- See `/api/referral/create-onboard.ts` for current implementation
- See `/api/referral/submit.ts` for form submission handling

---
