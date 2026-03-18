# Business Dashboard — Metric Dictionary

## Overview

The Business Dashboard (`/admin/business`) provides a centralized view of recurring revenue health, member lifecycle metrics, Toast attach economics, cohort retention, and operational alerts.

All metric formulas are implemented server-side in `src/lib/businessMetrics.ts`. The UI does NOT re-implement formulas — it consumes pre-computed outputs from API endpoints.

---

## Data Sources

### Stripe Recurring Revenue
- **Table**: `member_subscription_snapshots` (EOM snapshots)
- **Source**: Members table (`monthly_dues`, `status`) used as proxy for Stripe subscription state
- **Join key**: `member_subscription_snapshots.member_id` → `members.member_id`
- **Stripe linkage**: `accounts.stripe_customer_id` → Stripe customer → `accounts.account_id` → `members.member_id`

**Current compromise**: The app does not store Stripe subscription objects directly. Snapshots are generated from `accounts.monthly_dues` and `members.status`, with the plan interval looked up from `subscription_plans` via `accounts.membership_plan_id`. Enhancement: add a Stripe subscription sync cron that pulls `stripe.subscriptions.list()` and populates `stripe_subscription_id`, plan details, and interval for accurate normalization.

**`monthly_dues` data contract**: The `accounts.monthly_dues` field stores **different values depending on the plan interval**:
- **Monthly plans**: stores the **monthly amount** (e.g. $75 for Duo)
- **Annual plans**: stores the **full annual amount** (e.g. $1,200 for Annual)

The snapshot generator normalizes annual amounts to monthly (`amount / 12`) and sets `plan_interval = 'year'`. **If an annual member is onboarded with a monthly-equivalent amount instead of the full annual amount, MRR will be understated by 12×.** This convention is enforced by the onboarding and plan-change flows (`/api/onboard/complete`, `/api/subscriptions/create`, `/api/subscriptions/update-plan`) but has no DB-level constraint.

### Toast Attach Revenue
- **Table**: `toast_transactions`
- **Join key**: `toast_transactions.member_id` → `members.member_id` (direct FK)
- **Member mapping**: `members.toast_account_id` (phone), `members.toast_customer_id`
- **"Net" definition**: `toast_transactions.amount` as stored. Per the existing ETL convention, this amount represents the transaction value. Tax and tip columns are not stored separately in the current schema; the stored `amount` is treated as net revenue.
- **Limitation**: Only transactions with a non-null `member_id` are included in attach KPIs. Unmapped Toast revenue (where `member_id` is null) is excluded. If Toast data is not reliably tied to member IDs, attach metrics will undercount.

### Failed Payments
- **Current**: Returns 0. The Stripe webhook only records successful payments (`invoice.paid`, `payment_intent.succeeded`).
- **Enhancement**: Add `invoice.payment_failed` webhook handler to store failed payment events, then query them for the last-30-days count.

---

## Granularity & Timezone

- **Granularity**: Monthly (calendar month)
- **Timezone**: `America/Chicago` (from `settings.timezone`; hardcoded default)
- **Snapshot model**: End-of-month (EOM) — each member's subscription state is captured at month-end

---

## Metric Definitions

### A) Stripe Recurring Metrics

#### MRR (Monthly Recurring Revenue)
- **Includes only monthly-interval members** (`plan_interval = 'month'`)
- Sum of `mrr` for members with `subscription_status = 'active'` and `plan_interval = 'month'`
- Annual memberships are **excluded** from MRR (see ARR below)
- **Excludes**: taxes, one-time charges, refunds (MRR is contractual recurring value)
- **Multiple subscriptions**: If a member has multiple, aggregate to member-level MRR

#### ARR (Annual Recurring Revenue)
- **Includes all recurring revenue** (monthly and annual memberships)
- Computed from the full (unfiltered) bridge: `ARR = all_members_ending_MRR × 12`
- Since annual members' MRR is normalized (`plan_amount / 12`), multiplying by 12 recovers the annual amount

#### Active Members (EOM)
- Members with `mrr > 0` at end-of-month

#### Paused Members (EOM)
- Members with `mrr = 0` AND `subscription_status = 'paused'`
- **Separate bucket**: not counted as active, not counted as churn

