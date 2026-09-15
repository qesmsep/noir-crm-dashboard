import {
  activateAccountAfterAchClears,
  isAchCharge,
  resolveAccountIdForCharge,
} from '../achPaymentRecovery';

/**
 * Minimal fake of the supabase query builder: records the filters applied so a
 * test can assert the 'processing' guard is present, and returns a canned
 * result.
 */
function fakeDb(handlers: Record<string, (q: Recorded) => any>) {
  const calls: Recorded[] = [];
  const db = {
    from(table: string) {
      const q: Recorded = { table, op: 'select', filters: {}, payload: undefined };
      calls.push(q);
      const builder: any = {
        select: () => builder,
        update: (payload: any) => { q.op = 'update'; q.payload = payload; return builder; },
        eq: (col: string, val: any) => { q.filters[col] = val; return builder; },
        limit: () => builder,
        maybeSingle: () => Promise.resolve(handlers[table]?.(q) ?? { data: null, error: null }),
        then: (resolve: any) => resolve(handlers[table]?.(q) ?? { data: null, error: null }),
      };
      return builder;
    },
  };
  return { db, calls };
}

interface Recorded {
  table: string;
  op: 'select' | 'update';
  filters: Record<string, any>;
  payload: any;
}

const achCharge = {
  id: 'py_test',
  customer: 'cus_test',
  payment_intent: 'pi_test',
  payment_method_details: { type: 'us_bank_account' },
};

describe('isAchCharge', () => {
  it('accepts a bank-account charge and rejects a card charge', () => {
    expect(isAchCharge(achCharge)).toBe(true);
    expect(isAchCharge({ payment_method_details: { type: 'card' } })).toBe(false);
    expect(isAchCharge(null)).toBe(false);
    expect(isAchCharge({})).toBe(false);
  });
});

describe('resolveAccountIdForCharge', () => {
  it('resolves through the customer id', async () => {
    const { db } = fakeDb({ accounts: () => ({ data: { account_id: 'acct_1' }, error: null }) });
    await expect(resolveAccountIdForCharge(db, achCharge)).resolves.toBe('acct_1');
  });

  it('falls back to the ledger when the customer is not linked to an account', async () => {
    const { db } = fakeDb({
      accounts: () => ({ data: null, error: null }),
      ledger: () => ({ data: { account_id: 'acct_from_ledger' }, error: null }),
    });
    await expect(resolveAccountIdForCharge(db, achCharge)).resolves.toBe('acct_from_ledger');
  });

  it('returns null when neither lookup finds an account', async () => {
    const { db } = fakeDb({});
    await expect(resolveAccountIdForCharge(db, achCharge)).resolves.toBeNull();
  });

  it('returns null for a charge with no customer and no payment intent', async () => {
    const { db, calls } = fakeDb({});
    await expect(
      resolveAccountIdForCharge(db, { payment_method_details: { type: 'us_bank_account' } })
    ).resolves.toBeNull();
    expect(calls).toHaveLength(0);
  });
});

describe('activateAccountAfterAchClears', () => {
  it("flips a stranded account back to 'active'", async () => {
    const { db, calls } = fakeDb({
      accounts: () => ({ data: [{ account_id: 'acct_1' }], error: null }),
    });

    const result = await activateAccountAfterAchClears(db, 'acct_1');

    expect(result).toEqual({ activated: true, reason: 'activated' });
    expect(calls[0].op).toBe('update');
    expect(calls[0].payload).toEqual({ subscription_status: 'active' });
  });

  it("guards on subscription_status = 'processing' so it cannot revive a canceled account", async () => {
    const { db, calls } = fakeDb({
      accounts: () => ({ data: [{ account_id: 'acct_1' }], error: null }),
    });

    await activateAccountAfterAchClears(db, 'acct_1');

    // Without this filter the update would resurrect paused and canceled
    // accounts every time an old ACH charge settled.
    expect(calls[0].filters).toEqual({
      account_id: 'acct_1',
      subscription_status: 'processing',
    });
  });

  it('is a no-op when the account is not in processing (safe to call twice)', async () => {
    const { db } = fakeDb({ accounts: () => ({ data: [], error: null }) });
    await expect(activateAccountAfterAchClears(db, 'acct_1')).resolves.toEqual({
      activated: false,
      reason: 'not_processing',
    });
  });

  it('reports an error instead of throwing, so the webhook still returns 200', async () => {
    const { db } = fakeDb({
      accounts: () => ({ data: null, error: { message: 'boom' } }),
    });
    const result = await activateAccountAfterAchClears(db, 'acct_1');
    expect(result.activated).toBe(false);
    expect(result.reason).toBe('error');
  });

  it('does nothing without an account id', async () => {
    const { db, calls } = fakeDb({});
    await expect(activateAccountAfterAchClears(db, null)).resolves.toEqual({
      activated: false,
      reason: 'no_account',
    });
    expect(calls).toHaveLength(0);
  });
});
