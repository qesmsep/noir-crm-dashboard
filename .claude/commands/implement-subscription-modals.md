# Implement Subscription Management Modals

You are tasked with implementing the "Update Plan" and "Update Payment" functionality for the subscription management system. These buttons currently show "coming soon" tooltips and need to be fully functional.

## Context

The subscription system has been migrated to an **account-level architecture**:
- Subscriptions belong to `accounts`, not individual `members`
- `stripe_customer_id` is stored on the `accounts` table only
- All subscription-related APIs use `account_id` as the primary identifier

## Your Tasks

### 1. Create UpdatePlanModal Component

**File**: `/src/components/UpdatePlanModal.tsx`

**Requirements**:
- Modal dialog that displays available subscription plans
- Fetch plans from `/api/subscriptions/plans` endpoint
- Show current plan with visual indicator (e.g., "Current Plan" badge)
- Display plan details: name, price, billing interval
- Allow user to select a new plan
- Show proration information (credit/charge amount)
- Call `/api/subscriptions/update-plan` with account_id and new_price_id
- Handle success/error states with toast notifications
- Close modal on success

**API Endpoint (already exists)**: `POST /api/subscriptions/update-plan`
```typescript
Body: {
  account_id: string,
  new_price_id: string,
  proration_behavior?: 'create_prorations' | 'none' | 'always_invoice'
}
```

**Styling**:
- Use existing design system colors and styles from `SubscriptionTransactionHistory.module.css`
- Match the aesthetic: clean, minimalist, neutral earth tones
- Ensure mobile responsiveness

---

### 2. Create UpdatePaymentModal Component

**File**: `/src/components/UpdatePaymentModal.tsx`

**Requirements**:
- Modal dialog with Stripe Elements integration
- Display current payment method (card last 4 digits, brand, expiration)
- Show form to add new payment method using Stripe CardElement
- Use `/api/stripe/payment-methods/setup-intent` to create SetupIntent
- Submit payment method to Stripe and call `/api/stripe/payment-methods/set-default`
- Handle 3D Secure authentication if required
- Show success/error states with toast notifications
- Update UI to reflect new payment method on success

**Required APIs (already exist)**:

1. `POST /api/stripe/payment-methods/setup-intent`
```typescript
Body: { account_id: string }
Returns: { client_secret: string }
```

2. `GET /api/stripe/payment-methods/list?account_id={id}`
```typescript
Returns: {
  payment_methods: Array<{
    id: string,
    card: { brand: string, last4: string, exp_month: number, exp_year: number },
    billing_details: { name: string }
  }>,
  default_payment_method_id: string
}
```

3. `POST /api/stripe/payment-methods/set-default`
```typescript
Body: {
  account_id: string,
  payment_method_id: string
}
```

**Stripe Integration**:
- Install `@stripe/stripe-js` and `@stripe/react-stripe-js` if not already installed
- Use `loadStripe()` with publishable key from env
- Wrap component in `<Elements>` provider
- Use `<CardElement>` for card input
- Use `stripe.confirmCardSetup()` for payment method confirmation

**Styling**:
- Match existing design system
- Properly style Stripe CardElement to match input fields
- Mobile responsive

---

### 3. Wire Up Buttons in MemberSubscriptionCard

**File**: `/src/components/MemberSubscriptionCard.tsx`

**Changes**:
1. Import the two new modal components
2. Add state for modal open/close (`showUpdatePlanModal`, `showUpdatePaymentModal`)
3. Remove the "coming soon" title attributes from buttons
4. Add onClick handlers to open respective modals
5. Pass necessary props to modals:
   - `accountId` (from props)
   - `currentPlanId` or `currentPriceId` (from subscription data)
   - `onSuccess` callback to refresh subscription data
   - `onClose` callback to close modal

