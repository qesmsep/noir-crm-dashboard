# Stripe Subscription Removal Analysis

## Executive Summary

**Current Problem:** Stripe subscriptions add unnecessary complexity and can get out of sync with the app (e.g., the "trialing" issue with Stacy's account). The app already knows:
- Who needs to be billed
- How much they owe (base + additional members)
- When to bill them

**Solution:** Remove Stripe subscriptions entirely. Use Stripe only for:
1. Payment method storage (`stripe.customers` + `stripe.paymentMethods`)
2. Processing charges (`stripe.paymentIntents.create()`)

---

## Current State Analysis

### 1. Where Stripe Subscriptions Are Created/Updated

**Files that create/modify subscriptions:**
- `src/pages/api/subscriptions/create.ts` - Creates new subscriptions
- `src/pages/api/subscriptions/update-plan.ts` - Changes subscription tier
- `src/pages/api/subscriptions/cancel.ts` - Cancels subscription
- `src/pages/api/subscriptions/pause.ts` - Pauses subscription
- `src/pages/api/subscriptions/resume.ts` - Resumes subscription
- `src/pages/api/subscriptions/reactivate.ts` - Reactivates subscription
- `src/pages/api/members/add-to-account.ts` - Updates subscription when adding members
- `src/pages/api/stripe/payment-methods/set-default.ts` - Updates default payment method on subscription

**What they do:**
- Call `stripe.subscriptions.create()` or `stripe.subscriptions.update()`
- Set trial periods, payment methods, pricing
- Handle prorations when upgrading/downgrading

### 2. Stripe Webhook Handlers

**File:** `src/pages/api/stripe-webhook-subscriptions.ts`

**Events handled:**
- `customer.subscription.created` - New subscription created
- `customer.subscription.updated` - Subscription changed (status, price, etc)
- `customer.subscription.deleted` - Subscription canceled
- `customer.subscription.paused` - Subscription paused
- `customer.subscription.resumed` - Subscription resumed

**What webhooks do:**
- Sync `accounts.subscription_status` from Stripe
- Update `accounts.next_renewal_date`, `monthly_dues`, etc
- Log events to `subscription_events` table
- **This is where sync issues occur** - Stripe status becomes source of truth

### 3. Subscription Status Usage

**Access control:** ❌ **NOT CURRENTLY BLOCKING ACCESS**
- `subscription_status` is only used for:
  - Display badges (UI only)
  - Business metrics/reporting
  - Determining event types (upgrade/downgrade)

**Good news:** The app doesn't currently block access based on `subscription_status`. Members can still access features regardless of Stripe status.

### 4. Current Billing Logic

**Manual charges:**
- `src/pages/api/chargeBalance.js` - Charges ledger balances manually
- `src/pages/api/payment/create-intent.ts` - Creates payment intents for one-time charges
- Uses `stripe.paymentIntents.create()` with stored payment methods

**Subscription charges:**
- Handled automatically by Stripe subscriptions
- Stripe charges the customer monthly
- Webhooks update the app when payment succeeds/fails

### 5. Database Schema

**Existing columns on `accounts` table:**
```sql
- stripe_customer_id TEXT (✅ already exists)
- stripe_subscription_id TEXT (❌ can be removed)
- subscription_status TEXT (✅ keep, but app-managed)
- subscription_start_date TIMESTAMPTZ (✅ keep)
- subscription_cancel_at TIMESTAMPTZ (✅ keep)
- subscription_canceled_at TIMESTAMPTZ (✅ keep)
- next_renewal_date TIMESTAMPTZ (✅ keep - rename to next_billing_date)
- monthly_dues NUMERIC (✅ keep)
- payment_method_type TEXT (✅ keep)
- payment_method_last4 TEXT (✅ keep)
- payment_method_brand TEXT (✅ keep)
- credit_card_fee_enabled BOOLEAN (✅ keep)
```

**Schema changes needed:**
- ✅ Remove `stripe_subscription_id` column (or keep NULL)
- ✅ Rename `next_renewal_date` → `next_billing_date`
- ✅ Add `last_billing_attempt` TIMESTAMPTZ
- ✅ Add `billing_retry_count` INTEGER DEFAULT 0
- ✅ Add `last_payment_failed_at` TIMESTAMPTZ

---

## What Needs to Be Built

### 1. Monthly Billing Cron Job

**Purpose:** Replace Stripe's automatic subscription billing

**File:** `src/cron/monthly-billing.ts`

**Logic:**
```typescript
// Run daily at 2 AM
async function processDailyBilling() {
  const today = getTodayLocalDate();

  // Find accounts where next_billing_date is today
  const { data: accountsToBill } = await supabase
    .from('accounts')
    .select('*')
    .eq('next_billing_date', today)
    .eq('subscription_status', 'active');

  for (const account of accountsToBill) {
    try {
      // 1. Calculate amount owed (base + additional members)
      const amount = await calculateMonthlyDues(account.account_id);

      // 2. Get payment method
      const paymentMethod = await getDefaultPaymentMethod(account.stripe_customer_id);

      if (!paymentMethod) {
        await handleMissingPaymentMethod(account);
        continue;
      }

      // 3. Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount * 100, // cents
        currency: 'usd',
        customer: account.stripe_customer_id,
        payment_method: paymentMethod,
        off_session: true,
        confirm: true,
        description: `Monthly dues for ${account.account_name}`,
        metadata: {
          account_id: account.account_id,
          billing_period: today
        }
      });

      if (paymentIntent.status === 'succeeded') {
        // 4. Update next billing date (+1 month)
        await supabase
          .from('accounts')
          .update({
            next_billing_date: addMonths(today, 1),
            last_billing_attempt: new Date(),
            billing_retry_count: 0
          })
          .eq('account_id', account.account_id);

        // 5. Log to ledger
        await logPaymentToLedger(account, paymentIntent);

      } else {
        // Payment failed
        await handlePaymentFailure(account, paymentIntent);
      }

    } catch (error) {
      console.error(`Failed to bill account ${account.account_id}:`, error);
      await handlePaymentFailure(account, error);
    }
  }
}
```

### 2. Failed Payment Retry Logic

**Purpose:** Replace Stripe's smart dunning/retry system

**File:** `src/cron/retry-failed-payments.ts`

**Logic:**
```typescript
// Run daily at 3 AM (after billing cron)
async function retryFailedPayments() {
  // Find accounts with past_due status and retry_count < 4
  const { data: failedAccounts } = await supabase
    .from('accounts')
    .select('*')
    .eq('subscription_status', 'past_due')
    .lt('billing_retry_count', 4);

  for (const account of failedAccounts) {
    const daysSinceFailure = daysBetween(account.last_payment_failed_at, new Date());

    // Retry schedule: Day 3, 5, 7, 10
    const shouldRetry =
      (daysSinceFailure === 3 && account.billing_retry_count === 0) ||
      (daysSinceFailure === 5 && account.billing_retry_count === 1) ||
      (daysSinceFailure === 7 && account.billing_retry_count === 2) ||
      (daysSinceFailure === 10 && account.billing_retry_count === 3);

    if (!shouldRetry) continue;

    try {
      // Retry payment
      const result = await chargeAccount(account);

      if (result.success) {
        // Payment succeeded
        await supabase
          .from('accounts')
          .update({
            subscription_status: 'active',
            next_billing_date: addMonths(account.next_billing_date, 1),
            billing_retry_count: 0,
            last_billing_attempt: new Date()
          })
          .eq('account_id', account.account_id);

        // Send success notification
        await sendPaymentSuccessNotification(account);

      } else {
        // Still failed
        await supabase
          .from('accounts')
          .update({
            billing_retry_count: account.billing_retry_count + 1,
            last_billing_attempt: new Date()
          })
          .eq('account_id', account.account_id);

        // Cancel subscription if max retries reached
        if (account.billing_retry_count + 1 >= 4) {
          await cancelSubscription(account.account_id, 'Max retries exceeded');
        }
      }

    } catch (error) {
      console.error(`Retry failed for account ${account.account_id}:`, error);
    }
  }
}
```

### 3. Helper Functions

**File:** `src/lib/billing.ts`

```typescript
export async function calculateMonthlyDues(account_id: string): Promise<number> {
  // 1. Get account to find base subscription
  const { data: account } = await supabase
    .from('accounts')
    .select('monthly_dues')
    .eq('account_id', account_id)
    .single();

  // monthly_dues already includes base + additional members
  return account.monthly_dues || 0;
}

export async function getDefaultPaymentMethod(stripe_customer_id: string): Promise<string | null> {
  const customer = await stripe.customers.retrieve(stripe_customer_id);
  return customer.invoice_settings?.default_payment_method || null;
}

export async function handlePaymentFailure(account: any, error: any) {
  // Update account to past_due
  await supabase
    .from('accounts')
    .update({
      subscription_status: 'past_due',
      last_payment_failed_at: new Date(),
      last_billing_attempt: new Date()
    })
    .eq('account_id', account.account_id);

  // Send notification to member
  await sendPaymentFailedNotification(account, error);

  // Log to subscription_events
  await supabase.from('subscription_events').insert({
    account_id: account.account_id,
    event_type: 'payment_failed',
    effective_date: new Date(),
    metadata: { error: error.message }
  });
}

export async function logPaymentToLedger(account: any, paymentIntent: any) {
  await supabase.from('ledger').insert({
    account_id: account.account_id,
    type: 'payment',
    amount: -paymentIntent.amount / 100,
    date: getTodayLocalDate(),
    note: `Monthly dues - ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
    stripe_charge_id: paymentIntent.charges?.data[0]?.id,
    stripe_payment_intent_id: paymentIntent.id
  });
}
```

### 4. Migration Script

**File:** `migrations/remove_stripe_subscriptions.sql`

```sql
-- Add new billing columns
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS last_billing_attempt TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS billing_retry_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_payment_failed_at TIMESTAMPTZ;

