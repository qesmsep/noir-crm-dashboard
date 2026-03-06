# Payment Coverage Verification

## All Payment Scenarios

### ✅ 1. Subscription Renewal (Automatic)
**Stripe Event:** `invoice.payment_succeeded`
- **Handler:** NEW webhook (`/api/stripe-webhook-subscriptions.ts`)
- **Ledger Entry:** "Subscription Payment (inv_xxx)" + optional "4% Credit Card Processing Fee"
- **Duplicate Prevention:**
  - Checks `stripe_charge_id`
  - Checks `stripe_invoice_id`
  - Stores both IDs in ledger
- **Shown in Account Ledger:** ✅ YES
- **Shown in Transaction History:** ✅ YES (fetches from Stripe invoices)

---

### ✅ 2. Quick Action: "Charge Card"
**Flow:** Admin UI → `/api/chargeBalance` → Stripe PaymentIntent

**Step 1:** `chargeBalance.js` creates PaymentIntent and confirms it
```javascript
intent = await stripe.paymentIntents.create({
  amount: amountToCharge,
  customer: stripe_customer_id,
  confirm: true,
});
```

**Step 2:** `chargeBalance.js` IMMEDIATELY inserts ledger entry
```javascript
.insert({
  stripe_payment_intent_id: intent.id // This prevents webhook duplicate!
})
```

**Step 3:** Stripe fires `payment_intent.succeeded` webhook

**Step 4:** Old webhook checks for duplicate
```javascript
const exists = await checkExistingLedgerEntry(null, paymentIntent.id);
if (exists) {
  return res.json({ success: true, message: 'Ledger entry already exists' });
}
```

- **Ledger Entry:** Custom description from admin
- **Duplicate Prevention:** ✅ `checkExistingLedgerEntry` finds it by `stripe_payment_intent_id`
- **Result:** ONE ledger entry (from chargeBalance.js, webhook skips)
- **Shown in Account Ledger:** ✅ YES
- **Shown in Transaction History:** ❌ NO (not an invoice, by design)

---

### ✅ 3. Quick Action: "Add Credit"
**Flow:** Admin UI → `/api/ledger` (direct insert, no Stripe)

- **No Stripe event** - direct database insert
- **Ledger Entry:** Custom description from admin
- **Duplicate Prevention:** N/A (no webhook involved)
- **Shown in Account Ledger:** ✅ YES
- **Shown in Transaction History:** ❌ NO (not a Stripe payment, by design)

---

### ✅ 4. Quick Action: "Add Purchase"
**Flow:** Admin UI → `/api/ledger` (direct insert, no Stripe)

- **No Stripe event** - direct database insert
- **Ledger Entry:** Custom description from admin (negative amount)
- **Duplicate Prevention:** N/A (no webhook involved)
- **Shown in Account Ledger:** ✅ YES
- **Shown in Transaction History:** ❌ NO (not a Stripe payment, by design)

---

### ✅ 5. New Member Signup
**Stripe Event:** `checkout.session.completed`

- **Handler:** OLD webhook (`/api/stripe-webhook.js`)
- **Ledger Entry:** "Noir Membership Dues"
- **Duplicate Prevention:** Checks `stripe_payment_intent_id`
- **Shown in Account Ledger:** ✅ YES
- **Shown in Transaction History:** ❌ NO (not an invoice, by design - first payment is via checkout)

---

### ✅ 6. Manual One-Off Charge (via Stripe Dashboard or Payment Link)
**Stripe Event:** `payment_intent.succeeded` (no invoice field)

- **Handler:** OLD webhook (`/api/stripe-webhook.js`)
- **Checks:**
  ```javascript
  if (paymentIntent.invoice) {
    return res.json({ skipped: 'subscription payment' }); // Skips if invoice exists
  }
  ```
- **Ledger Entry:** "Manual payment: [description]"
- **Duplicate Prevention:** Checks `stripe_payment_intent_id`
- **Shown in Account Ledger:** ✅ YES
- **Shown in Transaction History:** ❌ NO (not an invoice, by design)

---

### ✅ 7. ACH Payment
**Stripe Event:** `charge.succeeded` (type: us_bank_account)

- **Handler:** OLD webhook (`/api/stripe-webhook.js`)
- **Ledger Entry:** "ACH payment: [description]"
- **Duplicate Prevention:** Checks `stripe_charge_id`
- **Shown in Account Ledger:** ✅ YES
- **Shown in Transaction History:** Depends if associated with invoice

---

## Transaction History vs Account Ledger

### Transaction History Component
**Source:** Fetches from `/api/accounts/${accountId}/invoices`
- Shows: Stripe invoices only (subscription invoices)
- Does NOT show: Manual charges, credits, purchases, one-off payments
- **Purpose:** Show subscription billing history with downloadable invoices

### Account Ledger
**Source:** Queries `ledger` table directly
- Shows: ALL transactions (Stripe + manual)
- **Purpose:** Complete financial history for the account

---

## Verification Checklist

### No Duplicates ✅
- [x] Subscription renewals create ONE entry
- [x] Quick Action "Charge Card" creates ONE entry (via chargeBalance, webhook skips)
- [x] Manual credits create ONE entry (no webhook)
- [x] Manual purchases create ONE entry (no webhook)
- [x] New signups create ONE entry
- [x] Manual one-off charges create ONE entry

### All Transactions Captured ✅
- [x] Subscription renewals → NEW webhook → Account Ledger ✅
- [x] Quick "Charge Card" → chargeBalance → Account Ledger ✅
- [x] Quick "Add Credit" → /api/ledger → Account Ledger ✅
- [x] Quick "Add Purchase" → /api/ledger → Account Ledger ✅
- [x] New signups → OLD webhook → Account Ledger ✅
- [x] Manual charges → OLD webhook → Account Ledger ✅
- [x] ACH payments → OLD webhook → Account Ledger ✅

### Webhook Separation ✅
- [x] OLD webhook skips subscription renewals (checks `invoice` field)
- [x] NEW webhook only handles subscription events
- [x] No overlapping event handlers
- [x] Both webhooks have duplicate detection

---

## Summary

✅ **All payment types are captured in the Account Ledger**
✅ **No duplicates will be created**
✅ **Transaction History shows subscription invoices only (by design)**

The **Account Ledger** is the source of truth for ALL financial transactions.
The **Transaction History** is for subscription invoices with PDF downloads.

Both serve different purposes and complement each other.
