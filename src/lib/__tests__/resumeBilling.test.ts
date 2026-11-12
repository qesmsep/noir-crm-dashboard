jest.mock('stripe', () => jest.fn().mockImplementation(() => ({})));
jest.mock('@supabase/supabase-js', () => ({ createClient: () => ({}) }));

import { nextCycleDate, computeDuesCharge, parseFeePercentage } from '../billing';

describe('nextCycleDate', () => {
  it('returns the next billing day after today (Kiah: anchor 8/15, unpaused 11/12 → 11/15)', () => {
    expect(nextCycleDate('2026-08-15', 'month', '2026-11-12')).toBe('2026-11-15');
  });

  it('is strictly after today — unpausing on the billing day defers a full cycle', () => {
    expect(nextCycleDate('2026-08-15', 'month', '2026-11-15')).toBe('2026-12-15');
  });

  it('rolls into the next month once the billing day has passed', () => {
    expect(nextCycleDate('2026-08-15', 'month', '2026-11-20')).toBe('2026-12-15');
  });

  it('clamps a 31st anchor to month end without drifting', () => {
    expect(nextCycleDate('2026-01-31', 'month', '2026-02-10')).toBe('2026-02-28');
    expect(nextCycleDate('2026-01-31', 'month', '2026-03-01')).toBe('2026-03-31');
    expect(nextCycleDate('2027-12-31', 'month', '2028-02-01')).toBe('2028-02-29');
  });

  it('handles yearly plans and year boundaries', () => {
    expect(nextCycleDate('2025-03-10', 'year', '2026-11-12')).toBe('2027-03-10');
    expect(nextCycleDate('2026-12-05', 'month', '2026-12-20')).toBe('2027-01-05');
  });

  it('falls back to today on a malformed anchor instead of writing NaN', () => {
    expect(nextCycleDate('', 'month', '2026-11-12')).toBe('2026-12-12');
    expect(nextCycleDate('not-a-date', 'month', '2026-11-12')).toBe('2026-12-12');
    expect(nextCycleDate(null as any, 'month', '2026-11-12')).toBe('2026-12-12');
  });

  it('accepts a timestamp anchor and an anchor already in the future', () => {
    expect(nextCycleDate('2026-08-15 00:00:00+00', 'month', '2026-11-12')).toBe('2026-11-15');
    expect(nextCycleDate('2026-12-01', 'month', '2026-11-12')).toBe('2026-12-01');
  });
});

describe('parseFeePercentage', () => {
  it('keeps a configured 0% as 0% (was turned into 4% by `|| 4.0`)', () => {
    expect(parseFeePercentage(0)).toBe(0);
    expect(parseFeePercentage('0.00')).toBe(0);
  });

  it('reads numeric and string settings values', () => {
    expect(parseFeePercentage(4)).toBe(4);
    expect(parseFeePercentage('4.00')).toBe(4);
    expect(parseFeePercentage('3.5')).toBe(3.5);
  });

  it('falls back to 4% only when unset or invalid', () => {
    expect(parseFeePercentage(null)).toBe(4);
    expect(parseFeePercentage(undefined)).toBe(4);
    expect(parseFeePercentage('')).toBe(4);
    expect(parseFeePercentage('abc')).toBe(4);
    expect(parseFeePercentage(-1)).toBe(4);
  });

  it('a 0% setting charges no fee at all (no Stripe-cost floor)', () => {
    expect(computeDuesCharge(150, true, parseFeePercentage(0))).toEqual({ dues: 150, creditCardFee: 0, totalAmount: 150 });
  });
});

describe('computeDuesCharge', () => {
  it('adds the settings percentage when it beats Stripe\'s fee ($150 at 4% → $156)', () => {
    expect(computeDuesCharge(150, true, 4)).toEqual({ dues: 150, creditCardFee: 6, totalAmount: 156 });
  });

  it('uses 2.9% + $0.30 when that is larger', () => {
    // $5 dues: 4% = $0.20, Stripe = $0.445 → $0.45 (rounded)
    expect(computeDuesCharge(5, true, 4)).toEqual({ dues: 5, creditCardFee: 0.45, totalAmount: 5.45 });
  });

  it('charges no fee when the account has it off, or there is nothing due', () => {
    expect(computeDuesCharge(150, false, 4)).toEqual({ dues: 150, creditCardFee: 0, totalAmount: 150 });
    expect(computeDuesCharge(0, true, 4)).toEqual({ dues: 0, creditCardFee: 0, totalAmount: 0 });
  });
});
