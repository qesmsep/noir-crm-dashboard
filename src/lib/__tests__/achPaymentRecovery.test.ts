import {
  activateAccountAfterAchClears,
  findPendingEntryForAchCharge,
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
        gt: (col: string, val: any) => { q.filters[`${col}>`] = val; return builder; },
        order: () => builder,
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

describe('findPendingEntryForAchCharge', () => {
  const charge = { ...achCharge, amount: 15000 };

  it('matches the dues row by ledger_entry_key first', async () => {
    const { db, calls } = fakeDb({
      ledger: (q) => (q.filters.ledger_entry_key === 'pi_test'
        ? { data: { id: 'row_key', account_id: 'acct_1' }, error: null }
        : { data: null, error: null }),
    });
    await expect(findPendingEntryForAchCharge(db, charge, 'acct_1'))
      .resolves.toEqual({ id: 'row_key', account_id: 'acct_1' });
    expect(calls).toHaveLength(1);
  });

  it('falls back to a pending row carrying the payment intent id', async () => {
    const { db } = fakeDb({
      ledger: (q) => (q.filters.stripe_payment_intent_id === 'pi_test'
        && q.filters.status === 'pending' && q.filters['amount>'] === 0
        ? { data: { id: 'row_intent', account_id: 'acct_1' }, error: null }
        : { data: null, error: null }),
    });
    await expect(findPendingEntryForAchCharge(db, charge, 'acct_1'))
      .resolves.toEqual({ id: 'row_intent', account_id: 'acct_1' });
  });

  it('falls back to a pending row on the account for the same amount', async () => {
    // The Aug 2026 duplicate: PENDING "Monthly dues" plus a new cleared
    // "ACH payment" row, because no Stripe link matched.
    const { db } = fakeDb({
      ledger: (q) => (q.filters.account_id === 'acct_1' && q.filters.status === 'pending'
        && q.filters.amount === 150
        ? { data: { id: 'row_amount', account_id: 'acct_1' }, error: null }
        : { data: null, error: null }),
    });
    await expect(findPendingEntryForAchCharge(db, charge, 'acct_1'))
      .resolves.toEqual({ id: 'row_amount', account_id: 'acct_1' });
  });

  it('returns null only when nothing pending matches, so the caller may insert', async () => {
    const { db } = fakeDb({});
    await expect(findPendingEntryForAchCharge(db, charge, 'acct_1')).resolves.toBeNull();
  });

  it('skips the amount match without an account', async () => {
    const { db, calls } = fakeDb({});
    await expect(findPendingEntryForAchCharge(db, charge, null)).resolves.toBeNull();
    expect(calls.some((c) => 'account_id' in c.filters)).toBe(false);
  });
});
