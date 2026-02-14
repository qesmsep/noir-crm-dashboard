-- Business Dashboard: EOM subscription snapshots + alert configuration
-- Supports MRR tracking, member health, cohort retention, and alerting

-- 1. Member Subscription Snapshots (End-of-Month)
-- Captures each member's recurring subscription state at month-end.
-- Source of truth for MRR, active/paused/churned member counts.
CREATE TABLE IF NOT EXISTS public.member_subscription_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id UUID NOT NULL REFERENCES members(member_id),
    snapshot_month DATE NOT NULL, -- first day of the month (e.g., 2026-02-01)
    mrr DECIMAL(10,2) NOT NULL DEFAULT 0, -- normalized monthly recurring revenue
    plan_name TEXT, -- e.g., "Monthly Membership", "Annual Membership"
    plan_interval TEXT DEFAULT 'month', -- month, year, week, etc.
    plan_amount DECIMAL(10,2) DEFAULT 0, -- raw plan price before normalization
    subscription_status TEXT NOT NULL DEFAULT 'active', -- active, paused, canceled, trialing
    stripe_subscription_id TEXT, -- Stripe subscription ID if available
    stripe_customer_id TEXT, -- Stripe customer ID for reconciliation
    first_paid_date DATE, -- member's first-ever paid subscription start date (for cohort assignment)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(member_id, snapshot_month)
);

-- Indexes for snapshot queries
CREATE INDEX IF NOT EXISTS idx_sub_snapshots_month ON member_subscription_snapshots(snapshot_month);
CREATE INDEX IF NOT EXISTS idx_sub_snapshots_member ON member_subscription_snapshots(member_id);
CREATE INDEX IF NOT EXISTS idx_sub_snapshots_status ON member_subscription_snapshots(subscription_status);
CREATE INDEX IF NOT EXISTS idx_sub_snapshots_month_status ON member_subscription_snapshots(snapshot_month, subscription_status);
CREATE INDEX IF NOT EXISTS idx_sub_snapshots_first_paid ON member_subscription_snapshots(first_paid_date);

-- 2. Business Dashboard Alerts
CREATE TABLE IF NOT EXISTS public.business_dashboard_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_key TEXT NOT NULL UNIQUE, -- e.g., 'nrr_below_threshold'
    label TEXT NOT NULL,
    description TEXT,
    threshold_value DECIMAL(10,4), -- configurable threshold
    threshold_type TEXT NOT NULL DEFAULT 'below', -- 'below', 'above'
    metric_key TEXT NOT NULL, -- which metric to evaluate
    is_enabled BOOLEAN DEFAULT true,
    is_triggered BOOLEAN DEFAULT false,
    last_evaluated_at TIMESTAMPTZ,
    last_triggered_at TIMESTAMPTZ,
    current_value DECIMAL(10,4),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default alert rules
INSERT INTO public.business_dashboard_alerts (alert_key, label, description, threshold_value, threshold_type, metric_key) VALUES
    ('nrr_below_threshold', 'NRR Below 95%', 'Net Revenue Retention has dropped below 95% for the current month', 0.9500, 'below', 'nrr'),
    ('logo_churn_above_threshold', 'Logo Churn Above 5%', 'Member (logo) churn rate exceeds 5% for the current month', 0.0500, 'above', 'logoChurnRate'),
    ('attach_arpm_drop', 'Attach Revenue Per Member Drop > 20%', 'Attach revenue per active member dropped more than 20% month-over-month', 0.2000, 'above', 'attachArpmDropPct'),
    ('failed_payments_high', 'Failed Payments Above 5', 'More than 5 failed payment attempts in the last 30 days', 5.0000, 'above', 'failedPayments30d')
ON CONFLICT (alert_key) DO NOTHING;

-- RLS
ALTER TABLE public.member_subscription_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_dashboard_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage subscription snapshots"
    ON public.member_subscription_snapshots FOR ALL USING (true);

CREATE POLICY "Admins can manage business alerts"
    ON public.business_dashboard_alerts FOR ALL USING (true);

-- Updated_at trigger for alerts
CREATE OR REPLACE FUNCTION update_business_alerts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_business_alerts_updated_at
    BEFORE UPDATE ON public.business_dashboard_alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_business_alerts_updated_at();

COMMENT ON TABLE public.member_subscription_snapshots IS 'End-of-month subscription snapshots for MRR and member health metrics. Source: member data + Stripe subscriptions.';
COMMENT ON TABLE public.business_dashboard_alerts IS 'Configurable alert rules for the business dashboard. Thresholds editable by admins.';
COMMENT ON COLUMN public.member_subscription_snapshots.mrr IS 'Normalized monthly recurring revenue: monthly plan => amount, annual => amount/12, etc.';
COMMENT ON COLUMN public.member_subscription_snapshots.first_paid_date IS 'Member first-ever paid subscription start date. Used for cohort assignment.';
