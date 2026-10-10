/**
 * @jest-environment node
 */
jest.mock('../supabase', () => ({ supabaseAdmin: {} }));

import { isCronAuthorizedHeader, isInternalCall, secretsMatch } from '../admin-auth';

const ORIGINAL = process.env.CRON_SECRET;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL;
});

describe('cron and internal secrets', () => {
  it('accepts only Bearer CRON_SECRET', () => {
    process.env.CRON_SECRET = 's3cret-value';
    expect(isCronAuthorizedHeader('Bearer s3cret-value')).toBe(true);
    expect(isCronAuthorizedHeader('Bearer wrong-value')).toBe(false);
    expect(isCronAuthorizedHeader('s3cret-value')).toBe(false);
    expect(isCronAuthorizedHeader(undefined)).toBe(false);
  });

  it('fails closed when CRON_SECRET is unset', () => {
    delete process.env.CRON_SECRET;
    expect(isCronAuthorizedHeader('Bearer undefined')).toBe(false);
    expect(isCronAuthorizedHeader('Bearer ')).toBe(false);
    expect(isInternalCall({ headers: {} } as any)).toBe(false);
  });

  it('matches the internal-call header only when it equals the secret', () => {
    process.env.CRON_SECRET = 'abc';
    expect(isInternalCall({ headers: { 'x-internal-secret': 'abc' } } as any)).toBe(true);
    expect(isInternalCall({ headers: { 'x-internal-secret': 'abd' } } as any)).toBe(false);
    expect(isInternalCall({ headers: {} } as any)).toBe(false);
  });

  it('compares secrets exactly', () => {
    expect(secretsMatch('a', 'a')).toBe(true);
    expect(secretsMatch('a', 'ab')).toBe(false);
    expect(secretsMatch('', '')).toBe(false);
    expect(secretsMatch(undefined, undefined)).toBe(false);
  });
});
