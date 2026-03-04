# Beverage Credit System Design

**Last Updated**: 2026-03-03
**Status**: Design Phase

## Overview

The beverage credit system tracks member spending at Noir separately from subscription billing. Members pay a monthly subscription fee (which includes an admin fee and beverage credits), and their beverage credits are tracked in the account ledger.

---

## System Architecture

### Two Separate Tracking Systems

#### 1. **Transaction History (Stripe Invoices)**
- **Purpose**: Track subscription billing and credit card charges
- **Data Source**: Stripe API
- **Component**: `SubscriptionTransactionHistory.tsx`
- **What it shows**:
  - Monthly subscription charges ($150, $175, etc.)
  - Failed payments
  - Refunds
  - Billing history

#### 2. **Account Ledger (`ledger_entries` table)**
- **Purpose**: Track member spending at the venue
- **Data Source**: Supabase `ledger` table
- **Component**: Ledger section in `[accountId].tsx`
- **What it shows**:
  - Monthly beverage credit allocations (+$100)
  - Venue purchases (-$15 for cocktails, -$45 for dinner)
  - Manual charges/credits from admin
  - Running balance (available spending money)

---

## Membership Tiers & Pricing

### Current Pricing Structure (March 2026)

| Tier | Monthly Fee | Beverage Credit | Admin Fee | Notes |
|------|------------|----------------|-----------|-------|
| **Solo Membership** | $150 | $100 | $50 | Single member |
| **Duo Membership** | $175 | $100 | $75 | Primary + secondary member ($25 extra admin fee for 2nd member) |
| **Daytime Add-on** | +$225 | +$225 | $0 | No admin fee on add-on |

**Examples**:
- Solo Member pays $150/mo → Gets $100 beverage credit ($50 admin fee)
- Duo Member pays $175/mo → Gets $100 beverage credit ($75 total admin fees)
- Solo + Daytime pays $375/mo → Gets $325 beverage credit ($50 admin fee)

---

## Ledger Entry Types

### Existing Types
- `'payment'` - Manual payments (positive amount)
- `'purchase'` - Venue purchases (negative amount)

### New Types (To Be Added)
- `'beverage_credit_allocation'` - Monthly credit allocation (positive amount, e.g., +$100)
- `'admin_fee'` - Monthly admin fee (negative amount, optional - for transparency)

### Why Not Create New Types?
**Decision**: Use existing `'payment'` type for beverage credit allocations and `'purchase'` for venue purchases. This keeps the system simple and works with existing components.

**Implementation**:
- Monthly beverage credits = `type: 'payment'`, `note: 'Monthly beverage credit allocation'`
- Venue purchases = `type: 'purchase'`, `note: '2x Cocktails'`

---

## Key Business Rules

### 1. Credit Rollover
✅ **Beverage credits roll over month-to-month**
- Unused credits carry forward to the next billing period
- No expiration date on credits
- Running balance accumulates over time

**Example**:
```
Month 1: +$100 credit, -$30 spent → Balance: $70
Month 2: +$100 credit, -$50 spent → Balance: $120
Month 3: +$100 credit, -$200 spent → Balance: $20
```

### 2. Pro-Rating & Partial Months
❌ **No pro-rating for now**
- New members get full credit allocation regardless of join date
- Cancellations don't pro-rate (keep it simple)
- Future consideration: Pro-rate if needed later

### 3. Admin Fee Display
**Decision: Don't show admin fees separately in ledger**
- Members see: Subscription charge ($150) in Stripe Transaction History
- Members see: Beverage credit allocation ($100) in Account Ledger
- Admin fee ($50) = implicit difference (not shown)

**Rationale**: Keeps ledger focused on spending money, not billing breakdown

---

## Database Schema

### Current Schema (No changes needed)
```sql
ledger_entries {
  id UUID PRIMARY KEY,
  account_id UUID FK,
  member_id UUID FK,
  type TEXT, -- 'payment', 'purchase', 'charge', 'refund'
  amount DECIMAL, -- Positive for credits, negative for charges
  date DATE,
  note TEXT,
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
}
```

**No schema changes required!** We use existing `type` and `note` fields.

---

## Implementation Phases

### Phase 1: Manual Beverage Credit Allocation (Current State)
**Status**: ✅ Working
**How it works**:
- Admin manually adds ledger entry each month:
  - Type: `payment`
  - Amount: `$100`
  - Note: `Monthly beverage credit allocation`
- Already supported by existing ledger UI

