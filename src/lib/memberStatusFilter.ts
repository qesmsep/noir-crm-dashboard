/**
 * Status-filter rules for the admin members list.
 *
 * Extracted from src/pages/admin/members.tsx so the rules can be unit tested.
 * The list groups member rows into accounts and filters on the *account's*
 * subscription status, which lives on the joined `accounts` row — not on the
 * member's own `status` column.
 */

export const MEMBER_STATUS_FILTERS = [
  'all',
  'active',
  'payment_failed',
  'canceled',
  'paused',
  'no_subscription',
] as const;

export type MemberStatusFilter = (typeof MEMBER_STATUS_FILTERS)[number];

export const MEMBER_STATUS_FILTER_LABELS: Record<MemberStatusFilter, string> = {
  all: 'All Status',
  active: 'Active',
  payment_failed: 'Payment Failed',
  canceled: 'Canceled',
  paused: 'Paused',
  no_subscription: 'No Subscription',
};

export interface FilterableAccount {
  account_id: string;
  allMembers: Array<{ status?: string }>;
  accounts?: {
    subscription_cancel_at?: string | null;
    subscription_status?: string | null;
  };
}

export interface StatusFilterContext {
  /** Accounts flagged by /api/accounts/failed-payments-summary. */
  failedPaymentAccounts: Set<string>;
  /** Accounts flagged by /api/accounts/no-subscription-summary. */
  noSubscriptionAccounts: Set<string>;
}

/** An account is cancelled outright, or has a cancellation scheduled. */
export function isAccountCancelled(account: FilterableAccount): boolean {
  return (
    account.accounts?.subscription_status === 'canceled' ||
    !!account.accounts?.subscription_cancel_at
  );
}

/**
 * True when the account carries no usable subscription status.
 *
 * These accounts are the reason this module exists: with a null/empty
 * subscription_status they matched none of the named filters, so they were
 * only ever visible under "All Status" and vanished from every other view.
 * They now have a bucket of their own.
 *
 * The server-side no-subscription summary only sees accounts that already have
 * a stripe_customer_id, so it is treated as an additional signal rather than
 * the definition.
 */
export function hasNoSubscription(
  account: FilterableAccount,
  noSubscriptionAccounts: Set<string>
): boolean {
  const status = account.accounts?.subscription_status;
  if (!status) return true;
  return noSubscriptionAccounts.has(account.account_id) && status !== 'active';
}

/**
 * Decide whether one account belongs in the list under the given status filter.
 *
 * Accounts whose members are all archived are hidden everywhere except the
 * "Canceled" view, which is where archived memberships are reviewed.
 */
export function matchesStatusFilter(
  account: FilterableAccount,
  statusFilter: string,
  { failedPaymentAccounts, noSubscriptionAccounts }: StatusFilterContext
): boolean {
  const allMembersArchived =
    account.allMembers.length > 0 &&
    account.allMembers.every(m => m.status === 'inactive');
  if (statusFilter !== 'canceled' && allMembersArchived) return false;

  const status = account.accounts?.subscription_status;

  switch (statusFilter) {
    case 'all':
      return true;
    case 'active':
      return status === 'active';
    case 'paused':
      return status === 'paused';
    case 'payment_failed':
      return failedPaymentAccounts.has(account.account_id);
    case 'canceled':
      return (
        isAccountCancelled(account) ||
        account.allMembers.some(m => m.status === 'inactive')
      );
    case 'no_subscription':
      return hasNoSubscription(account, noSubscriptionAccounts);
    default:
      return true;
  }
}
