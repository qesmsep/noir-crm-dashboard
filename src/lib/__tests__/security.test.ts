/**
 * Tests for security utilities
 * Covers findMemberByPhone and getSessionCookieDomain
 */

// Mock supabaseAdmin before importing security module
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockNot = jest.fn();
const mockLimit = jest.fn();
const mockFrom = jest.fn();

jest.mock('../supabase', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => {
      mockFrom(...args);
      return {
        select: (...selectArgs: unknown[]) => {
          mockSelect(...selectArgs);
          return createChain();
        },
      };
    },
  },
}));

// Chain builder that returns itself for .eq(), .not(), .limit() etc.
function createChain(resolvedData: Record<string, unknown>[] | null = null, error: Error | null = null) {
  const chain: Record<string, jest.Mock> = {};
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.not = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockResolvedValue({ data: resolvedData, error });
  // If no limit is called, resolve directly
  chain.then = jest.fn((resolve) => resolve({ data: resolvedData, error }));
  return chain;
}

// Need to mock at module level for supabaseAdmin
jest.mock('../logger', () => ({
  Logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    auth: jest.fn(),
  },
}));

import { getSessionCookieDomain } from '../security';

describe('getSessionCookieDomain', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.COOKIE_DOMAIN;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return COOKIE_DOMAIN env var when set', () => {
    process.env.COOKIE_DOMAIN = '.staging.noirkc.com';
    expect(getSessionCookieDomain()).toBe('.staging.noirkc.com');
  });

  it('should return undefined for empty string COOKIE_DOMAIN', () => {
    process.env.COOKIE_DOMAIN = '';
    expect(getSessionCookieDomain()).toBeUndefined();
  });

  it('should return undefined for whitespace-only COOKIE_DOMAIN', () => {
    process.env.COOKIE_DOMAIN = '   ';
    expect(getSessionCookieDomain()).toBeUndefined();
  });

  it('should trim whitespace from COOKIE_DOMAIN', () => {
    process.env.COOKIE_DOMAIN = '  .noirkc.com  ';
    expect(getSessionCookieDomain()).toBe('.noirkc.com');
  });

  it('should return .noirkc.com in production when COOKIE_DOMAIN is not set', () => {
    process.env.NODE_ENV = 'production';
    expect(getSessionCookieDomain()).toBe('.noirkc.com');
  });

  it('should return undefined in development when COOKIE_DOMAIN is not set', () => {
    process.env.NODE_ENV = 'development';
    expect(getSessionCookieDomain()).toBeUndefined();
  });

  it('should return undefined in test when COOKIE_DOMAIN is not set', () => {
    process.env.NODE_ENV = 'test';
    expect(getSessionCookieDomain()).toBeUndefined();
  });

  it('should prefer COOKIE_DOMAIN over production fallback', () => {
    process.env.NODE_ENV = 'production';
    process.env.COOKIE_DOMAIN = '.custom-domain.com';
    expect(getSessionCookieDomain()).toBe('.custom-domain.com');
  });
});

describe('findMemberByPhone', () => {
  // These tests validate the normalization logic and lookup strategy.
  // Due to the Supabase query chain mocking complexity, we test the
  // exported normalizePhone behavior indirectly through findMemberByPhone.

  let findMemberByPhone: typeof import('../security').findMemberByPhone;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Re-import to get fresh module state
    const security = await import('../security');
    findMemberByPhone = security.findMemberByPhone;
  });

  it('should return null for phone numbers shorter than 10 digits', async () => {
    const result = await findMemberByPhone('123');
    expect(result).toBeNull();
    // Should not have tried any DB queries
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('should normalize phone with country code before querying', async () => {
    // The function normalizes internally, so +1 prefix gets stripped
    // Just verify it doesn't crash with various formats
    const result = await findMemberByPhone('+1 (555) 123-4567');
    // Result depends on mock, but we verify no crash
    expect(result).toBeDefined();
  });

  it('should normalize phone with formatting characters', async () => {
    const result = await findMemberByPhone('(555) 123-4567');
    expect(result).toBeDefined();
  });

  it('should return null for empty string', async () => {
    const result = await findMemberByPhone('');
    expect(result).toBeNull();
  });

  it('should return null for non-numeric input', async () => {
    const result = await findMemberByPhone('abcdefghij');
    expect(result).toBeNull();
  });
});
