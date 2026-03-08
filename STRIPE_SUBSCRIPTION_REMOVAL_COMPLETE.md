# Stripe Subscription Removal - Implementation Complete ✅

## What Was Built

All code has been written to remove Stripe subscriptions and replace with app-managed billing. The app now:
- Calculates monthly dues (base + additional members)
- Charges members monthly via cron jobs
- Handles failed payment retries automatically
- Tracks billing in the database

---

## Files Created

### 1. Database Migration
**File:** `migrations/remove_stripe_subscriptions.sql`
- Adds `last_billing_attempt`, `billing_retry_count`, `last_payment_failed_at` columns
- Renames `next_renewal_date` → `next_billing_date`
- Adds indexes for billing queries

### 2. Billing Helper Functions
**File:** `src/lib/billing.ts`
- `calculateMonthlyDues()` - Gets monthly dues from accounts table
- `getDefaultPaymentMethod()` - Retrieves payment method from Stripe customer
- `chargeAccount()` - Charges account using PaymentIntent
- `logPaymentToLedger()` - Records payment in ledger
- `handlePaymentFailure()` - Updates status, sends notifications
- `sendPaymentFailedNotification()` - SMS notification on failure
- `sendPaymentSuccessNotification()` - SMS on recovery
- `cancelSubscription()` - Marks subscription as canceled
- `addMonths()` / `daysBetween()` - Date utilities

### 3. Monthly Billing Cron Job
**File:** `src/pages/api/cron/monthly-billing.ts`
- Runs daily at 7 AM UTC
- Finds accounts where `next_billing_date = today`
- Charges each account their `monthly_dues` amount
- Updates `next_billing_date` to +1 month on success
- Sets status to `past_due` on failure
- Logs all attempts to `subscription_events`

**Schedule:** `0 7 * * *` (7 AM UTC = 1 AM CST)

### 4. Failed Payment Retry Cron Job
**File:** `src/pages/api/cron/retry-failed-payments.ts`
- Runs daily at 8 AM UTC (after billing cron)
- Finds accounts with `subscription_status = 'past_due'`
- Retry schedule: Days 3, 5, 7, 10
- Reactivates account if payment succeeds
- Cancels subscription after 4 failed retries

**Schedule:** `0 8 * * *` (8 AM UTC = 2 AM CST)

---

## Files Modified

### 5. Create Subscription API (NO Stripe subscription)
**File:** `src/pages/api/subscriptions/create.ts`
- Creates app-managed subscription in database
- Calculates `monthly_dues = basePlan + (secondaryMembers * $25)`
- Sets `next_billing_date` to +1 month
- Optionally charges first month if `charge_immediately = true`
- No longer calls `stripe.subscriptions.create()`

### 6. Cancel Subscription API
**File:** `src/pages/api/subscriptions/cancel.ts`
- Updates `subscription_status = 'canceled'` in database
- Option to cancel immediately or at end of period
- No longer calls `stripe.subscriptions.update/cancel()`

### 7. Pause Subscription API
**File:** `src/pages/api/subscriptions/pause.ts`
- Updates `subscription_status = 'paused'`
- Clears `next_billing_date` (no charges while paused)
- No longer calls `stripe.subscriptions.update()`

### 8. Resume Subscription API
**File:** `src/pages/api/subscriptions/resume.ts`
- Updates `subscription_status = 'active'`
- Sets `next_billing_date` to +1 month from today
- No longer calls `stripe.subscriptions.update()`

### 9. Update Plan API
**File:** `src/pages/api/subscriptions/update-plan.ts`
- Recalculates `monthly_dues` based on new plan + existing members
- Updates immediately (no proration needed - app-managed)
- No longer calls `stripe.subscriptions.update()`

### 10. Cron Configuration
**File:** `vercel.json`
- Added `/api/cron/monthly-billing` (7 AM daily)
- Added `/api/cron/retry-failed-payments` (8 AM daily)
- Set `maxDuration: 60s` for both cron jobs

---

## What Still Needs to Be Done

### **CRITICAL: Run Database Migration**
```bash
# Connect to production database
psql $DATABASE_URL -f migrations/remove_stripe_subscriptions.sql
```

**Verify migration:**
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'accounts'
AND column_name IN ('last_billing_attempt', 'billing_retry_count', 'last_payment_failed_at', 'next_billing_date')
ORDER BY ordinal_position;
```

### **Set CRON_SECRET Environment Variable**
For security, the cron jobs check for an authorization header.

1. Generate a secret:
   ```bash
   openssl rand -hex 32
   ```

2. Add to Vercel environment variables:
   ```
   CRON_SECRET=<generated-secret>
   ```

3. Vercel automatically adds this header when calling cron jobs

---

## Testing Plan

### Phase 1: Test Cron Jobs Manually (Before Deployment)

**Test monthly billing:**
```bash
# Set today's date as next_billing_date for a test account
UPDATE accounts
SET next_billing_date = '2026-03-06'
WHERE account_id = '<test-account-id>';

