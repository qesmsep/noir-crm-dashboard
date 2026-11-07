import { computePaymentIssues, rowsToCheck, IssueAccountInput, PendingDuesRow, IntentStatus } from '../paymentIssues';

const today = '2026-11-07';

const acct = (over: Partial<IssueAccountInput>): IssueAccountInput => ({
  accountId: 'a',
  name: 'Member',
  monthlyDues: 150,
  nextBillingDate: '2026-12-01',
  lastPaymentFailedAt: null,
  billingRetryCount: 0,
  ...over,
});

describe('computePaymentIssues', () => {
  it('flags bounced bank payments that still look pending in the ledger', () => {
    const accounts = [acct({ accountId: 'rodney', name: 'Rodney Thomas' })];
    const rows: PendingDuesRow[] = [
      { accountId: 'rodney', date: '2026-10-01', amount: 150, paymentIntentId: 'pi_oct' },
      { accountId: 'rodney', date: '2026-11-01', amount: 150, paymentIntentId: 'pi_nov' },
    ];
    const intents = new Map<string, IntentStatus>([
      ['pi_oct', { status: 'requires_payment_method', failureMessage: "The customer's account has insufficient funds to cover this payment." }],
      ['pi_nov', { status: 'requires_payment_method', failureMessage: "The customer's account has insufficient funds to cover this payment." }],
    ]);
    const s = computePaymentIssues(accounts, rows, intents, today);
    expect(s.accounts).toBe(1);
    expect(s.amount).toBe(300);
    expect(s.issues[0]).toMatchObject({ kind: 'bank_returned', count: 2, since: '2026-10-01' });
    expect(s.issues[0].detail).toContain('insufficient funds');
  });

  it('ignores pending rows Stripe says succeeded, and counts them as stale', () => {
    const accounts = [acct({ accountId: 'megan' })];
    const rows = [{ accountId: 'megan', date: '2026-08-21', amount: 10, paymentIntentId: 'pi_ok' }];
    const s = computePaymentIssues(accounts, rows, new Map([['pi_ok', { status: 'succeeded' }]]), today);
    expect(s.accounts).toBe(0);
    expect(s.staleClearedRows).toBe(1);
  });

  it('leaves recent bank payments alone (still in flight)', () => {
    const rows = [{ accountId: 'a', date: '2026-11-05', amount: 175, paymentIntentId: 'pi_new' }];
    expect(rowsToCheck(rows, today)).toHaveLength(0);
    const s = computePaymentIssues([acct({})], rows, new Map(), today);
    expect(s.accounts).toBe(0);
  });

  it('flags a bank payment as unconfirmed when Stripe cannot be read and it is old', () => {
    const rows = [{ accountId: 'a', date: '2026-10-20', amount: 150, paymentIntentId: 'pi_x' }];
    const s = computePaymentIssues([acct({})], rows, new Map(), today);
    expect(s.issues[0].kind).toBe('bank_unconfirmed');
  });

  it('includes card declines with retry state, and unbilled accounts', () => {
    const accounts = [
      acct({ accountId: 'sean', name: 'Sean', nextBillingDate: '2026-11-01', lastPaymentFailedAt: '2026-11-01', billingRetryCount: 2 }),
      acct({ accountId: 'x', name: 'X', nextBillingDate: '2026-11-03' }),
      acct({ accountId: 'done', name: 'Done', lastPaymentFailedAt: '2026-10-01', billingRetryCount: 4 }),
    ];
    const s = computePaymentIssues(accounts, [], new Map(), today);
    const byId = Object.fromEntries(s.issues.map(i => [i.accountId, i]));
    expect(byId.sean.kind).toBe('card_failed');
    expect(byId.sean.detail).toContain('retry 2/4');
    expect(byId.x.kind).toBe('not_billed');
    expect(byId.done.detail).toContain('all retries used');
  });

  it('skips rows for accounts that are not active (not passed in)', () => {
    const rows = [{ accountId: 'gone', date: '2026-09-01', amount: 150, paymentIntentId: 'pi_g' }];
    const s = computePaymentIssues([], rows, new Map([['pi_g', { status: 'requires_payment_method' }]]), today);
    expect(s.accounts).toBe(0);
  });

  it('lists bounced payments already moved off the ledger, merged with ones Stripe reports', () => {
    const accounts = [acct({ accountId: 'l', name: 'Lindsey' })];
    const voided = [{ accountId: 'l', date: '2026-09-01', amount: 175, reason: 'ACH returned (insufficient_funds): ...' }];
    const rows = [{ accountId: 'l', date: '2026-11-01', amount: 175, paymentIntentId: 'pi_n' }];
    const s = computePaymentIssues(accounts, rows, new Map([['pi_n', { status: 'requires_payment_method' }]]), today, voided);
    expect(s.issues[0]).toMatchObject({ kind: 'bank_returned', count: 2, amount: 350, since: '2026-09-01' });
    expect(s.issues[0].detail).toContain('insufficient funds');
  });

  it('ignores voided rows for accounts that are no longer active', () => {
    const s = computePaymentIssues([], [], new Map(), today, [{ accountId: 'x', date: '2026-10-01', amount: 150, reason: null }]);
    expect(s.accounts).toBe(0);
  });

  it('keeps count, since and detail consistent when unconfirmed payments join a bounced one', () => {
    const accounts = [acct({ accountId: 'a' })];
    const voided = [{ accountId: 'a', date: '2026-11-01', amount: 175, reason: 'insufficient funds' }];
    const rows = [{ accountId: 'a', date: '2026-10-20', amount: 175, paymentIntentId: 'pi_slow' }];
    const s = computePaymentIssues(accounts, rows, new Map(), today, voided);
    expect(s.issues[0]).toMatchObject({ kind: 'bank_returned', amount: 350, since: '2026-10-20' });
    expect(s.issues[0].detail).toContain('1 more not confirmed since Oct 20');
  });
});
