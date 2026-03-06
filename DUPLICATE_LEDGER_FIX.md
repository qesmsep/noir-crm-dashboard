# Duplicate Ledger Entry Fix

## Problem
Subscription renewals were being logged twice in the Account Ledger:
- One entry: "Manual payment: Subscription" (from old webhook)
- Another entry: "Subscription Payment (inv_xxx)" (from new webhook)

## Root Cause
Two webhook handlers were both processing subscription payment events:

1. **Old Handler** (`/api/stripe-webhook.js`):
   - Was listening for `invoice.paid` events (subscription renewals)
   - Was listening for `payment_intent.succeeded` events (manual charges + subscriptions!)
   - Created entries with note "Manual payment: Subscription"

2. **New Handler** (`/api/stripe-webhook-subscriptions.ts`):
   - Listens for `invoice.payment_succeeded` events (subscription renewals)
   - Was only checking for duplicates by `stripe_charge_id`
   - Did not detect duplicates from old handler

When a subscription renewed:
- Stripe fired `invoice.payment_succeeded` → new webhook created ledger entry
- Stripe fired `payment_intent.succeeded` → old webhook also created ledger entry
- Result: **TWO ledger entries for the same payment**

## Solution

### Code Changes

#### 1. Old Webhook (`/api/stripe-webhook.js`)

**Removed:**
- ❌ Entire `invoice.paid` handler (was lines 278-354)
  - This event is now exclusively handled by the new webhook

**Updated:**
- ✅ `payment_intent.succeeded` handler (line 292-296):
  ```javascript
  // Skip payment intents associated with invoices (subscription payments)
  if (paymentIntent.invoice) {
    console.log('Skipping payment intent associated with invoice');
    return res.json({ received: true, skipped: 'subscription payment' });
  }
  ```
  - Now **only** processes manual one-off charges
  - Ignores subscription-related payment intents

#### 2. New Webhook (`/api/stripe-webhook-subscriptions.ts`)

**Enhanced Duplicate Detection** (lines 592-624):
- ✅ Now checks for both `stripe_charge_id` AND `stripe_invoice_id`
- ✅ Prevents duplicates from either webhook handler
- ✅ Prevents duplicate webhook retries

**Store Invoice ID** (line 649):
- ✅ Now stores `stripe_invoice_id` in addition to `stripe_charge_id`
- ✅ Enables proper duplicate detection across both webhooks

### Database Cleanup
Run the cleanup script to remove existing duplicates:

```bash
psql $DATABASE_URL < scripts/remove-duplicate-ledger-entries.sql
```

This script:
1. Shows all duplicate subscription payments
2. Deletes duplicates (keeps the first entry by `created_at`)
3. Verifies cleanup was successful

## Prevention

### Multiple Layers of Protection:

1. **Event Separation**
   - Old webhook: `checkout.session.completed`, `payment_intent.succeeded` (non-invoice only)
   - New webhook: `invoice.payment_succeeded`, subscription lifecycle events
   - No overlapping event handlers

2. **Invoice Check** (Old Webhook)
   - Skips any `payment_intent` with `invoice` field
   - Ensures subscription payments are handled exclusively by new webhook

3. **Duplicate Detection** (New Webhook)
   - Checks `stripe_charge_id` (prevents charge duplicates)
   - Checks `stripe_invoice_id` (prevents invoice duplicates)
   - Checks by date/amount/account (prevents any missed duplicates)

4. **Idempotency** (Both Webhooks)
   - Stores events in `stripe_webhook_events` by `stripe_event_id`
   - Rejects duplicate webhook deliveries

## Testing

### Test 1: Subscription Renewal
```bash
# In Stripe Dashboard → Developers → Events → Send test event
# Select: invoice.payment_succeeded
```

**Expected Result:**
- ✅ ONE ledger entry: "Subscription Payment (inv_xxx)"
- ✅ New webhook logs: "Payment recorded"
- ✅ Old webhook logs: "Skipping payment intent associated with invoice" (if payment_intent fires)

### Test 2: Manual One-Off Charge
```bash
# Create a payment link or use Stripe Terminal
# Charge a customer without creating an invoice
```

**Expected Result:**
- ✅ ONE ledger entry: "Manual payment: [description]"
- ✅ Old webhook processes it
- ✅ New webhook does not receive the event

### Test 3: New Member Signup
```bash
# Complete checkout flow for new member
```

**Expected Result:**
- ✅ ONE ledger entry: "Noir Membership Dues"
- ✅ Old webhook processes it
- ✅ Member status set to 'active'
- ✅ Welcome SMS sent

## Webhook Responsibilities

See `WEBHOOK_ARCHITECTURE.md` for complete documentation of the two-webhook system.

**Summary:**
- **Old webhook** = Non-subscription payments (signups, manual charges, ACH)
- **New webhook** = All subscription events (renewals, lifecycle, ledger entries)
