import {
  classifyPlan,
  classifyPurchaseLocation,
  isVisit,
  isDuesCash,
  aggregateLedger,
  CoreLedgerRow,
  addDays,
  monthStartOf,
  shiftMonth,
  weekStartOf,
  round2,
} from '../businessMetricsCore';

describe('classifyPlan', () => {
  it('classifies Noir plans including annual and legacy Solo', () => {
    expect(classifyPlan('Noir Membership')).toBe('noir');
    expect(classifyPlan('Annual')).toBe('noir');
    expect(classifyPlan('Annual - Old')).toBe('noir');
    expect(classifyPlan('Solo')).toBe('noir');
  });

  it('classifies Skyline plans', () => {
    expect(classifyPlan('Skyline')).toBe('skyline');
    expect(classifyPlan('Skyline Premium')).toBe('skyline');
  });

  it('classifies host/legacy/unknown as other', () => {
    expect(classifyPlan('Host Member')).toBe('other');
    expect(classifyPlan('TCC Member')).toBe('other');
    expect(classifyPlan(null)).toBe('other');
    expect(classifyPlan(undefined)).toBe('other');
    expect(classifyPlan('')).toBe('other');
  });
});

describe('classifyPurchaseLocation / isVisit', () => {
  it('maps Noir attendance and visits', () => {
    expect(classifyPurchaseLocation('Noir Attendance')).toBe('noir');
    expect(classifyPurchaseLocation('Noir Visit')).toBe('noir');
    expect(classifyPurchaseLocation('Attendance')).toBe('noir');
  });

  it('maps RooftopKC purchases including fireworks tickets', () => {
    expect(classifyPurchaseLocation('RooftopKC Attendance')).toBe('rooftop');
    expect(classifyPurchaseLocation('Rooftop Fireworks Tickets-2')).toBe('rooftop');
  });

  it('maps everything else to other', () => {
    expect(classifyPurchaseLocation('NYE table for 6')).toBe('other');
    expect(classifyPurchaseLocation('Event Tab')).toBe('other');
    expect(classifyPurchaseLocation(null)).toBe('other');
  });

  it('isVisit is true only for physical-location purchases', () => {
    expect(isVisit('Noir Attendance')).toBe(true);
    expect(isVisit('RooftopKC Attendance')).toBe(true);
    expect(isVisit('Event Tab')).toBe(false);
  });
});

describe('isDuesCash', () => {
  it('counts billing-cron credits regardless of note wording', () => {
    expect(isDuesCash('credit', 'Monthly dues - August 2026', 'billing_cron')).toBe(true);
    expect(isDuesCash('credit', 'anything at all', 'billing_cron')).toBe(true);
  });

  it('counts dues/membership/subscription-noted credits and payments', () => {
    expect(isDuesCash('credit', 'Monthly dues - July 2026', 'legacy')).toBe(true);
    expect(isDuesCash('payment', 'ACH payment: Monthly dues - August 2026', null)).toBe(true);
    expect(isDuesCash('payment', 'Initial Noir Membership membership payment', null)).toBe(true);
    expect(isDuesCash('payment', 'Manual payment: Subscription update', null)).toBe(true);
  });

  it('excludes balance settlements and goodwill credits', () => {
    expect(isDuesCash('payment', 'Balance charged via Stripe', 'stripe_webhook')).toBe(false);
    expect(isDuesCash('credit', 'Onboarding ACH inconvenience TW', 'legacy')).toBe(false);
    expect(isDuesCash('credit', 'Credit added-card ran in error', 'legacy')).toBe(false);
  });

  it('excludes non-cash ledger types entirely', () => {
    expect(isDuesCash('purchase', 'Refund for March Dues - TW', null)).toBe(false);
    expect(isDuesCash('charge', 'Membership administration fee', null)).toBe(false);
  });
});

describe('date helpers', () => {
  it('addDays crosses month and year boundaries', () => {
    expect(addDays('2026-08-30', 5)).toBe('2026-09-04');
    expect(addDays('2026-12-30', 5)).toBe('2027-01-04');
    expect(addDays('2026-08-22', -30)).toBe('2026-07-23');
  });

  it('monthStartOf and shiftMonth', () => {
    expect(monthStartOf('2026-08-22')).toBe('2026-08-01');
    expect(shiftMonth('2026-08-01', -1)).toBe('2026-07-01');
    expect(shiftMonth('2026-01-01', -1)).toBe('2025-12-01');
    expect(shiftMonth('2026-12-01', 1)).toBe('2027-01-01');
  });

  it('weekStartOf returns the Monday of the ISO week', () => {
    expect(weekStartOf('2026-08-22')).toBe('2026-08-17'); // Saturday -> Monday
    expect(weekStartOf('2026-08-17')).toBe('2026-08-17'); // Monday stays
    expect(weekStartOf('2026-08-23')).toBe('2026-08-17'); // Sunday belongs to same ISO week
  });

  it('round2', () => {
    expect(round2(26675 / 12)).toBe(2222.92);
    expect(round2(0.005)).toBe(0.01);
  });
});