# Call cron job locally
curl -X POST http://localhost:3000/api/cron/monthly-billing \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

**Expected result:**
- Account is charged
- `next_billing_date` updated to April 6
- Payment logged to ledger
- Event logged to `subscription_events`

**Test failed payment retry:**
```bash
# Set an account to past_due with failure date 3 days ago
UPDATE accounts
SET subscription_status = 'past_due',
    last_payment_failed_at = NOW() - INTERVAL '3 days',
    billing_retry_count = 0
WHERE account_id = '<test-account-id>';

# Call retry cron
curl -X POST http://localhost:3000/api/cron/retry-failed-payments \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

**Expected result:**
- Retry attempted (it's day 3)
- If payment succeeds: status set to 'active', billing date moved forward
- If payment fails: retry count incremented to 1

### Phase 2: Parallel Run (Recommended)

**Before disabling Stripe subscriptions:**

1. Deploy the new code (cron jobs + updated APIs)
2. Keep existing Stripe subscriptions active
3. Run cron jobs in "dry run" mode for 1 week:
   - Modify cron jobs to NOT actually charge, just log what would happen
   - Compare results with Stripe subscription charges
   - Verify amounts match

4. Monitor for discrepancies

### Phase 3: Cutover

**When ready to go live:**

1. ✅ Ensure all tests pass
2. ✅ Verify cron jobs are scheduled in Vercel
3. ✅ Set `CRON_SECRET` environment variable

4. **For existing subscriptions:**
   - Option A: Cancel all Stripe subscriptions (keep customers/payment methods)
   - Option B: Let them naturally expire, new subscriptions use app-managed

5. Monitor closely for first week:
   - Check cron job logs daily
   - Verify charges are processing correctly
   - Watch for failed payments

---

## What Changed for Members

**Nothing visible to members!**

- They still get charged monthly
- Failure notifications still sent via SMS
- Retry logic still works
- Payment methods stored in Stripe (same security)

**Behind the scenes:**
- App controls when/how much to charge (not Stripe subscriptions)
- More predictable billing (no sync issues like "trialing" bug)
- Correct amounts for multi-member accounts

---

## Rollback Plan

If something goes wrong:

1. **Revert API changes:**
   ```bash
   git revert <commit-hash>
   git push
   ```

2. **Re-enable Stripe subscriptions:**
   - Use old `/api/subscriptions/create` logic
   - Recreate subscriptions for affected accounts

3. **Database rollback:**
   ```sql
   -- Remove new columns (optional - they won't be used)
   ALTER TABLE accounts DROP COLUMN IF EXISTS last_billing_attempt;
   ALTER TABLE accounts DROP COLUMN IF EXISTS billing_retry_count;
   ALTER TABLE accounts DROP COLUMN IF EXISTS last_payment_failed_at;
   ```

---

## Monitoring Checklist

After deployment, monitor:

- ✅ Cron job execution logs (Vercel dashboard)
- ✅ Failed payment count (should be similar to before)
- ✅ Member complaints about billing
- ✅ Ledger entries match charges
- ✅ Subscription events logged correctly

**Check queries:**

```sql
-- Accounts with upcoming billing
SELECT account_id, next_billing_date, monthly_dues, subscription_status
FROM accounts
WHERE next_billing_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
ORDER BY next_billing_date;

-- Past due accounts
SELECT account_id, subscription_status, billing_retry_count, last_payment_failed_at
FROM accounts
WHERE subscription_status = 'past_due'
ORDER BY last_payment_failed_at DESC;

-- Recent billing events
SELECT account_id, event_type, new_mrr, effective_date, metadata
FROM subscription_events
WHERE effective_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY effective_date DESC;
```

---

## Benefits of This Approach

✅ **No sync issues** - App is source of truth, not Stripe
✅ **Correct amounts** - Always charges base + additional members
✅ **Full control** - You decide when/how much to charge
✅ **Simpler** - No Stripe subscription webhooks to handle
✅ **Transparent** - Easy to see what will be charged when
✅ **Failure details** - Access to decline codes, retry logic

---

## Questions?

Common questions answered in `STRIPE_SUBSCRIPTION_REMOVAL_ANALYSIS.md`

**Key points:**
- Stripe still securely stores payment methods
- Stripe still processes charges (via PaymentIntent)
- PCI compliance maintained
- You just control the billing logic instead of Stripe subscriptions
