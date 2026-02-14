/**
 * Unit tests for the Business Dashboard metrics module.
 *
 * Tests cover:
 * - Helper functions (monthStart, priorMonthStart, monthEnd, monthsBack)
 * - MRR bridge computation (new, expansion, contraction, churn, pause, reactivation)
 * - Member counts computation
 * - Retention rates (NRR, GRR, logo churn, revenue churn)
 * - Attach metrics computation
 * - Edge cases: empty data, single member, zero MRR
 */

import {
  monthStart,
  priorMonthStart,
  monthEnd,
  monthsBack,
  computeMrrBridge,
  computeMemberCounts,
  computeRetentionRates,
  computeAttachMetrics,
  MemberSnapshot,
  MrrBridge,
} from '../businessMetrics';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSnapshot(overrides: Partial<MemberSnapshot> & { member_id: string; snapshot_month: string }): MemberSnapshot {
  return {
    mrr: 0,
    plan_name: 'Membership',
    plan_interval: 'month',
    plan_amount: 0,
    subscription_status: 'active',
    stripe_subscription_id: null,
    stripe_customer_id: null,
    first_paid_date: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helper function tests
// ---------------------------------------------------------------------------

describe('Helper functions', () => {
  test('monthStart returns YYYY-MM-01', () => {
    expect(monthStart(new Date('2026-02-15'))).toBe('2026-02-01');
    expect(monthStart(new Date('2026-12-31'))).toBe('2026-12-01');
    expect(monthStart(new Date('2026-01-01'))).toBe('2026-01-01');
  });

  test('priorMonthStart returns previous month', () => {
    expect(priorMonthStart('2026-02-01')).toBe('2026-01-01');
    expect(priorMonthStart('2026-01-01')).toBe('2025-12-01');
    expect(priorMonthStart('2026-03-01')).toBe('2026-02-01');
  });

  test('monthEnd returns last day of month', () => {
    expect(monthEnd('2026-02-01')).toBe('2026-02-28');
    expect(monthEnd('2024-02-01')).toBe('2024-02-29'); // leap year
    expect(monthEnd('2026-01-01')).toBe('2026-01-31');
    expect(monthEnd('2026-12-01')).toBe('2026-12-31');
  });

  test('monthsBack returns N months in ascending order', () => {
    const result = monthsBack('2026-06-01', 3);
    expect(result).toEqual(['2026-04-01', '2026-05-01', '2026-06-01']);
  });

  test('monthsBack with 1 month returns just that month', () => {
    expect(monthsBack('2026-02-01', 1)).toEqual(['2026-02-01']);
  });

  test('monthsBack across year boundary', () => {
    const result = monthsBack('2026-02-01', 4);
    expect(result).toEqual(['2025-11-01', '2025-12-01', '2026-01-01', '2026-02-01']);
  });
});

// ---------------------------------------------------------------------------
// MRR Bridge tests
// ---------------------------------------------------------------------------

describe('computeMrrBridge', () => {
  test('empty prior and current returns all zeros', () => {
    const bridge = computeMrrBridge([], []);
    expect(bridge.startingMrr).toBe(0);
    expect(bridge.endingMrr).toBe(0);
    expect(bridge.newMrr).toBe(0);
    expect(bridge.expansionMrr).toBe(0);
    expect(bridge.contractionMrr).toBe(0);
    expect(bridge.churnedMrr).toBe(0);
    expect(bridge.pausedMrr).toBe(0);
    expect(bridge.netNewMrr).toBe(0);
  });

  test('new member: zero prior, positive current, first_paid_date in current month', () => {
    const prior: MemberSnapshot[] = [];
    const current: MemberSnapshot[] = [
      makeSnapshot({
        member_id: 'm1',
        snapshot_month: '2026-02-01',
        mrr: 100,
        first_paid_date: '2026-02-10',
      }),
    ];

    const bridge = computeMrrBridge(prior, current);
    expect(bridge.startingMrr).toBe(0);
    expect(bridge.endingMrr).toBe(100);
    expect(bridge.newMrr).toBe(100);
    expect(bridge.expansionMrr).toBe(0);
    expect(bridge.churnedMrr).toBe(0);
    expect(bridge.netNewMrr).toBe(100);
  });

  test('reactivation: zero prior, positive current, first_paid_date in older month', () => {
    const prior: MemberSnapshot[] = [
      makeSnapshot({
        member_id: 'm1',
        snapshot_month: '2026-01-01',
        mrr: 0,
        subscription_status: 'canceled',
        first_paid_date: '2025-06-15',
      }),
    ];
    const current: MemberSnapshot[] = [
      makeSnapshot({
        member_id: 'm1',
        snapshot_month: '2026-02-01',
        mrr: 100,
        first_paid_date: '2025-06-15',
      }),
    ];

    const bridge = computeMrrBridge(prior, current);
    // Reactivation should count as expansion, not new
    expect(bridge.newMrr).toBe(0);
    expect(bridge.expansionMrr).toBe(100);
    expect(bridge.netNewMrr).toBe(100);
  });

  test('expansion: member increases MRR', () => {
    const prior = [
      makeSnapshot({ member_id: 'm1', snapshot_month: '2026-01-01', mrr: 100 }),
    ];
    const current = [
      makeSnapshot({ member_id: 'm1', snapshot_month: '2026-02-01', mrr: 150 }),
    ];

    const bridge = computeMrrBridge(prior, current);
    expect(bridge.startingMrr).toBe(100);
    expect(bridge.endingMrr).toBe(150);
    expect(bridge.expansionMrr).toBe(50);
    expect(bridge.newMrr).toBe(0);
    expect(bridge.contractionMrr).toBe(0);
    expect(bridge.churnedMrr).toBe(0);
    expect(bridge.netNewMrr).toBe(50);
  });

  test('contraction: member decreases MRR but still active', () => {
    const prior = [
      makeSnapshot({ member_id: 'm1', snapshot_month: '2026-01-01', mrr: 200 }),
    ];
    const current = [
      makeSnapshot({ member_id: 'm1', snapshot_month: '2026-02-01', mrr: 120 }),
    ];

    const bridge = computeMrrBridge(prior, current);
    expect(bridge.contractionMrr).toBe(80);
    expect(bridge.expansionMrr).toBe(0);
    expect(bridge.churnedMrr).toBe(0);
    expect(bridge.netNewMrr).toBe(-80);
  });

  test('churn: member goes to zero MRR (not paused)', () => {
    const prior = [
      makeSnapshot({ member_id: 'm1', snapshot_month: '2026-01-01', mrr: 100 }),
    ];
    const current = [
      makeSnapshot({
        member_id: 'm1',
        snapshot_month: '2026-02-01',
        mrr: 0,
        subscription_status: 'canceled',
      }),
    ];

    const bridge = computeMrrBridge(prior, current);
    expect(bridge.churnedMrr).toBe(100);
    expect(bridge.pausedMrr).toBe(0);
    expect(bridge.netNewMrr).toBe(-100);
  });

  test('pause: member goes to zero MRR with paused status', () => {
    const prior = [
      makeSnapshot({ member_id: 'm1', snapshot_month: '2026-01-01', mrr: 100 }),
    ];
    const current = [
      makeSnapshot({
        member_id: 'm1',
        snapshot_month: '2026-02-01',
        mrr: 0,
        subscription_status: 'paused',
      }),
    ];

    const bridge = computeMrrBridge(prior, current);
    expect(bridge.pausedMrr).toBe(100);
    expect(bridge.churnedMrr).toBe(0);
    expect(bridge.netNewMrr).toBe(-100);
  });

  test('member disappears from current (no record) = churn', () => {
    const prior = [
      makeSnapshot({ member_id: 'm1', snapshot_month: '2026-01-01', mrr: 100 }),
    ];
    const current: MemberSnapshot[] = [];

    const bridge = computeMrrBridge(prior, current);
    expect(bridge.churnedMrr).toBe(100);
    expect(bridge.endingMrr).toBe(0);
  });

  test('complex scenario: mix of new, expansion, contraction, churn, pause', () => {
    const prior = [
      makeSnapshot({ member_id: 'm1', snapshot_month: '2026-01-01', mrr: 100 }), // will expand
      makeSnapshot({ member_id: 'm2', snapshot_month: '2026-01-01', mrr: 200 }), // will contract
      makeSnapshot({ member_id: 'm3', snapshot_month: '2026-01-01', mrr: 150 }), // will churn
      makeSnapshot({ member_id: 'm4', snapshot_month: '2026-01-01', mrr: 80 }),  // will pause
      makeSnapshot({ member_id: 'm5', snapshot_month: '2026-01-01', mrr: 100 }), // stays same
    ];
    const current = [
      makeSnapshot({ member_id: 'm1', snapshot_month: '2026-02-01', mrr: 130 }), // expansion +30
      makeSnapshot({ member_id: 'm2', snapshot_month: '2026-02-01', mrr: 150 }), // contraction -50
      makeSnapshot({ member_id: 'm3', snapshot_month: '2026-02-01', mrr: 0, subscription_status: 'canceled' }), // churn -150
      makeSnapshot({ member_id: 'm4', snapshot_month: '2026-02-01', mrr: 0, subscription_status: 'paused' }), // pause -80
      makeSnapshot({ member_id: 'm5', snapshot_month: '2026-02-01', mrr: 100 }), // no change
      makeSnapshot({ member_id: 'm6', snapshot_month: '2026-02-01', mrr: 90, first_paid_date: '2026-02-05' }), // new +90
    ];

    const bridge = computeMrrBridge(prior, current);
    expect(bridge.startingMrr).toBe(630); // 100+200+150+80+100
    expect(bridge.endingMrr).toBe(470); // 130+150+0+0+100+90
    expect(bridge.newMrr).toBe(90);
    expect(bridge.expansionMrr).toBe(30);
    expect(bridge.contractionMrr).toBe(50);
    expect(bridge.churnedMrr).toBe(150);
    expect(bridge.pausedMrr).toBe(80);
    expect(bridge.netNewMrr).toBe(90 + 30 - 50 - 150 - 80); // = -160
    expect(bridge.endingMrr).toBe(bridge.startingMrr + bridge.netNewMrr);
  });

  test('member with zero prior MRR is not counted in starting MRR', () => {
    const prior = [
      makeSnapshot({ member_id: 'm1', snapshot_month: '2026-01-01', mrr: 0, subscription_status: 'canceled' }),
      makeSnapshot({ member_id: 'm2', snapshot_month: '2026-01-01', mrr: 100 }),
    ];
    const current = [
      makeSnapshot({ member_id: 'm2', snapshot_month: '2026-02-01', mrr: 100 }),
    ];

    const bridge = computeMrrBridge(prior, current);
    expect(bridge.startingMrr).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Member Counts tests
// ---------------------------------------------------------------------------

describe('computeMemberCounts', () => {
  test('empty snapshots', () => {
    const counts = computeMemberCounts([], []);
    expect(counts.activeMembers).toBe(0);
    expect(counts.newMembers).toBe(0);
    expect(counts.churnedMembers).toBe(0);
    expect(counts.pausedMembers).toBe(0);
  });

  test('active members: only those with mrr > 0', () => {
    const current = [
      makeSnapshot({ member_id: 'm1', snapshot_month: '2026-02-01', mrr: 100 }),
      makeSnapshot({ member_id: 'm2', snapshot_month: '2026-02-01', mrr: 0, subscription_status: 'canceled' }),
      makeSnapshot({ member_id: 'm3', snapshot_month: '2026-02-01', mrr: 50 }),
    ];
    const counts = computeMemberCounts(current, []);
    expect(counts.activeMembers).toBe(2);
  });

  test('new members: first_paid_date in current month', () => {
    const current = [
      makeSnapshot({ member_id: 'm1', snapshot_month: '2026-02-01', mrr: 100, first_paid_date: '2026-02-10' }),
      makeSnapshot({ member_id: 'm2', snapshot_month: '2026-02-01', mrr: 100, first_paid_date: '2025-12-01' }),
    ];
    const counts = computeMemberCounts(current, []);
    expect(counts.newMembers).toBe(1);
  });

  test('paused members: mrr=0 and status=paused', () => {
    const current = [
      makeSnapshot({ member_id: 'm1', snapshot_month: '2026-02-01', mrr: 0, subscription_status: 'paused' }),
      makeSnapshot({ member_id: 'm2', snapshot_month: '2026-02-01', mrr: 0, subscription_status: 'canceled' }),
    ];
    const counts = computeMemberCounts(current, []);
    expect(counts.pausedMembers).toBe(1);
    expect(counts.activeMembers).toBe(0);
  });

  test('churned members: prior mrr>0, current mrr=0, not paused', () => {
    const prior = [
      makeSnapshot({ member_id: 'm1', snapshot_month: '2026-01-01', mrr: 100 }),
      makeSnapshot({ member_id: 'm2', snapshot_month: '2026-01-01', mrr: 200 }),
      makeSnapshot({ member_id: 'm3', snapshot_month: '2026-01-01', mrr: 150 }),
    ];
    const current = [
      makeSnapshot({ member_id: 'm1', snapshot_month: '2026-02-01', mrr: 100 }), // still active
      makeSnapshot({ member_id: 'm2', snapshot_month: '2026-02-01', mrr: 0, subscription_status: 'canceled' }), // churned
      makeSnapshot({ member_id: 'm3', snapshot_month: '2026-02-01', mrr: 0, subscription_status: 'paused' }), // paused, not churned
    ];
    const counts = computeMemberCounts(current, prior);
    expect(counts.churnedMembers).toBe(1); // only m2
  });

  test('member missing from current = churned', () => {
    const prior = [
      makeSnapshot({ member_id: 'm1', snapshot_month: '2026-01-01', mrr: 100 }),
    ];
    const current: MemberSnapshot[] = [];
    const counts = computeMemberCounts(current, prior);
    expect(counts.churnedMembers).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Retention Rates tests
// ---------------------------------------------------------------------------

describe('computeRetentionRates', () => {
  test('perfect retention: NRR=1, GRR=1, no churn', () => {
    const bridge: MrrBridge = {
      startingMrr: 1000,
      endingMrr: 1000,
      newMrr: 0,
      expansionMrr: 0,
      contractionMrr: 0,
      churnedMrr: 0,
      pausedMrr: 0,
      netNewMrr: 0,
    };
    const counts = { activeMembers: 10, newMembers: 0, churnedMembers: 0, pausedMembers: 0 };
    const rates = computeRetentionRates(bridge, counts, 10);

    expect(rates.nrr).toBe(1);
    expect(rates.grr).toBe(1);
    expect(rates.logoChurnRate).toBe(0);
    expect(rates.revenueChurnRate).toBe(0);
  });

  test('NRR > 1 with expansion', () => {
    const bridge: MrrBridge = {
      startingMrr: 1000,
      endingMrr: 1100,
      newMrr: 0,
      expansionMrr: 200,
      contractionMrr: 50,
      churnedMrr: 50,
      pausedMrr: 0,
      netNewMrr: 100,
    };
    const counts = { activeMembers: 10, newMembers: 0, churnedMembers: 1, pausedMembers: 0 };
    const rates = computeRetentionRates(bridge, counts, 10);

    // NRR = (1000 + 200 - 50 - 50) / 1000 = 1.1
    expect(rates.nrr).toBe(1.1);
    // GRR = (1000 - 50 - 50) / 1000 = 0.9
    expect(rates.grr).toBe(0.9);
    // Logo churn = 1/10
    expect(rates.logoChurnRate).toBe(0.1);
    // Revenue churn = 50/1000
    expect(rates.revenueChurnRate).toBe(0.05);
  });

  test('zero starting MRR returns defaults', () => {
    const bridge: MrrBridge = {
      startingMrr: 0,
      endingMrr: 100,
      newMrr: 100,
      expansionMrr: 0,
      contractionMrr: 0,
      churnedMrr: 0,
      pausedMrr: 0,
      netNewMrr: 100,
    };
    const counts = { activeMembers: 1, newMembers: 1, churnedMembers: 0, pausedMembers: 0 };
    const rates = computeRetentionRates(bridge, counts, 0);

    expect(rates.nrr).toBe(1); // fallback
    expect(rates.grr).toBe(1); // fallback
    expect(rates.logoChurnRate).toBe(0); // 0/0 fallback
  });
});

// ---------------------------------------------------------------------------
// Attach Metrics tests
// ---------------------------------------------------------------------------

describe('computeAttachMetrics', () => {
  test('basic attach metrics', () => {
    const memberRevenue = new Map<string, number>();
    memberRevenue.set('m1', 500);
    memberRevenue.set('m2', 300);
    memberRevenue.set('m3', 0);

    const metrics = computeAttachMetrics(memberRevenue, 800, 10, 1000);

    expect(metrics.attachRevenue).toBe(800);
    expect(metrics.membersWithAttach).toBe(2); // m1 and m2 (m3 has 0)
    expect(metrics.attachRate).toBe(0.2); // 2/10
    // All-in ARPM = (1000 + 800) / 10 = 180
    expect(metrics.allInArpm).toBe(180);
  });

  test('no active members returns zero ARPM', () => {
    const memberRevenue = new Map<string, number>();
    memberRevenue.set('m1', 100);

    const metrics = computeAttachMetrics(memberRevenue, 100, 0, 0);
    expect(metrics.allInArpm).toBe(0);
    expect(metrics.attachRate).toBe(0);
  });

  test('empty revenue map', () => {
    const memberRevenue = new Map<string, number>();
    const metrics = computeAttachMetrics(memberRevenue, 0, 5, 500);
    expect(metrics.attachRevenue).toBe(0);
    expect(metrics.membersWithAttach).toBe(0);
    expect(metrics.attachRate).toBe(0);
    // All-in ARPM = (500 + 0) / 5 = 100
    expect(metrics.allInArpm).toBe(100);
  });

  test('attach revenue with unmapped members excluded', () => {
    // Only members with member_id are included in the map
    // This test verifies the function correctly handles the pre-filtered data
    const memberRevenue = new Map<string, number>();
    memberRevenue.set('m1', 250);
    // Suppose there was $100 of unmapped revenue - it's NOT in memberRevenue or totalRevenue
    // The API layer filters it out before passing to this function

    const metrics = computeAttachMetrics(memberRevenue, 250, 5, 500);
    expect(metrics.attachRevenue).toBe(250);
    expect(metrics.membersWithAttach).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Integration-style bridge validation
// ---------------------------------------------------------------------------

describe('MRR bridge reconciliation', () => {
  test('ending MRR = starting MRR + net new MRR', () => {
    const prior = [
      makeSnapshot({ member_id: 'm1', snapshot_month: '2026-01-01', mrr: 100 }),
      makeSnapshot({ member_id: 'm2', snapshot_month: '2026-01-01', mrr: 200 }),
      makeSnapshot({ member_id: 'm3', snapshot_month: '2026-01-01', mrr: 300 }),
    ];
    const current = [
      makeSnapshot({ member_id: 'm1', snapshot_month: '2026-02-01', mrr: 120 }), // +20 expansion
      makeSnapshot({ member_id: 'm2', snapshot_month: '2026-02-01', mrr: 0, subscription_status: 'canceled' }), // churn -200
      makeSnapshot({ member_id: 'm3', snapshot_month: '2026-02-01', mrr: 300 }), // no change
      makeSnapshot({ member_id: 'm4', snapshot_month: '2026-02-01', mrr: 80, first_paid_date: '2026-02-01' }), // new +80
    ];

    const bridge = computeMrrBridge(prior, current);

    // Verify: ending = starting + net new
    expect(bridge.endingMrr).toBe(bridge.startingMrr + bridge.netNewMrr);

    // Verify: net new = new + expansion - contraction - churned - paused
    expect(bridge.netNewMrr).toBe(
      bridge.newMrr + bridge.expansionMrr - bridge.contractionMrr - bridge.churnedMrr - bridge.pausedMrr
    );
  });
});
