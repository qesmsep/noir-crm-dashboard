# Stripe Webhook Architecture

## Overview
This system uses **TWO separate Stripe webhooks** with clear, non-overlapping responsibilities to handle all payment events.

---

## Webhook 1: `/api/stripe-webhook.js`
**Purpose:** Non-subscription payments (new signups, manual charges, ACH)

### Events Handled:
- ✅ `checkout.session.completed` - New member signups
- ✅ `payment_intent.succeeded` - Manual one-off charges (ONLY if not associated with invoice)
- ✅ `charge.succeeded` - ACH charges
- ✅ `charge.failed` - ACH failures
- ✅ `charge.dispute.created` - ACH disputes
- ✅ `charge.dispute.updated` - ACH dispute updates
- ✅ `payment_method.automatically_updated` - Payment method updates

### Ledger Entry Format:
- New signup: `"Noir Membership Dues"`
- Manual charge: `"Manual payment: [description]"`
- ACH payment: `"ACH payment: [description]"`

### Key Logic:
- **Skips payment intents with `invoice` field** (those are subscriptions)
- Stores `stripe_payment_intent_id` in ledger
- Sends welcome SMS on new signup

---

## Webhook 2: `/api/stripe-webhook-subscriptions.ts`
**Purpose:** All subscription-related events (renewals, lifecycle, ledger entries)

### Events Handled:
- ✅ `customer.subscription.created` - New subscription
- ✅ `customer.subscription.updated` - Plan changes, status updates
- ✅ `customer.subscription.deleted` - Cancellations
- ✅ `customer.subscription.paused` - Pause subscription
- ✅ `customer.subscription.resumed` - Resume subscription
- ✅ `invoice.payment_succeeded` - Subscription renewal payments
- ✅ `invoice.payment_failed` - Failed subscription payments
- ✅ `invoice.created` - Add 4% credit card fee (if enabled)

### Ledger Entry Format:
- Subscription payment: `"Subscription Payment (inv_xxx)"`
- Processing fee: `"4% Credit Card Processing Fee"`

### Key Logic:
- Updates `accounts` table with subscription status
- Logs events to `subscription_events` audit table
- Applies 4% fee for card payments (if account has `credit_card_fee_enabled`)
- Checks for duplicates by both `stripe_charge_id` AND `stripe_invoice_id`
- Stores both `stripe_charge_id` and `stripe_invoice_id` in ledger

---

## Stripe Dashboard Configuration

### Webhook 1 URL:
```
https://your-domain.vercel.app/api/stripe-webhook
```

**Selected Events:**
- `checkout.session.completed`
- `payment_intent.succeeded`
- `charge.succeeded`
- `charge.failed`
- `charge.dispute.created`
- `charge.dispute.updated`
- `payment_method.automatically_updated`

**Environment Variable:**
```
STRIPE_WEBHOOK_SECRET=whsec_xxx...
```

---

### Webhook 2 URL:
```
https://your-domain.vercel.app/api/stripe-webhook-subscriptions
```

**Selected Events:**
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.paused`
- `customer.subscription.resumed`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `invoice.created`

**Environment Variable:**
```
STRIPE_WEBHOOK_SECRET_SUBSCRIPTIONS=whsec_yyy...
```
(Or use same secret if both webhooks share one)

---

## Duplicate Prevention

### How Duplicates Are Prevented:

1. **Different Event Types**
   - Webhook 1 listens for `payment_intent.succeeded`
   - Webhook 2 listens for `invoice.payment_succeeded`
   - Stripe fires different events for different payment types

2. **Invoice Check in Webhook 1**
   ```javascript
   if (paymentIntent.invoice) {
     // Skip - this is a subscription payment
     // Will be handled by Webhook 2
     return res.json({ received: true, skipped: 'subscription payment' });
   }
   ```

3. **Duplicate Detection in Webhook 2**
   - Checks for existing `stripe_charge_id`
   - Checks for existing `stripe_invoice_id`
   - Checks for existing entries by date, amount, and account_id

4. **Idempotency via stripe_webhook_events Table**
   - Stores every webhook event by `stripe_event_id`
   - Rejects duplicate events before processing

---

## Transaction Flow Examples

### Example 1: New Member Signup
```
Stripe Event: checkout.session.completed
→ Webhook 1 processes
→ Creates account, activates member
→ Ledger entry: "Noir Membership Dues"
→ Sends welcome SMS
```

### Example 2: Subscription Renewal
```
Stripe Events:
  1. invoice.created (adds 4% fee if card)
  2. invoice.payment_succeeded (payment processed)
  3. payment_intent.succeeded (underlying payment)

→ Webhook 2 processes invoice.created (adds fee line item)
→ Webhook 2 processes invoice.payment_succeeded (creates ledger entries)
→ Webhook 1 receives payment_intent.succeeded but SKIPS (has invoice field)
→ Result: ONE ledger entry for payment, ONE for fee (if applicable)
```

### Example 3: Manual One-Off Charge
```
Stripe Event: payment_intent.succeeded (no invoice field)
→ Webhook 1 processes
→ Ledger entry: "Manual payment: [description]"
```

### Example 4: ACH Payment
```
Stripe Event: charge.succeeded (type: us_bank_account)
→ Webhook 1 processes
→ Ledger entry: "ACH payment: [description]"
```

---

## Debugging Duplicate Entries

If you see duplicate ledger entries:

1. **Check Stripe Event Logs**
   ```
   Stripe Dashboard → Developers → Webhooks → [Your Endpoint]
   → View "Events" tab
   ```
   Look for the same `invoice_id` or `payment_intent_id` being processed twice

2. **Check Webhook Logs**
   ```
   Vercel Dashboard → Your Project → Logs
   → Filter by "/api/stripe-webhook"
   ```
   Look for duplicate processing of same event

3. **Check Database**
   ```sql
   SELECT
     account_id,
     date,
     amount,
     note,
     stripe_charge_id,
     stripe_invoice_id,
     created_at
   FROM ledger
   WHERE account_id = '[account-id]'
   ORDER BY created_at DESC
   LIMIT 20;
   ```

4. **Common Causes**
   - Both webhooks configured to listen for overlapping events (fix: update event selections in Stripe Dashboard)
   - Webhook retry after timeout (should be caught by idempotency check)
   - Missing duplicate detection logic (should be fixed now)

---

## Maintenance

### Adding New Payment Types
- **One-off payments** → Add to Webhook 1
- **Subscription-related** → Add to Webhook 2

### Testing Changes
1. Use Stripe CLI to test locally:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe-webhook
   stripe trigger payment_intent.succeeded
   ```

2. Check for duplicates after deploying:
   ```sql
   SELECT account_id, date, amount, COUNT(*)
   FROM ledger
   GROUP BY account_id, date, amount
   HAVING COUNT(*) > 1;
   ```

---

## Summary

✅ **Clear separation of concerns**
✅ **No overlapping event handlers**
✅ **Multiple layers of duplicate prevention**
✅ **Comprehensive transaction coverage**

All payment events are captured exactly once in the ledger.
