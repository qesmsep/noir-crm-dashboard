# Ledger Duplicate Prevention Strategy

## Problems Identified

1. **Race Condition**: Billing cron and Stripe webhooks both try to log the same payment
2. **`.single()` Bug**: Failed when multiple entries share same payment_intent_id (✅ FIXED)
3. **No DB Constraints**: Database allowed duplicate entries (✅ FIXED)
4. **Inconsistent Types**: "credit" vs "payment" for same transaction (documented)
5. **Multiple Write Paths**: 6+ places can create ledger entries

## Solution Implemented (Option B - Recommended)

### 1. Added `ledger_entry_key` Column ✅
**Purpose**: Unique identifier for each ledger entry

**Pattern**:
- Main payment: `pi_123` (payment_intent_id)
- Admin fee: `pi_123:admin_fee`
- CC fee: `pi_123:cc_fee`
- Additional members: `pi_123:additional_members`

**Benefits**:
- Simple unique constraint (no complex WHERE clauses)
- Easy to trace related entries (all start with same payment_intent_id)
- Preserves original Stripe IDs for lookups

### 2. Database Constraint ✅
```sql
CREATE UNIQUE INDEX idx_ledger_unique_entry_key
ON ledger (ledger_entry_key)
WHERE ledger_entry_key IS NOT NULL;
```

This prevents:
- ❌ Duplicate payment entries (same ledger_entry_key)
- ❌ Race conditions between billing cron and webhooks
- ❌ Webhook retry duplicates

### 3. Added `source` Column ✅
Tracks origin of each entry:
- `billing_cron` - Monthly billing automation
- `stripe_webhook` - Stripe webhook events
- `manual_admin` - Admin UI manual entries
- `intake_campaign` - SMS campaign actions
- `legacy` - Pre-existing entries

### 4. Transaction Types (Documented)
**Current Pattern** (keeping as-is):
- `credit` - Automated billing payments (cron)
- `payment` - Manual/webhook payments
- `charge` - Fees and purchases
- `purchase` - Member purchases

### 5. Webhook Idempotency Table ✅
Tracks processed Stripe webhook events to prevent re-processing on retry:
```sql
CREATE TABLE webhook_events (
  event_id VARCHAR(255) UNIQUE NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 6. Idempotent DB Function ✅
`create_ledger_entry_idempotent()` - Atomically checks for existing entry and inserts only if not found

## Files Changed

1. **Migration**: `supabase/migrations/20260330_prevent_duplicate_ledger_entries.sql`
   - Added `ledger_entry_key` and `source` columns
   - Created unique index on `ledger_entry_key`
   - Created `webhook_events` table
   - Created `create_ledger_entry_idempotent()` function
   - Backfilled existing entries

2. **Billing Logic**: `src/lib/billing.ts`
   - Updated `logPaymentToLedger()` to include `ledger_entry_key` and `source`
   - Main payment: uses `payment_intent_id`
   - Fees: use `payment_intent_id:fee_type`

3. **Webhook Handler**: `src/pages/api/stripe-webhook.js`
   - Fixed `.single()` bug in `checkExistingLedgerEntry()`
   - Updated to check `ledger_entry_key`
   - Added `ledger_entry_key` and `source` to all inserts

## Future Improvements (Optional)

1. **Centralized Ledger Function**: Create `src/lib/ledger.ts` with a single `createLedgerEntry()` function that all code paths must use
2. **Webhook Event Logging**: Log each processed webhook event_id to `webhook_events` table for additional safety
3. **Audit Tool**: Admin UI to detect and resolve any legacy duplicate entries
4. **Monitoring**: Add alerts for ledger insert failures or constraint violations
