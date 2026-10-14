jest.mock('stripe', () => jest.fn().mockImplementation(() => ({})));
jest.mock('@supabase/supabase-js', () => ({ createClient: () => ({}) }));

import { nextBillingDateAfterPayment } from '../billing';

describe('nextBillingDateAfterPayment', () => {
  it('keeps the anchor day when the current date is recent', () => {
    expect(nextBillingDateAfterPayment('2026-10-02T00:00:00+00:00', 'month', '2026-10-05')).toBe('2026-11-02');
  });

  it('advances from today when the current date is stale', () => {
    // Retry-payment on 9/2 against a 4/6 billing date must not leave 5/6
    expect(nextBillingDateAfterPayment('2026-04-06 00:00:00+00', 'month', '2026-09-02')).toBe('2026-10-02');
  });

  it('handles yearly plans', () => {
    expect(nextBillingDateAfterPayment('2025-01-15', 'year', '2026-03-01')).toBe('2027-03-01');
    expect(nextBillingDateAfterPayment('2026-01-15', 'year', '2026-01-18')).toBe('2027-01-15');
  });

  it('falls back to today when there is no billing date', () => {
    expect(nextBillingDateAfterPayment(null, 'month', '2026-10-14')).toBe('2026-11-14');
  });
});

describe('nextBillingDateAfterPayment boundary', () => {
  it('advances from today when the anchored date lands exactly on today', () => {
    expect(nextBillingDateAfterPayment('2026-09-14', 'month', '2026-10-14')).toBe('2026-11-14');
  });
});