-- Rename next_renewal_date to next_billing_date
ALTER TABLE accounts
  RENAME COLUMN next_renewal_date TO next_billing_date;

-- Remove Stripe subscription references (keep column but set to NULL)
UPDATE accounts SET stripe_subscription_id = NULL;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_accounts_next_billing_date
  ON accounts(next_billing_date)
  WHERE subscription_status = 'active';

CREATE INDEX IF NOT EXISTS idx_accounts_past_due
  ON accounts(subscription_status, billing_retry_count)
  WHERE subscription_status = 'past_due';
```

### 5. Update Existing APIs

**Files to modify:**

**`src/pages/api/subscriptions/create.ts`**
- Remove `stripe.subscriptions.create()`
- Instead: Set `next_billing_date` and `subscription_status` in database
- Optionally charge immediately if `charge_immediately` flag is set

**`src/pages/api/subscriptions/cancel.ts`**
- Remove `stripe.subscriptions.update()`
- Update `accounts.subscription_status = 'canceled'`
- Set `subscription_canceled_at`

**`src/pages/api/subscriptions/pause.ts`**
- Remove `stripe.subscriptions.update()`
- Update `accounts.subscription_status = 'paused'`

**`src/pages/api/subscriptions/update-plan.ts`**
- Remove `stripe.subscriptions.update()`
- Update `accounts.monthly_dues` in database
- Recalculate based on new plan + existing members

**`src/pages/api/members/add-to-account.ts`**
- Remove Stripe subscription item updates
- Just update `accounts.monthly_dues` (+$25 per member)

**`src/pages/api/stripe-webhook-subscriptions.ts`**
- ❌ **DELETE THIS ENTIRE FILE** - no longer needed

### 6. Cron Job Setup

**Deployment options:**

**Option A: Vercel Cron Jobs**
```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/monthly-billing",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/cron/retry-failed-payments",
      "schedule": "0 3 * * *"
    }
  ]
}
```

**Option B: GitHub Actions**
```yaml
# .github/workflows/monthly-billing.yml
name: Monthly Billing
on:
  schedule:
    - cron: '0 2 * * *'