**Example structure**:
```tsx
const [showUpdatePlanModal, setShowUpdatePlanModal] = useState(false);
const [showUpdatePaymentModal, setShowUpdatePaymentModal] = useState(false);

// In render:
<button onClick={() => setShowUpdatePlanModal(true)}>
  Update Plan
</button>

{showUpdatePlanModal && (
  <UpdatePlanModal
    accountId={accountId}
    currentPriceId={subscription.price_id}
    onSuccess={() => {
      refetchSubscriptionData();
      setShowUpdatePlanModal(false);
    }}
    onClose={() => setShowUpdatePlanModal(false)}
  />
)}
```

---

### 4. End-to-End Testing

Test all flows thoroughly:

**Update Plan Flow**:
1. Open member detail page for account with active subscription
2. Click "Update Plan" button
3. Modal opens showing available plans with current plan highlighted
4. Select different plan
5. Confirm proration details
6. Submit and verify:
   - API call succeeds
   - Toast notification shows success
   - Modal closes
   - Subscription card updates with new plan info
   - Database `accounts` table updated correctly
   - Stripe subscription updated

**Update Payment Flow**:
1. Open member detail page for account with active subscription
2. Click "Update Payment" button
3. Modal opens showing current payment method
4. Enter new card details (use Stripe test cards)
5. Submit and verify:
   - SetupIntent created
   - Payment method saved to Stripe
   - New card set as default
   - Toast notification shows success
   - Modal closes
   - Payment method display updates
   - Database `accounts` table updated with payment info

**Error Handling**:
- Test with invalid card numbers
- Test with cards requiring 3D Secure
- Test network errors
- Test validation errors
- Verify appropriate error messages display

---

## Key Files Reference

**Existing components**:
- `/src/components/MemberSubscriptionCard.tsx` - Main subscription card
- `/src/components/SubscriptionTransactionHistory.tsx` - Transaction history (for styling reference)
- `/src/hooks/useToast.tsx` - Toast notification hook

**Existing APIs**:
- `/src/pages/api/subscriptions/update-plan.ts` - Update subscription plan
- `/src/pages/api/subscriptions/plans.ts` - Get available plans (if exists, else create it)
- `/src/pages/api/stripe/payment-methods/setup-intent.ts` - Create SetupIntent
- `/src/pages/api/stripe/payment-methods/list.ts` - List payment methods
- `/src/pages/api/stripe/payment-methods/set-default.ts` - Set default payment method

**Existing styles**:
- `/src/styles/SubscriptionTransactionHistory.module.css` - Reference for design system

---

## Environment Variables Required

Ensure `.env.local` has:
```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
```

---

## Design Guidelines

- **Colors**: Use neutral earth tones from existing components (#1F1F1F, #8C7C6D, #A59480, #ECEAE5)
- **Typography**: Font weights 500-600, sizes 13-16px
- **Spacing**: 16-24px padding, 8-16px gaps
- **Borders**: 1px solid #ECEAE5, border-radius 8-16px
- **Shadows**: Subtle multi-layer shadows like in transaction history card
- **Buttons**: Rounded, hover states, clear CTAs
- **Mobile**: Stack elements vertically, adjust padding

---

## Success Criteria

- [ ] UpdatePlanModal component created and functional
- [ ] UpdatePaymentModal component created with full Stripe integration
- [ ] Both modals wired up to MemberSubscriptionCard buttons
- [ ] All API integrations working correctly
- [ ] Proper error handling and user feedback
- [ ] Mobile responsive design
- [ ] End-to-end tested with real Stripe test data
- [ ] Code follows existing patterns and conventions
- [ ] No console errors or warnings

---

## Notes

- Do NOT modify the webhook or any account-level architecture
- Do NOT store `stripe_customer_id` on members table
- Always use `account_id` for subscription operations
- Use existing `useToast` hook for notifications
- Follow existing code patterns in the codebase
- Test with Stripe test mode only

---

## Ready to Start

Once you begin, create a todo list to track your progress through these tasks. Start by examining the existing `MemberSubscriptionCard.tsx` component to understand the current structure, then proceed with building the modals.