#### MRR Bridge (Month-over-Month)
For each member, let `prior` = EOM MRR for prior month, `curr` = EOM MRR for current month.

| Component | Formula |
|-----------|---------|
| **Starting MRR** | `SUM(prior)` where `prior > 0` |
| **Ending MRR** | `SUM(curr)` where `curr > 0` |
| **New MRR** | `SUM(curr)` where `prior = 0` AND member's `first_paid_date` is within current month |
| **Expansion MRR** | `SUM(curr - prior)` where `curr > prior` AND `prior > 0` |
| **Contraction MRR** | `SUM(prior - curr)` where `curr < prior` AND `curr > 0` |
| **Churned MRR** | `SUM(prior)` where `prior > 0` AND `curr = 0` AND member is NOT paused |
| **Paused MRR** | `SUM(prior)` where `prior > 0` AND `curr = 0` AND member IS paused at EOM |
| **Net New MRR** | `New + Expansion - Contraction - Churned - Paused` |

**Reactivation**: Members with `prior = 0` and `curr > 0` whose `first_paid_date` is NOT in the current month are treated as expansion (reactivation), not new.

**Plan interval filtering**: The MRR bridge used for the MRR and Net New MRR cards is computed with `planIntervalFilter = 'month'`, excluding annual members. A separate unfiltered bridge is computed for retention rates (NRR, GRR) and ARR.

**Plan-interval change edge case**: If a member switches from monthly → annual between snapshot months, they will appear as **churned** in the monthly-only bridge (present in filtered prior, absent from filtered current) and as **new/expansion** in the full bridge for the annual pool. This is expected behavior — a plan type change is a churn from one billing cohort and an acquisition in another. The overall ARR and retention rates remain correct.

**Reconciliation**: `Ending MRR = Starting MRR + Net New MRR`

#### NRR (Net Revenue Retention)
```
NRR = (Starting MRR + Expansion - Contraction - Churned) / Starting MRR
```

#### GRR (Gross Revenue Retention)
```
GRR = (Starting MRR - Contraction - Churned) / Starting MRR
```

#### Churned Members
- Members with `prior MRR > 0` AND `current MRR = 0` AND NOT paused at EOM

#### Logo Churn Rate
```
Logo Churn Rate = Churned Members / Prior EOM Active Members
```

#### Revenue Churn Rate
```
Revenue Churn Rate = Churned MRR / Starting MRR
```

### B) Toast Attach Metrics

#### Attach Revenue (Monthly)
- Sum of `toast_transactions.amount` for completed transactions (`status = 'completed'`) within the month, where `member_id IS NOT NULL`
- Refunds/voids reduce revenue (negative amounts or separate status)

#### Attach Rate
```
Attach Rate = (# EOM active members with attach revenue > 0) / EOM Active Members
```

#### All-in ARPM (Average Revenue Per Member)
```
All-in ARPM = (MRR + Attach Revenue) / EOM Active Members
```
- **Note**: MRR is used as the membership revenue proxy (run-rate, not cash collected)

### C) Cohort Retention

- **Cohort**: Members grouped by `first_paid_date` month (join month)
- For each cohort month `c` and calendar month `m >= c`:
```
retention(c, m) = (# members in cohort c active at EOM of month m) / (# members in cohort c at EOM of month c)
```
- Displayed as a matrix/heatmap with color coding

### D) Alerts (v1)

| Alert | Metric | Threshold | Type |
|-------|--------|-----------|------|
| NRR Below 95% | `nrr` | 0.95 | below |
| Logo Churn Above 5% | `logoChurnRate` | 0.05 | above |
| Attach ARPM Drop > 20% MoM | `attachArpmDropPct` | 0.20 | above |
| Failed Payments > 5 (30d) | `failedPayments30d` | 5 | above |

Thresholds are stored in `business_dashboard_alerts` table and can be updated via DB.

---

## API Endpoints

| Endpoint | Method | Params | Returns |
|----------|--------|--------|---------|
| `/api/admin/business-summary` | GET | `month` (YYYY-MM-01) | Full KPI summary + alerts |
| `/api/admin/business-series` | GET | `month`, `months` (count) | Time series for charts |
| `/api/admin/business-cohorts` | GET | `month`, `months` (count) | Cohort retention matrix |
| `/api/admin/business-drilldown` | GET | `type` (churned/expansion/attach), `month` | Drill-down table data |
| `/api/admin/business-snapshot` | POST | `month` | Generate/refresh EOM snapshots |

