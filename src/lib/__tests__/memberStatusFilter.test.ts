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
  describe('account with no subscription status (the Ketterman case)', () => {
    // Two active members, but the accounts row carries no subscription_status.
    // Before the fix these matched none of the named filters, so the account
    // was visible under "All Status" and nowhere else.
    const ketterman = account({
      account_id: 'acct_ketterman',
      allMembers: [{ status: 'active' }, { status: 'active' }],
      subscription_status: null,
    });

    it('is visible under All Status', () => {
      expect(matchesStatusFilter(ketterman, 'all', ctx())).toBe(true);
    });

    it('is visible under the No Subscription filter', () => {
      expect(matchesStatusFilter(ketterman, 'no_subscription', ctx())).toBe(true);
    });

    it('is reachable from at least one named filter', () => {
      const named = MEMBER_STATUS_FILTERS.filter(f => f !== 'all');
      const visibleUnder = named.filter(f => matchesStatusFilter(ketterman, f, ctx()));
      expect(visibleUnder).not.toHaveLength(0);
    });

    it('still does not claim to be active, paused, canceled or failing payment', () => {
      for (const f of ['active', 'paused', 'canceled', 'payment_failed']) {
        expect(matchesStatusFilter(ketterman, f, ctx())).toBe(false);
      }
    });

    it('treats an empty-string status the same as null', () => {
      const empty = account({ subscription_status: '' });
      expect(matchesStatusFilter(empty, 'no_subscription', ctx())).toBe(true);
    });
  });

  describe('active accounts', () => {
    const active = account({ subscription_status: 'active' });

    it('matches the Active filter and All Status', () => {
      expect(matchesStatusFilter(active, 'active', ctx())).toBe(true);
      expect(matchesStatusFilter(active, 'all', ctx())).toBe(true);
    });

    it('does not fall into the No Subscription bucket', () => {
      expect(matchesStatusFilter(active, 'no_subscription', ctx())).toBe(false);
    });

    it('stays out of No Subscription even if the summary endpoint flags it', () => {
      expect(
        matchesStatusFilter(active, 'no_subscription', ctx({ noSub: ['acct_1'] }))
      ).toBe(false);
    });
  });

  describe('paused, canceled and failed payments', () => {
    it('matches paused on subscription_status', () => {
      expect(matchesStatusFilter(account({ subscription_status: 'paused' }), 'paused', ctx())).toBe(true);
      expect(matchesStatusFilter(account({ subscription_status: 'active' }), 'paused', ctx())).toBe(false);
    });

    it('matches canceled on subscription_status', () => {
      expect(
        matchesStatusFilter(account({ subscription_status: 'canceled' }), 'canceled', ctx())
      ).toBe(true);
    });

    it('matches canceled on a scheduled cancellation', () => {
      const scheduled = account({
        subscription_status: 'active',
        accounts: { subscription_status: 'active', subscription_cancel_at: '2026-12-01' },
      });
      expect(matchesStatusFilter(scheduled, 'canceled', ctx())).toBe(true);
    });

    it('matches payment_failed from the failed-payments set', () => {
      const acct = account({ subscription_status: 'active' });
      expect(matchesStatusFilter(acct, 'payment_failed', ctx({ failed: ['acct_1'] }))).toBe(true);
      expect(matchesStatusFilter(acct, 'payment_failed', ctx())).toBe(false);
    });
  });

  describe('fully archived accounts', () => {
    const archived = account({
      subscription_status: 'canceled',
      allMembers: [{ status: 'inactive' }, { status: 'inactive' }],
    });

    it('is hidden from every filter except Canceled', () => {
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

  it('never hides an account from All Status that a named filter would show', () => {
    const cases: FilterableAccount[] = [
      account({ subscription_status: 'active' }),
      account({ subscription_status: 'paused' }),
      account({ subscription_status: null }),
      account({ subscription_status: '' }),
      account({ subscription_status: 'incomplete' }),
      account({ subscription_status: 'trialing' }),
    ];
    for (const acct of cases) {
      const shownSomewhere = MEMBER_STATUS_FILTERS.filter(f => f !== 'all').some(f =>
        matchesStatusFilter(acct, f, ctx({ failed: [], noSub: [] }))
      );
      if (shownSomewhere) {
        expect(matchesStatusFilter(acct, 'all', ctx())).toBe(true);
      }
    }
  });
});
