# Stripe Webhook - Pre-Configuration Safety Checklist

**CRITICAL**: Complete this checklist BEFORE configuring the Stripe webhook in production.

---

## ⚠️ Why This Matters

The Stripe webhook will **automatically sync subscription changes** from Stripe to your database. This includes:
- Subscription creations
- Plan changes (upgrades/downgrades)
- Cancellations
- Payment method updates

**We want to avoid**:
- Accidentally triggering subscription creations for all members
- Unexpected charges
- Database corruption from incorrect data

---

## ✅ Pre-Flight Safety Checklist

### 1. Database State Verification

- [ ] **Verify migrations applied successfully**
  ```bash
  node verify-migrations.js
  ```
  Expected: All tables exist (subscription_events, stripe_webhook_events, subscription_plans)

- [ ] **Check members table has new columns**
  ```sql
  SELECT stripe_subscription_id, subscription_status
  FROM members
  LIMIT 5;
  ```
  Expected: Columns exist, values are NULL (before sync)

- [ ] **Verify subscription_plans configured**
  ```sql
  SELECT plan_name, stripe_price_id
  FROM subscription_plans;
  ```
  Expected: 4 plans with real Stripe price IDs (not "REPLACE_WITH...")

---

### 2. Webhook Handler Testing (Development)

- [ ] **Start dev server locally**
  ```bash
  npm run dev
  ```

- [ ] **Use Stripe CLI to forward webhooks**
  ```bash
  stripe listen --forward-to localhost:3000/api/stripe-webhook-subscriptions
  ```

- [ ] **Copy webhook signing secret from Stripe CLI output**
  Add to `.env.local`:
  ```
  STRIPE_WEBHOOK_SECRET=whsec_xxxxx
  ```

- [ ] **Trigger test event**
  ```bash
  stripe trigger customer.subscription.updated
  ```

- [ ] **Verify webhook processed**
  Check console logs for:
  - "Webhook received"
  - No errors
  - Event stored in `stripe_webhook_events` table

- [ ] **Check database updated**
  ```sql
  SELECT * FROM stripe_webhook_events ORDER BY created_at DESC LIMIT 1;
  ```
  Expected: Test event logged with `processed = true`

---

### 3. Subscription Card Testing (UI)

- [ ] **Navigate to member detail page**
  Example: `/admin/members/[accountId]`

- [ ] **Verify subscription card displays**
  Should show "No active subscription" (before sync)

- [ ] **Check console for errors**
  Open browser DevTools → Console
  Expected: No red errors

- [ ] **Test mobile responsive**
  Resize browser to 375px width
  Expected: Card displays correctly, buttons touchable (44px height)

---

### 4. API Endpoint Testing (Manual)

Test each API endpoint manually before webhook goes live:

#### Cancel Subscription API
```bash
curl -X PUT http://localhost:3000/api/subscriptions/cancel \
  -H "Content-Type: application/json" \
  -d '{
    "member_id": "test-member-id",
    "cancel_at_period_end": true
  }'
```

- [ ] Returns error "Member or subscription not found" (expected for non-existent member)
- [ ] Does NOT crash
- [ ] Does NOT charge anyone

#### Payment Methods List API
```bash
curl "http://localhost:3000/api/stripe/payment-methods/list?member_id=test-member-id"
```

- [ ] Returns error "Member or Stripe customer not found" (expected)
- [ ] Does NOT crash

---

### 5. Sync Script Dry Run (Optional)

**Only if you have existing Stripe subscriptions to backfill:**

- [ ] **Review sync script output WITHOUT running**
  ```bash
  # Just read it, don't run yet
  cat scripts/sync-stripe-subscriptions.js
  ```

- [ ] **Understand what it does**:
  - Fetches subscriptions from Stripe
  - Matches by `stripe_customer_id`
  - Updates members table
  - Creates subscription_events

- [ ] **When you're ready, run it**:
  ```bash
  node scripts/sync-stripe-subscriptions.js
  ```

- [ ] **Verify output**:
  - Shows count of synced subscriptions
  - No errors
  - "Skipped" count matches members without Stripe customers

- [ ] **Check database after sync**:
  ```sql
  SELECT
    first_name,
    last_name,
    subscription_status,
    monthly_dues,
    payment_method_type
  FROM members
  WHERE stripe_subscription_id IS NOT NULL
  LIMIT 10;
  ```
  Expected: Real subscription data populated

---

### 6. Production Environment Checks

- [ ] **Verify environment variables in production**
  Vercel Dashboard → Your Project → Settings → Environment Variables
  Required:
  - `STRIPE_SECRET_KEY` (starts with `sk_live_`)
  - `STRIPE_WEBHOOK_SECRET` (will add after webhook created)
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

