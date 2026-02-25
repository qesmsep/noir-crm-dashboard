# Next Steps - Subscription System Deployment

**Status**: Core implementation complete ✅
**Ready for**: Testing and deployment

---

## 🎯 Quick Start (5 Steps)

### 1. Run Database Migrations (5 minutes)

**Easiest method** - Use Supabase Dashboard:

1. Open: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql/new
2. Copy/paste contents of: `migrations/RUN_ALL_MIGRATIONS.sql`
3. Click "Run"
4. Verify success (no red errors)

**Alternative** - Use script:
```bash
node run-subscription-migrations.js
```

**Verify**:
```sql
-- Run in Supabase SQL Editor
SELECT column_name FROM information_schema.columns
WHERE table_name = 'members' AND column_name LIKE '%subscription%';

-- Should return: stripe_subscription_id, subscription_status, subscription_start_date, etc.
```

---

### 2. Sync Existing Stripe Subscriptions (2 minutes)

```bash
node scripts/sync-stripe-subscriptions.js
```

**What this does**:
- Fetches all subscriptions from Stripe
- Matches to members by `stripe_customer_id`
- Updates database with subscription data
- Backfills payment method details

**Expected output**:
```
✅ Found 45 subscriptions in Stripe
✅ Synced: 40
⚠️  Skipped: 5 (no matching member)
```

**Troubleshooting**:
- "Skipped" is normal if Stripe has customers not in your members table
- If you see errors, check `STRIPE_SECRET_KEY` in `.env.local`

---

### 3. Configure Stripe Webhook (10 minutes)

#### A. Create Webhook Endpoint

1. Go to: https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. Enter URL: `https://your-domain.vercel.app/api/stripe-webhook-subscriptions`
4. Select these events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `customer.subscription.paused`
   - `customer.subscription.resumed`
   - `invoice.payment_failed`
   - `invoice.payment_succeeded`
5. Click "Add endpoint"

#### B. Add Webhook Secret to Environment

1. Copy the "Signing secret" (starts with `whsec_`)
2. Add to `.env.local`:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
   ```
3. Redeploy to Vercel (or restart local dev server)

#### C. Test Webhook

1. In Stripe Dashboard → Webhooks → Your endpoint
2. Click "Send test webhook"
3. Select `customer.subscription.updated`
4. Click "Send test webhook"
5. Check webhook logs (should show 200 OK response)

---

### 4. Verify Business Dashboard (1 minute)

1. Go to `/admin` in your app
2. Check the business metrics cards:
   - **MRR** should match Stripe Analytics
   - **Active Subscriptions** should match Stripe count
   - **Churn** should be calculated from real subscription events

**Compare with Stripe**:
- Stripe Dashboard → Analytics → MRR
- Should match your admin dashboard MRR

---

### 5. Add Subscription Card to Member Pages (5 minutes)

**File**: `src/pages/admin/members/[accountId].tsx`

**Step 1** - Add import (top of file, around line 8):
```tsx
import MemberSubscriptionCard from '@/components/MemberSubscriptionCard';
```

**Step 2** - Add component (around line 810-815, inside the member cards section):
```tsx
{/* Subscription Information */}
{members[0] && (
  <MemberSubscriptionCard
    memberId={members[0].member_id}
    accountId={accountId as string}
  />
)}
```

**Step 3** - Test:
1. Navigate to a member detail page
2. Subscription card should display with:
   - Status badge (Active/Canceled/Past Due)
   - MRR, start date, next renewal
   - Payment method (card/ACH with last 4)
   - Cancel/Reactivate buttons

---

## ✅ Testing Checklist

After completing the 5 steps above, test these scenarios:

### Basic Functionality
- [ ] Member detail page shows subscription card
- [ ] Status badge displays correct color (green = active, red = canceled)
- [ ] MRR displays correct amount
- [ ] Payment method shows card/ACH with last 4 digits

### Cancel & Reactivate
- [ ] Click "Cancel Subscription" → Confirms → Shows "Cancels On" date
- [ ] Status remains "Active" (scheduled cancellation)
- [ ] Click "Reactivate" → Removes cancellation date
- [ ] Status returns to "Active"

### Webhook Integration
- [ ] Change subscription in Stripe Dashboard
- [ ] Refresh member detail page
- [ ] Verify changes reflected immediately

### Business Metrics
- [ ] Admin dashboard MRR matches Stripe
- [ ] Active subscription count accurate
- [ ] No errors in browser console

---

## 🎨 Optional: UI Customization

The subscription card uses Noir brand colors and styling. To customize:

**File**: `src/styles/MemberSubscriptionCard.module.css`

**Common customizations**:
- Change button colors (lines 140-200)
- Adjust card spacing (lines 1-10)
- Modify status badge colors (lines 25-75)
- Update mobile breakpoints (lines 205-260)

---

## 🐛 Common Issues

### "Subscription card shows 'No active subscription'"
**Solution**: Run sync script (`node scripts/sync-stripe-subscriptions.js`)

### "Webhook events not processing"
**Solution**:
1. Check `STRIPE_WEBHOOK_SECRET` in `.env.local`
2. Redeploy to Vercel
3. Check Stripe webhook logs for errors

### "Business metrics showing $0 MRR"
**Solution**:
1. Run sync script
2. Wait 1-2 minutes for snapshot generation
3. Refresh admin dashboard

### "Payment method not displaying"
**Solution**:
1. Ensure subscription has default payment method in Stripe
2. Re-run sync script
3. Check `payment_method_type` column in members table

---

## 📊 What You Get

After completing these steps, you'll have:

✅ **Accurate business metrics** - MRR, churn, subscription count from real Stripe data
✅ **Auto-sync from Stripe** - Webhook keeps your database in sync with Stripe
✅ **Subscription management** - Cancel/reactivate from admin UI
✅ **Payment method tracking** - Card/ACH details displayed on member pages
✅ **Audit trail** - All subscription events logged in `subscription_events` table

---

## 🚀 What's Next (Future)

The core system is complete. Here are optional enhancements you can add later:

1. **Payment Method UI** - Let admins update member payment methods from UI
2. **Plan Selector** - UI for creating new subscriptions
3. **Member Portal** - Let members manage their own subscriptions
4. **Email Notifications** - Automated emails for subscription events
5. **Advanced Metrics** - Scheduled cancellations, failed payments dashboard

These are documented but not implemented. The APIs exist, you just need to build the UI.

---

## 📞 Need Help?

If you encounter issues:

1. Check `SUBSCRIPTION_SYSTEM_COMPLETE.md` for detailed documentation
2. Review API files in `src/pages/api/subscriptions/` for usage examples
3. Check Stripe Dashboard webhook logs for webhook errors
4. Check Supabase logs for database errors
5. Check browser console for frontend errors

---

**Ready to go!** Start with Step 1 (Run Migrations) and work through the checklist.

**DO NOT COMMIT until Tim explicitly approves.**
