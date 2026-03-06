# Stripe PDF Invoices Implementation

## Summary
Stripe invoice PDFs are now automatically attached to subscription payment ledger entries, making the Transaction History component redundant.

---

## Changes Made

### 1. Database Migration
**File:** `supabase/migrations/20260305_add_stripe_invoice_pdf_url_to_ledger.sql`

Added `stripe_invoice_pdf_url` column to the `ledger` table:
```sql
ALTER TABLE ledger
ADD COLUMN IF NOT EXISTS stripe_invoice_pdf_url TEXT;
```

---

### 2. Subscription Webhook
**File:** `src/pages/api/stripe-webhook-subscriptions.ts` (line 651)

When processing `invoice.payment_succeeded`, the webhook now stores the PDF URL:
```typescript
.insert({
  // ... other fields
  stripe_invoice_pdf_url: invoice.invoice_pdf || null,
})
```

**How it works:**
- Stripe generates invoice PDFs automatically
- When a subscription renews, Stripe fires `invoice.payment_succeeded`
- The webhook extracts `invoice.invoice_pdf` (Stripe-hosted URL)
- Stores it in the ledger entry alongside other Stripe IDs

---

### 3. Attachments API
**File:** `src/pages/api/transaction-attachments/[ledgerId].ts` (lines 31-52)

The API now returns Stripe invoice PDFs as virtual attachments:
```typescript
// Fetch Stripe invoice PDF URL from ledger
const { data: ledgerEntry } = await supabase
  .from('ledger')
  .select('stripe_invoice_pdf_url')
  .eq('id', ledgerId)
  .single();

// Add as virtual attachment if exists
if (ledgerEntry?.stripe_invoice_pdf_url) {
  allAttachments.unshift({
    id: `stripe-pdf-${ledgerId}`,
    file_name: 'Stripe Invoice.pdf',
    file_url: ledgerEntry.stripe_invoice_pdf_url,
    is_stripe_invoice: true, // Flag to prevent deletion
  });
}
```

**Why virtual?**
- No need to download and re-upload the PDF
- Stripe's hosted URL is reliable and always available
- Saves storage space and webhook processing time
- Appears seamlessly in the attachments list

---

### 4. InlineAttachments Component
**File:** `src/components/InlineAttachments.tsx`

**Changes:**
- Added `is_stripe_invoice?: boolean` to `Attachment` interface
- Hide delete button for Stripe invoice PDFs (line 320)
- Stripe invoices can be viewed/downloaded but not deleted

**User Experience:**
1. Click 📎 icon on a subscription payment entry
2. See "Stripe Invoice.pdf" at the top of attachments
3. Can view, download, and share the PDF
4. Cannot delete (it's Stripe's official record)

---

### 5. Removed Transaction History
**File:** `src/pages/admin/members/[accountId].tsx`

**Removed:**
- Import of `SubscriptionTransactionHistory`
- Component usage on member detail page

**Reason:** Redundant - Stripe invoices now appear in Account Ledger as attachments

---

## User Flow

### Before (Redundant Views)
1. Account Ledger shows: "Subscription Payment (inv_xxx)"
2. Transaction History shows: Same invoice with PDF download
3. Two places to view the same information

### After (Unified View)
1. Account Ledger shows: "Subscription Payment (inv_xxx)" with 📎 icon
2. Click 📎 → See "Stripe Invoice.pdf" + any manual attachments
3. One unified view with all transaction documentation

---

## Benefits

✅ **Unified View:** All transaction docs in one place (Account Ledger)
✅ **Simpler UI:** No separate Transaction History section needed
✅ **Official Records:** Stripe-hosted PDFs are authoritative invoices
✅ **No Storage Cost:** URLs point to Stripe's servers
✅ **Fast Webhooks:** No PDF download/upload during webhook processing
✅ **Always Available:** Stripe maintains the PDFs indefinitely

---

## Testing

### Test 1: Run Migration
```bash
# Apply the migration to add the column
psql $DATABASE_URL < supabase/migrations/20260305_add_stripe_invoice_pdf_url_to_ledger.sql
```

### Test 2: Trigger Subscription Renewal
```bash
# In Stripe Dashboard → Developers → Events → Send test event
# Select: invoice.payment_succeeded
```

**Expected:**
1. Webhook creates ledger entry with `stripe_invoice_pdf_url` populated
2. Account Ledger shows payment entry with 📎 1
3. Clicking 📎 shows "Stripe Invoice.pdf"
4. Clicking the PDF opens Stripe's hosted invoice

### Test 3: Verify PDF Visibility
1. Navigate to member detail page: `/admin/members/[accountId]`
2. Find a subscription payment in Account Ledger
3. Click 📎 icon
4. Verify "Stripe Invoice.pdf" appears first
5. Click it to view/download
6. Verify delete button does NOT appear for Stripe PDF

---

## Migration for Existing Entries

For subscription payments that were created before this change:

**Option A: Backfill from Stripe (Recommended)**
```javascript
// Script to backfill existing subscription payments
const subscriptionPayments = await supabase
  .from('ledger')
  .select('id, stripe_invoice_id')
  .not('stripe_invoice_id', 'is', null)
  .is('stripe_invoice_pdf_url', null);

for (const payment of subscriptionPayments) {
  const invoice = await stripe.invoices.retrieve(payment.stripe_invoice_id);
  if (invoice.invoice_pdf) {
    await supabase
      .from('ledger')
      .update({ stripe_invoice_pdf_url: invoice.invoice_pdf })
      .eq('id', payment.id);
  }
}
```

**Option B: Wait for next renewal**
- New renewals will automatically have PDFs
- Old entries can be manually attached if needed

---

## Technical Notes

### Stripe Invoice PDF URL Format
```
https://pay.stripe.com/invoice/{invoice_id}/pdf
```

**Characteristics:**
- Public URL (no authentication needed)
- Stable (doesn't expire)
- Official Stripe branding
- Includes all line items, fees, and payment details

### URL vs Download Approach

**URL Approach (Implemented):**
- ✅ Fast webhook processing
- ✅ No storage costs
- ✅ Always up-to-date if Stripe regenerates
- ⚠️ Depends on Stripe's uptime

**Download Approach (Alternative):**
- ⚠️ Slower webhooks (risk timeout)
- ⚠️ Storage costs
- ⚠️ Complex error handling
- ✅ Independent of Stripe
- ✅ Can modify/annotate PDFs

**Verdict:** URL approach is better for this use case.

---

## Summary

Stripe invoice PDFs are now seamlessly integrated into the Account Ledger via the attachments system. This eliminates UI redundancy while providing quick access to official payment records.

All subscription payments going forward will automatically include the PDF. Existing entries can be backfilled if needed.