All endpoints require admin Bearer token authentication.

---

## Database Tables

### `member_subscription_snapshots`
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `member_id` | UUID (FK) | Reference to members |
| `snapshot_month` | DATE | First day of month (e.g., 2026-02-01) |
| `mrr` | DECIMAL(10,2) | Normalized monthly recurring revenue |
| `plan_name` | TEXT | Plan description |
| `plan_interval` | TEXT | month, year, week |
| `plan_amount` | DECIMAL(10,2) | Raw plan price |
| `subscription_status` | TEXT | active, paused, canceled, trialing |
| `stripe_subscription_id` | TEXT | Stripe subscription ID (nullable) |
| `stripe_customer_id` | TEXT | Stripe customer ID |
| `first_paid_date` | DATE | First-ever paid date (for cohorts) |

**Unique constraint**: `(member_id, snapshot_month)`

### `business_dashboard_alerts`
| Column | Type | Description |
|--------|------|-------------|
| `alert_key` | TEXT (unique) | Alert identifier |
| `label` | TEXT | Display name |
| `threshold_value` | DECIMAL | Configurable threshold |
| `threshold_type` | TEXT | 'below' or 'above' |
| `metric_key` | TEXT | Which metric to evaluate |
| `is_triggered` | BOOLEAN | Current trigger state |
| `current_value` | DECIMAL | Last computed value |

---

## Files Changed/Added

### New Files
- `src/lib/businessMetrics.ts` — Central metrics module
- `src/lib/__tests__/businessMetrics.test.ts` — Unit tests (30 tests)
- `src/pages/admin/business.tsx` — Dashboard UI page
- `src/styles/BusinessDashboard.module.css` — Dashboard styles
- `src/pages/api/admin/business-summary.ts` — Summary API
- `src/pages/api/admin/business-series.ts` — Series API
- `src/pages/api/admin/business-cohorts.ts` — Cohorts API
- `src/pages/api/admin/business-drilldown.ts` — Drilldown API
- `src/pages/api/admin/business-snapshot.ts` — Snapshot generation API
- `supabase/migrations/20260213_add_business_dashboard_tables.sql` — DB migration
- `docs/metrics-business-dashboard.md` — This document

### Modified Files
- `src/components/layouts/AdminLayout.tsx` — Added "Business" nav item with TrendingUp icon

---

## Compromises & TODOs

1. **Subscription data proxy**: MRR is computed from `accounts.monthly_dues` + `members.status`, not from Stripe subscription objects. Plan interval is resolved via `accounts.membership_plan_id` → `subscription_plans.interval`. TODO: Add Stripe subscription sync (cron/webhook) that stores `stripe_subscription_id`, `plan_interval`, `plan_amount` accurately.

2. **`monthly_dues` data contract**: The `accounts.monthly_dues` field stores the monthly amount for monthly plans and the full annual amount for annual plans. This convention has no DB-level constraint — incorrect values at data entry will silently misstate MRR. TODO: Add a CHECK constraint or validation trigger, or migrate to separate `monthly_amount` / `annual_amount` columns.

3. **Failed payments**: Returns 0 because the webhook only handles successful payments. TODO: Add `invoice.payment_failed` webhook handler and store failed events.

4. **Toast net revenue**: The `amount` field in `toast_transactions` is used as-is. No separate tax/tip columns exist in the current schema. If Toast ETL stores gross amounts, a post-processing step would be needed to deduct tax/tip.

5. **Toast member attribution**: Only transactions with `member_id IS NOT NULL` are included. Unmapped transactions are excluded from all attach KPIs. Monitor the mapping coverage via `SELECT COUNT(*) FROM toast_transactions WHERE member_id IS NULL`.

6. **Snapshot generation**: Snapshots must be manually triggered via the "Refresh Snapshot" button or the POST endpoint. TODO: Add a cron job to auto-generate snapshots at month-end.

7. **Server-side caching**: No caching implemented. For production, add 5-15 minute cache on summary/series endpoints since data is internal-use and doesn't change frequently.