describe('aggregateLedger', () => {
  // Current month: Aug 2026; last full month: Jul 2026
  const MONTH = '2026-08-01';
  const NEXT = '2026-09-01';
  const LAST = '2026-07-01';
  const TREND = ['2026-07-01', '2026-08-01'];

  const row = (partial: Partial<CoreLedgerRow>): CoreLedgerRow => ({
    account_id: 'acct-1',
    type: 'purchase',
    amount: -10,
    note: 'Noir Attendance',
    source: null,
    date: '2026-08-05',
    ...partial,
  });

  it('buckets dues cash into MTD vs last month by date boundary', () => {
    const agg = aggregateLedger([
      row({ type: 'credit', amount: 150, note: 'Monthly dues - August 2026', source: 'billing_cron', date: '2026-08-01' }),
      row({ type: 'credit', amount: 150, note: 'Monthly dues - July 2026', source: 'billing_cron', date: '2026-07-31' }),
      // boundary: first instant of next month is NOT MTD
      row({ type: 'credit', amount: 150, note: 'Monthly dues', source: 'billing_cron', date: '2026-09-01' }),
      // balance settlement never counts as dues
      row({ type: 'payment', amount: 200, note: 'Balance charged via Stripe', date: '2026-08-10' }),
    ], MONTH, NEXT, LAST, TREND);

    expect(agg.duesCashMTD).toBe(150);
    expect(agg.duesCashLastMonth).toBe(150);
  });

  it('aggregates purchase revenue, visits and unique accounts by month and location', () => {
    const agg = aggregateLedger([
      row({ amount: -40, note: 'Noir Attendance', date: '2026-08-05' }),
      row({ amount: -60, note: 'Noir Visit', date: '2026-08-06' }),
      row({ amount: -20, note: 'RooftopKC Attendance', date: '2026-08-06', account_id: 'acct-2' }),
      row({ amount: -30, note: 'Event Tab', date: '2026-08-07' }),
      row({ amount: -99, note: 'Noir Attendance', date: '2026-07-15' }),
    ], MONTH, NEXT, LAST, TREND);

    const aug = agg.locByMonth.get(MONTH)!;
    expect(aug.noir.revenue).toBe(100);
    expect(aug.noir.visits).toBe(2);
    expect(aug.noir.accounts.size).toBe(1);
    expect(aug.rooftop.revenue).toBe(20);
    expect(aug.other.revenue).toBe(30);
    expect(agg.locByMonth.get(LAST)!.noir.revenue).toBe(99);
  });

  it('tracks balances, last visit, MTD visitors, and last-month spend per account', () => {
    const agg = aggregateLedger([
      row({ type: 'credit', amount: 100, note: 'Monthly dues - July 2026', source: 'billing_cron', date: '2026-07-01' }),
      row({ amount: -80, note: 'Noir Attendance', date: '2026-07-10' }),
      row({ amount: -30, note: 'Noir Attendance', date: '2026-08-02' }),
      row({ amount: -25, note: 'Event Tab', date: '2026-08-03', account_id: 'acct-2' }),
    ], MONTH, NEXT, LAST, TREND);

    expect(agg.balanceByAccount.get('acct-1')).toBe(-10); // 100 - 80 - 30
    expect(agg.lastVisitByAccount.get('acct-1')).toBe('2026-08-02');
    expect(agg.visitedMTD.has('acct-1')).toBe(true);
    // Event-only purchases are not visits
    expect(agg.visitedMTD.has('acct-2')).toBe(false);
    expect(agg.spendLastMonthByAccount.get('acct-1')).toBe(80);
  });

  it('counts purchases with empty notes as a data-quality signal', () => {
    const agg = aggregateLedger([
      row({ note: null, date: '2026-08-05' }),
      row({ note: '   ', date: '2026-08-05' }),
      row({ note: 'Noir Attendance', date: '2026-08-05' }),
    ], MONTH, NEXT, LAST, TREND);
    expect(agg.purchasesWithEmptyNote).toBe(2);
  });
});
