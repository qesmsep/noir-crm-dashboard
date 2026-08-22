import {
  classifyPlan,
  classifyPurchaseLocation,
  isVisit,
  isDuesCash,
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