- [ ] **Confirm LIVE mode Stripe keys**
  Dashboard → Developers → API Keys
  Make sure you're using **LIVE** keys, not test keys

- [ ] **Check Supabase RLS policies**
  - Admins can insert subscription_events ✅
  - Admins can update members table ✅
  - System can insert stripe_webhook_events ✅

---

### 7. Webhook Event Selection (Critical)

When creating the webhook endpoint, **ONLY select these events**:

✅ **Safe Events** (auto-sync subscription data):
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.paused`
- `customer.subscription.resumed`
- `invoice.payment_failed`
- `invoice.payment_succeeded`

❌ **Do NOT enable** (could trigger unintended actions):
- `customer.created` (might trigger auto-subscription creation)
- `payment_intent.succeeded` (could process unintended payments)
- `charge.succeeded` (could create duplicate ledger entries)

---

### 8. Rollback Plan

**If something goes wrong after webhook configuration:**

#### Immediate Actions
1. **Disable webhook in Stripe Dashboard**
   - Stripe Dashboard → Developers → Webhooks
   - Click on your endpoint
   - Click "Disable endpoint"

2. **Check for errors in Stripe webhook logs**
   - Stripe Dashboard → Developers → Webhooks → Your endpoint
   - View "Events" tab
   - Look for 4xx or 5xx errors

3. **Check database for incorrect data**
   ```sql
   SELECT * FROM stripe_webhook_events
   WHERE error_message IS NOT NULL
   ORDER BY created_at DESC;
   ```

4. **Check Supabase logs**
   - Supabase Dashboard → Logs → API Logs
   - Filter by "stripe-webhook-subscriptions"

#### Rollback Database (If Needed)
```sql
-- View what was changed
SELECT * FROM subscription_events
WHERE created_at > '2026-02-24 00:00:00'
ORDER BY created_at DESC;

-- If needed, manually revert members table
-- (Discuss with team first!)
```

---

## ✅ Final Go/No-Go Decision

**Answer these questions before proceeding:**

1. ✅ Have you tested the webhook handler in development with Stripe CLI?
2. ✅ Have you verified the subscription card displays correctly?
3. ✅ Have you run the sync script and verified data looks correct?
4. ✅ Have you tested cancel/reactivate functionality manually?
5. ✅ Do you have a backup of your database (Supabase auto-backups enabled)?
6. ✅ Is it during business hours so you can monitor the webhook?
7. ✅ Do you have access to Stripe Dashboard to disable webhook if needed?

**If YES to all above → Proceed with webhook configuration**

**If NO to any → STOP and complete that step first**

---

## 🚀 Webhook Configuration Steps (When Ready)

### Step 1: Create Webhook Endpoint

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. Enter URL: `https://your-production-domain.vercel.app/api/stripe-webhook-subscriptions`
4. Select ONLY the 7 safe events listed above
5. Click "Add endpoint"

### Step 2: Add Signing Secret

1. Copy the "Signing secret" (starts with `whsec_`)
2. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
3. Add new variable:
   - Key: `STRIPE_WEBHOOK_SECRET`
   - Value: `whsec_xxxxxxxxxxxxx`
4. Redeploy your app (Vercel will auto-deploy when env var added)

### Step 3: Test Webhook

1. In Stripe Dashboard, click "Send test webhook"
2. Select `customer.subscription.updated`
3. Click "Send test webhook"
4. Check webhook logs: Should show 200 response
5. Check database:
   ```sql
   SELECT * FROM stripe_webhook_events
   ORDER BY created_at DESC
   LIMIT 1;
   ```
   Expected: Test event logged with `processed = true`

### Step 4: Monitor for 24 Hours

- Check Stripe webhook logs hourly
- Check Supabase logs for errors
- Verify subscription changes sync correctly
- Verify no unexpected charges or subscription creations

---

## 📞 Emergency Contacts

**If webhook causes issues:**

1. **Disable webhook immediately** (Stripe Dashboard)
2. **Check Vercel logs** (Vercel Dashboard → Your Project → Logs)
3. **Check Supabase logs** (Supabase Dashboard → Logs)
4. **Review `stripe_webhook_events` table** for error messages
5. **Contact team** before manual database changes

---

## 🎓 What You've Built (Recap)

Before webhook configuration, you have:

✅ Database schema with subscription tracking
✅ Webhook handler (code ready, not configured)
✅ Sync script (run when ready)
✅ Payment method APIs (tested)
✅ Subscription management APIs (tested)
✅ Subscription card UI (visible on member pages)
✅ Business metrics (ready to show accurate data)

**After webhook configuration**, you'll have:
✅ Real-time auto-sync from Stripe to database
✅ Accurate subscription tracking
✅ Audit trail of all subscription events

---

**Take your time. Test thoroughly. When you're confident, proceed with webhook configuration.**
