/**
 * Tests for security utilities
 * Covers getSessionCookieDomain and findMemberByPhone
 */

// ── Mocks ──────────────────────────────────────────────────────────────────

// Track calls for assertions
const queryLog: Array<{ method: string; args: unknown[] }> = [];

// Per-test response override: set in each test, consumed by mockLimit
let nextResponses: Array<{ data: Record<string, unknown>[] | null; error: Error | null }> = [];

function pushResponse(data: Record<string, unknown>[] | null, error: Error | null = null) {
  nextResponses.push({ data, error });
}

function createChain() {
  const chain: Record<string, jest.Mock> = {};
  chain.eq = jest.fn((...args) => { queryLog.push({ method: 'eq', args }); return chain; });
  chain.not = jest.fn((...args) => { queryLog.push({ method: 'not', args }); return chain; });
  chain.limit = jest.fn((...args) => {
    queryLog.push({ method: 'limit', args });
    const resp = nextResponses.shift() || { data: null, error: null };
    return Promise.resolve(resp);
  });
  return chain;
}

jest.mock('../supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(() => ({
      select: jest.fn(() => createChain()),
      insert: jest.fn().mockResolvedValue({ error: null }),
      update: jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ error: null }),
      })),
    })),
  },
}));

jest.mock('../logger', () => ({
  Logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    auth: jest.fn(),
  },
}));

import { getSessionCookieDomain, findMemberByPhone } from '../security';
import { Logger } from '../logger';

// ── getSessionCookieDomain ─────────────────────────────────────────────────

describe('getSessionCookieDomain', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.COOKIE_DOMAIN;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns COOKIE_DOMAIN env var when set', () => {
    process.env.COOKIE_DOMAIN = '.staging.noirkc.com';
    expect(getSessionCookieDomain()).toBe('.staging.noirkc.com');
  });

  it('returns undefined for empty string COOKIE_DOMAIN', () => {
    process.env.COOKIE_DOMAIN = '';
    expect(getSessionCookieDomain()).toBeUndefined();
  });

  it('returns undefined for whitespace-only COOKIE_DOMAIN', () => {
    process.env.COOKIE_DOMAIN = '   ';
    expect(getSessionCookieDomain()).toBeUndefined();
  });

  it('trims whitespace from COOKIE_DOMAIN', () => {
    process.env.COOKIE_DOMAIN = '  .noirkc.com  ';
    expect(getSessionCookieDomain()).toBe('.noirkc.com');
  });

  it('returns .noirkc.com in production when COOKIE_DOMAIN is not set', () => {
    process.env.NODE_ENV = 'production';
    expect(getSessionCookieDomain()).toBe('.noirkc.com');
  });

  it('returns undefined in development when COOKIE_DOMAIN is not set', () => {
    process.env.NODE_ENV = 'development';
    expect(getSessionCookieDomain()).toBeUndefined();
  });

  it('prefers COOKIE_DOMAIN over production fallback', () => {
    process.env.NODE_ENV = 'production';
    process.env.COOKIE_DOMAIN = '.custom-domain.com';
    expect(getSessionCookieDomain()).toBe('.custom-domain.com');
  });
});

// ── findMemberByPhone ──────────────────────────────────────────────────────

describe('findMemberByPhone', () => {
  beforeEach(() => {
    queryLog.length = 0;
    nextResponses.length = 0;
    jest.clearAllMocks();
  });

  it('returns null for phone too short (< 10 digits)', async () => {
    const result = await findMemberByPhone('123');
    expect(result).toBeNull();
    expect(Logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('phone too short'),
      expect.any(Object),
    );
  });

  it('returns null for empty string', async () => {
    const result = await findMemberByPhone('');
    expect(result).toBeNull();
  });

  it('returns null for non-numeric input', async () => {
    const result = await findMemberByPhone('abcdefghij');
    expect(result).toBeNull();
  });

  it('returns member on exact 10-digit match (step 1)', async () => {
    const member = { member_id: 'mem_1', phone: '5551234567' };
    // Step 1 returns a hit
    pushResponse([member]);

    const result = await findMemberByPhone('5551234567');
    expect(result).toEqual(member);
  });

  it('returns member on +1 prefix match (step 2)', async () => {
    const member = { member_id: 'mem_2', phone: '+15551234567' };
    // Step 1 misses
    pushResponse(null);
    // Step 2 returns a hit
    pushResponse([member]);

    const result = await findMemberByPhone('5551234567');
    expect(result).toEqual(member);
  });

  it('returns member via fallback normalization (step 3)', async () => {
    const member = { member_id: 'mem_3', phone: '(555) 123-4567' };
    // Step 1 misses
    pushResponse(null);
    // Step 2 misses
    pushResponse(null);
    // Step 3 fallback returns members with various phone formats
    pushResponse([
      { member_id: 'mem_other', phone: '5559999999' },
      member,
    ]);

    const result = await findMemberByPhone('5551234567');
    expect(result).toEqual(member);
    expect(Logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('fallback normalization'),
      expect.objectContaining({ member_id: 'mem_3' }),
    );
  });

  it('returns null when no steps match', async () => {
    // Step 1 misses
    pushResponse(null);
    // Step 2 misses
    pushResponse(null);
    // Step 3 fallback has no matching phone
    pushResponse([{ member_id: 'mem_other', phone: '5559999999' }]);

    const result = await findMemberByPhone('5551234567');
    expect(result).toBeNull();
  });

  it('logs error when fallback hits row limit', async () => {
    // Step 1 misses
    pushResponse(null);
    // Step 2 misses
    pushResponse(null);
    // Step 3 fallback returns exactly FALLBACK_MEMBER_LIMIT (5000) rows
    const rows = Array.from({ length: 5000 }, (_, i) => ({
      member_id: `mem_${i}`,
      phone: `555${String(i).padStart(7, '0')}`,
    }));
    pushResponse(rows);

    await findMemberByPhone('5551234567');
    expect(Logger.error).toHaveBeenCalledWith(
      expect.stringContaining('fallback hit row limit'),
      undefined,
      expect.objectContaining({ limit: 5000 }),
    );
  });

  it('normalizes formatted phone input before querying', async () => {
    const member = { member_id: 'mem_4', phone: '5551234567' };
    pushResponse([member]);

    // Input with formatting — should still match
    const result = await findMemberByPhone('+1 (555) 123-4567');
    expect(result).toEqual(member);
  });
});
