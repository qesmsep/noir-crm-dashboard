import {
  FilterableAccount,
  MEMBER_STATUS_FILTERS,
  matchesStatusFilter,
} from '../memberStatusFilter';

const ctx = (opts: { failed?: string[]; noSub?: string[] } = {}) => ({
  failedPaymentAccounts: new Set(opts.failed ?? []),
  noSubscriptionAccounts: new Set(opts.noSub ?? []),
});

const account = (
  overrides: Partial<FilterableAccount> & { subscription_status?: string | null } = {}
): FilterableAccount => {
  const { subscription_status, ...rest } = overrides;
  return {
    account_id: 'acct_1',
    allMembers: [{ status: 'active' }],
    accounts: { subscription_status: subscription_status ?? null, subscription_cancel_at: null },
    ...rest,
  };
};

describe('matchesStatusFilter', () => {
  describe("the Ketterman case: an ACH payment in flight ('processing')", () => {
    // Two active members on a live subscription paid by us_bank_account. The
    // ACH payment was still clearing, so subscription_status read 'processing'
    // -- a value no named filter tested for. The account matched none of them
    // and was visible under "All Status" and nowhere else.
    const ketterman = account({
      account_id: 'acct_ketterman',
      allMembers: [{ status: 'active' }, { status: 'active' }],
      subscription_status: 'processing',
    });

    it('is visible under All Status', () => {
      expect(matchesStatusFilter(ketterman, 'all', ctx())).toBe(true);
    });

    it('is visible under Active -- an ACH payment clearing is still a member', () => {
      expect(matchesStatusFilter(ketterman, 'active', ctx())).toBe(true);
    });

    it('is also visible under its own ACH Processing bucket', () => {
      expect(matchesStatusFilter(ketterman, 'processing', ctx())).toBe(true);
    });

    it('is not canceled, paused, failing payment, or subscription-less', () => {
      for (const f of ['canceled', 'paused', 'payment_failed', 'no_subscription']) {
        expect(matchesStatusFilter(ketterman, f, ctx())).toBe(false);
      }
    });
  });

  describe('account with no subscription status at all', () => {
    const abandoned = account({
      account_id: 'acct_abandoned',
      allMembers: [{ status: 'active' }],
      subscription_status: null,
    });

    it('is reachable from the No Subscription bucket, not just All Status', () => {
      expect(matchesStatusFilter(abandoned, 'all', ctx())).toBe(true);
      expect(matchesStatusFilter(abandoned, 'no_subscription', ctx())).toBe(true);
    });

    it('does not claim to be active, processing, paused, canceled or failing', () => {
      for (const f of ['active', 'processing', 'paused', 'canceled', 'payment_failed']) {
        expect(matchesStatusFilter(abandoned, f, ctx())).toBe(false);
      }
    });

    it('treats an empty-string status the same as null', () => {
      expect(matchesStatusFilter(account({ subscription_status: '' }), 'no_subscription', ctx())).toBe(true);
    });
  });

  describe('active accounts', () => {
    it('matches Active and All Status', () => {
      const active = account({ subscription_status: 'active' });
      expect(matchesStatusFilter(active, 'active', ctx())).toBe(true);
      expect(matchesStatusFilter(active, 'all', ctx())).toBe(true);
    });

    it('counts trialing as active', () => {
      expect(matchesStatusFilter(account({ subscription_status: 'trialing' }), 'active', ctx())).toBe(true);
    });

    it('does not put an active account in the ACH Processing bucket', () => {
      expect(matchesStatusFilter(account({ subscription_status: 'active' }), 'processing', ctx())).toBe(false);
    });

    it('does not fall into No Subscription, even if the summary endpoint flags it', () => {
      const active = account({ subscription_status: 'active' });
      expect(matchesStatusFilter(active, 'no_subscription', ctx())).toBe(false);
      expect(matchesStatusFilter(active, 'no_subscription', ctx({ noSub: ['acct_1'] }))).toBe(false);
    });
  });

  describe('paused, canceled and failed payments', () => {
    it('matches paused on subscription_status', () => {
      expect(matchesStatusFilter(account({ subscription_status: 'paused' }), 'paused', ctx())).toBe(true);
      expect(matchesStatusFilter(account({ subscription_status: 'active' }), 'paused', ctx())).toBe(false);
    });

    it('matches canceled on subscription_status', () => {
      expect(matchesStatusFilter(account({ subscription_status: 'canceled' }), 'canceled', ctx())).toBe(true);
    });

    it('matches canceled on a scheduled cancellation', () => {
      const scheduled = account({
        accounts: { subscription_status: 'active', subscription_cancel_at: '2026-12-01' },
      });
      expect(matchesStatusFilter(scheduled, 'canceled', ctx())).toBe(true);
    });

    it('matches payment_failed from the failed-payments set', () => {
      const acct = account({ subscription_status: 'active' });
      expect(matchesStatusFilter(acct, 'payment_failed', ctx({ failed: ['acct_1'] }))).toBe(true);
      expect(matchesStatusFilter(acct, 'payment_failed', ctx())).toBe(false);
    });

    it('matches payment_failed on past_due even with an empty failed-payments set', () => {
      expect(
        matchesStatusFilter(account({ subscription_status: 'past_due' }), 'payment_failed', ctx())
      ).toBe(true);
    });
  });

  describe('fully archived accounts', () => {
    it('is hidden from every filter except Canceled', () => {
      const archived = account({
        subscription_status: 'canceled',
        allMembers: [{ status: 'inactive' }, { status: 'inactive' }],
      });
      for (const f of MEMBER_STATUS_FILTERS) {
        expect(matchesStatusFilter(archived, f, ctx())).toBe(f === 'canceled');
      }
    });

    it('does not resurface through the No Subscription bucket', () => {
      const archivedNoSub = account({
        subscription_status: null,
        allMembers: [{ status: 'inactive' }],
      });
      expect(matchesStatusFilter(archivedNoSub, 'no_subscription', ctx())).toBe(false);
      expect(matchesStatusFilter(archivedNoSub, 'all', ctx())).toBe(false);
    });

    it('does not hide an account with only one archived member', () => {
      const mixed = account({
        subscription_status: 'active',
        allMembers: [{ status: 'active' }, { status: 'inactive' }],
      });
      expect(matchesStatusFilter(mixed, 'active', ctx())).toBe(true);
      expect(matchesStatusFilter(mixed, 'all', ctx())).toBe(true);
    });
  });

  describe('every status value reaches at least one named filter', () => {
    // The statuses actually present in production on 2026-09-15 (active,
    // canceled, paused, processing, null), plus the other values the Stripe
    // webhook can write. A status matching no named filter is invisible
    // everywhere except "All Status" -- that is the bug this module exists for.
    const STATUSES: Array<string | null> = [
      'active', 'canceled', 'paused', 'processing', null, '',
      'trialing', 'past_due', 'unpaid',
    ];

    it.each(STATUSES.map(s => [s === null ? 'null' : s === '' ? '<empty>' : s, s] as const))(
      'status %s is reachable from a named filter',
      (_label, raw) => {
        const acct = account({ subscription_status: raw });
        const visibleUnder = MEMBER_STATUS_FILTERS.filter(
          f => f !== 'all' && matchesStatusFilter(acct, f, ctx())
        );
        expect(visibleUnder.length).toBeGreaterThan(0);
      }
    );

    it('never hides from All Status an account a named filter would show', () => {
      for (const raw of STATUSES) {
        const acct = account({ subscription_status: raw });
        const shownSomewhere = MEMBER_STATUS_FILTERS.some(
          f => f !== 'all' && matchesStatusFilter(acct, f, ctx())
        );
        if (shownSomewhere) {
          expect(matchesStatusFilter(acct, 'all', ctx())).toBe(true);
        }
      }
    });
  });
});