### Phase 2: Automated Monthly Credit Allocation (Future)
**Status**: ⏳ To be built
**Requirements**:
- Cron job or webhook to run on subscription renewal
- Automatically create ledger entry when Stripe charges subscription
- Use Stripe webhook `invoice.paid` event
- Check `monthly_dues` from `accounts` table
- Calculate beverage credit based on tier
- Insert ledger entry with `type: 'payment'`

**Pseudocode**:
```typescript
// Stripe webhook: invoice.paid
if (invoice.subscription) {
  const account = getAccountByStripeSubscription(invoice.subscription);
  const beverageCredit = calculateBeverageCredit(account.monthly_dues);

  await supabase.from('ledger').insert({
    account_id: account.account_id,
    member_id: getPrimaryMember(account.account_id),
    type: 'payment',
    amount: beverageCredit,
    note: 'Monthly beverage credit allocation',
    date: new Date().toISOString().split('T')[0],
  });
}

function calculateBeverageCredit(monthlyDues: number) {
  if (monthlyDues === 150) return 100; // Solo
  if (monthlyDues === 175) return 100; // Duo
  if (monthlyDues === 375) return 325; // Solo + Daytime
  if (monthlyDues === 400) return 325; // Duo + Daytime
  return 0;
}
```

### Phase 3: Tiered Credit System (Future Enhancement)
**Status**: 💡 Idea
**Concept**: Different tiers get different credit amounts
- Premium members: $150 credit for $200/mo
- VIP members: $200 credit for $250/mo
- This requires more complex tier management

---

## UI/UX Considerations

### Current Ledger Display
**Location**: `src/pages/admin/members/[accountId].tsx`
**Shows**:
- Running balance (CREDIT or BALANCE in red/green)
- Transaction list with type, amount, note, date
- "Pay Balance" button if negative

### Proposed Enhancements (Future)
1. **Separate beverage credit balance from ledger balance**
   - Show "Beverage Credit: $120" at top of ledger
   - Show "Additional Balance: -$50" if they overspend
2. **Color-code transaction types**
   - Green for credit allocations
   - Red for purchases
   - Gray for manual charges
3. **Monthly summary**
   - "This month: +$100 credit, -$75 spent, $25 remaining"

---

## Testing Checklist

### Manual Testing
- [ ] Create new Solo member ($150/mo subscription)
- [ ] Manually allocate $100 beverage credit in ledger
- [ ] Add $30 purchase → Verify balance = $70
- [ ] Next month: Allocate $100 → Verify balance = $170
- [ ] Upgrade Solo → Duo ($175/mo subscription)
- [ ] Verify beverage credit stays at $100/mo (admin fee increases to $75)

### Automated Testing (Phase 2)
- [ ] Stripe webhook `invoice.paid` triggers credit allocation
- [ ] Credit amount calculated correctly based on tier
- [ ] Ledger entry created with correct type and note
- [ ] No duplicate credits if webhook fires twice

---

## Open Questions & Future Decisions

1. **Daytime add-on pricing**:
   - Currently: $225/mo subscription = $225 beverage credit (no admin fee)
   - Should there be a small admin fee? (e.g., $250 subscription = $225 credit + $25 admin fee)

2. **Negative balances**:
   - If member goes negative, do we auto-charge their card?
   - Or manual admin action required?
   - Current: Manual "Pay Balance" button

3. **Credit expiration** (for future premium tiers):
   - Should some tiers have credits that expire?
   - E.g., "Use it or lose it" monthly credits vs. rollover credits

4. **Family accounts** (more than 2 members):
   - Currently limited to 2 members (Solo/Duo)
   - Future: Family tier with 3-4 members?
   - How would beverage credits work? Shared pool?

---

## Related Files

- **Ledger API**: `src/pages/api/ledger.ts`
- **Ledger UI**: `src/pages/admin/members/[accountId].tsx` (lines 1160-1503)
- **Subscription Card**: `src/components/MemberSubscriptionCard.tsx`
- **Transaction History**: `src/components/SubscriptionTransactionHistory.tsx`
- **Accounts Table**: Database schema in `HOWTO.md`

---

## Summary

**Current Implementation**:
- ✅ Two separate systems (Stripe invoices + Ledger)
- ✅ Manual beverage credit allocation
- ✅ Credits roll over month-to-month
- ✅ No pro-rating
- ✅ Admin fees implicit (not shown separately)

**Next Steps**:
- ⏳ Automate monthly credit allocation via Stripe webhook
- ⏳ Build tiered credit calculation logic
- ⏳ Enhance UI with beverage credit balance display

**No schema changes needed!** Use existing ledger table with current `type` and `note` fields.