jobs:
  billing:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger billing
        run: curl -X POST ${{ secrets.BILLING_CRON_URL }}
```

---

## Concerns & Solutions

### Concern 1: "Stripe won't charge the correct amount for multiple members"

**Current problem:**
- When you create a subscription via `/api/subscriptions/create`, it only adds the base price
- Additional members are supposed to be added as separate line items
- But there's a timing issue - the subscription gets created before additional member line items are added

**Solution with new approach:**
- App calculates `monthly_dues = basePlan + (secondaryMembers * $25)`
- Stored in `accounts.monthly_dues`
- Cron job reads this value and charges exactly that amount
- **No sync issues** - app is always source of truth

### Concern 2: "PCI compliance and card security"

**Solution:**
- Still using Stripe for payment processing
- Never touching raw card data
- Stripe Elements for card collection
- `stripe.paymentIntents.create()` is PCI-compliant

### Concern 3: "What if cron job fails?"

**Solution:**
- Billing cron runs daily, checks for `next_billing_date = today`
- If it misses a day, it'll catch up the next day
- Add monitoring/alerts for failed billing runs
- Log all billing attempts to `subscription_events` table

### Concern 4: "Losing Stripe's smart retry logic"

**Tradeoff:**
- Stripe's dunning is sophisticated (ML-based retry timing, email templates, etc)
- Our simple retry schedule (days 3, 5, 7, 10) is adequate for most cases
- **Alternative:** Keep using Stripe Invoices (not subscriptions) for automatic retries
  - Create invoice monthly with `stripe.invoices.create()`
  - Stripe handles retries and emails
  - Still gives you control over amounts/timing

---

## Recommended Approach

### Phase 1: Test with manual billing (1-2 weeks)
1. Build cron jobs for billing + retries
2. Deploy to staging environment
3. Test with a few test accounts
4. Monitor for issues

### Phase 2: Parallel run (1 month)
1. Keep Stripe subscriptions active
2. Also run cron jobs (but don't charge - just log what *would* happen)
3. Compare results - do amounts match?
4. Verify timing is correct

### Phase 3: Cutover (1 day)
1. Cancel all Stripe subscriptions (keep customers/payment methods)
2. Enable cron job charging
3. Monitor closely for first week

### Phase 4: Cleanup (ongoing)
1. Remove webhook handler
2. Remove unused subscription APIs
3. Update UI to remove Stripe-specific language

---

## Effort Estimate

**Development:** 3-4 days
- Cron jobs: 1 day
- API updates: 1 day
- Migration: 0.5 days
- Testing: 1-2 days

**Testing/Validation:** 1-2 weeks
- Parallel run validation
- Edge case testing

**Total:** 2-3 weeks to full cutover

---

## Alternative: Keep Stripe Invoices (Simpler)

**Instead of full cron jobs, use Stripe Invoices:**

```typescript
// Monthly billing cron
async function createMonthlyInvoices() {
  const accountsToBill = await getAccountsDueToday();

  for (const account of accountsToBill) {
    // Calculate amount (base + members)
    const amount = account.monthly_dues;

    // Create invoice (Stripe handles collection/retries)
    const invoice = await stripe.invoices.create({
      customer: account.stripe_customer_id,
      auto_advance: true, // Automatically finalize and pay
      collection_method: 'charge_automatically'
    });

    // Add line item
    await stripe.invoiceItems.create({
      customer: account.stripe_customer_id,
      invoice: invoice.id,
      amount: amount * 100,
      currency: 'usd',
      description: 'Monthly membership dues'
    });

    // Finalize and charge
    await stripe.invoices.finalizeInvoice(invoice.id);
  }
}
```

**Benefits:**
- ✅ Stripe handles retries, dunning, emails
- ✅ Invoices show itemized charges
- ✅ Less code to maintain
- ✅ Keep some Stripe automation

**Tradeoffs:**
- ⚠️ Still relies on Stripe for billing logic
- ⚠️ Still need webhook for `invoice.payment_succeeded`/`invoice.payment_failed`

---

## Recommendation

**Try the Invoice approach first** - it's a middle ground:
- App controls amounts and timing
- Stripe handles collection/retries
- Less custom code to maintain
- Easier to test/validate

If you still want full control, build the cron job approach.
