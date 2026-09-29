/**
 * API access policy — the single table src/proxy.ts enforces for every
 * /api/* request.
 *
 * Default deny: any route not matched below is ADMIN (active `admins` row,
 * proven by the Supabase Bearer token the admin UI sends). A route is only
 * opened by adding a rule here, with the reason and what the route itself
 * verifies. Rules are checked top to bottom; the first match wins.
 *
 * Access classes:
 *   public          anyone. The route must verify what it can itself (token,
 *                   signature, webhook secret) and expose only what its flow
 *                   needs.
 *   member          an active admin, or a valid member portal session
 *                   (`member_session` cookie). Routes that act on an account
 *                   must still scope to the member's own account.
 *   member-supabase as member, or any valid Supabase Auth user token. Only for
 *                   routes that authenticate with the Supabase user token
 *                   themselves (legacy /member-portal, referral-info).
 *   cron            Authorization: Bearer ${CRON_SECRET}.
 *   admin           active admin Bearer token, or an internal server-to-server
 *                   call carrying x-internal-secret == CRON_SECRET.
 *
 * Pure module: no imports, so it can be unit tested and read by the proxy.
 */

export type ApiAccess = 'public' | 'member' | 'member-supabase' | 'cron' | 'admin';

export interface ApiAccessRule {
  /** Path pattern. `:param` matches one segment. A trailing `/*` matches any depth below. */
  path: string;
  /** Methods this rule covers. Omitted = every method. HEAD is treated as GET. */
  methods?: string[];
  access: ApiAccess;
  /** Why, and what the route verifies on its own. */
  why: string;
}

export const API_ACCESS_RULES: ApiAccessRule[] = [
  // ── Inbound webhooks (verified by the route) ────────────────────────────
  { path: '/api/stripe-webhook', methods: ['POST'], access: 'public', why: 'Stripe webhook; route verifies the Stripe signature' },
  { path: '/api/stripe-webhook-subscriptions', methods: ['POST'], access: 'public', why: 'Stripe webhook; route verifies the Stripe signature' },
  { path: '/api/openphoneWebhook', access: 'public', why: 'OpenPhone inbound SMS webhook (text-to-book). No signature check yet — see PR "Not fixed"' },
  { path: '/api/webhook-process-reminders', methods: ['POST'], access: 'public', why: 'GitHub Actions minute cron; route requires x-webhook-secret == WEBHOOK_SECRET and fails closed when unset' },

  // ── Scheduled jobs ──────────────────────────────────────────────────────
  { path: '/api/cron-process-reminders', access: 'cron', why: 'Vercel cron' },
  { path: '/api/process-campaign-messages', access: 'cron', why: 'Vercel cron' },
  { path: '/api/process-intake-messages', access: 'cron', why: 'Vercel cron' },
  { path: '/api/cron/*', access: 'cron', why: 'Vercel cron (monthly-billing, retry-failed-payments)' },
  { path: '/api/process-ledger-notifications', access: 'cron', why: 'cron-style job, not scheduled in vercel.json' },
  { path: '/api/schedule-ledger-notifications', access: 'cron', why: 'cron-style job, not scheduled in vercel.json' },
  { path: '/api/process-campaign-messages-updated', access: 'cron', why: 'unscheduled copy of process-campaign-messages; delete candidate' },

  // ── Member portal login and session (public by design) ──────────────────
  { path: '/api/auth/*', access: 'public', why: 'member login: phone OTP, password, biometric, session check, logout. Rate limited and verified in each route' },
  { path: '/api/member/verify-phone', methods: ['POST'], access: 'public', why: 'member login page phone step' },

  // ── Member portal (session cookie) ──────────────────────────────────────
  { path: '/api/member/referral-info', access: 'member-supabase', why: 'member profile; route verifies the Supabase user token' },
  { path: '/api/member/sync-photo', access: 'admin', why: 'one-off maintenance script with hard-coded data; no caller' },
  { path: '/api/member/*', access: 'member', why: 'member portal; routes read the member from the session cookie' },
  { path: '/api/member-portal/create-profile', access: 'admin', why: 'no caller; inserts members from an unauthenticated body' },
  { path: '/api/member-portal/upload-photo', access: 'member', why: 'legacy portal; no check of its own' },
  { path: '/api/member-portal/*', access: 'member-supabase', why: 'legacy portal; routes verify the Supabase user token' },
  { path: '/api/debug/member-photo', methods: ['GET'], access: 'member', why: 'member dashboard; route reads the session cookie' },
  { path: '/api/noir-member-events', methods: ['GET'], access: 'member', why: 'member dashboard events list (and admin campaign drawer)' },

  // Member portal OR admin. The route scopes a member to their own account.
  { path: '/api/chargeBalance', methods: ['POST'], access: 'member', why: 'member pays own balance; admin charges any account. Route scopes member to own account and ignores custom amounts from members' },
  { path: '/api/stripe/payment-methods/*', access: 'member', why: 'member manages own cards/ACH; route scopes to own account' },
  { path: '/api/stripe/ach/setup-intent', methods: ['POST'], access: 'member', why: 'member profile ACH setup; route scopes to own account' },
  { path: '/api/stripe/setup-intents/:id', methods: ['GET'], access: 'member', why: 'member ACH setup; route checks the SetupIntent customer is the caller\'s' },
  // Static siblings of /api/accounts/:accountId stay admin.
  { path: '/api/accounts/failed-payments-summary', access: 'admin', why: 'admin members list' },
  { path: '/api/accounts/no-subscription-summary', access: 'admin', why: 'admin members list' },
  { path: '/api/accounts/update-credit-card-fee', access: 'admin', why: 'admin account page' },
  { path: '/api/accounts/:accountId', methods: ['GET'], access: 'member', why: 'member "add secondary member" modal reads own account; route scopes' },
  { path: '/api/members/add-to-account', methods: ['POST'], access: 'member', why: 'member adds a secondary member to own account; route scopes' },

  // ── Public booking (RooftopKC / NoirKC / legacy /reserve) ───────────────
  { path: '/api/reservations', methods: ['POST'], access: 'public', why: 'public booking; route gates past dates and overrides to admins' },
  { path: '/api/reservations/:id', methods: ['DELETE'], access: 'public', why: 'booking cleanup after a failed capture; route requires admin or the reservation\'s own payment_intent_id' },
  { path: '/api/available-slots', methods: ['POST'], access: 'public', why: 'slot search' },
  { path: '/api/check-date-availability', methods: ['GET'], access: 'public', why: 'slot search' },
  { path: '/api/tables', methods: ['GET'], access: 'public', why: 'booking modal lists bookable tables; POST is admin' },
  { path: '/api/locations', methods: ['GET'], access: 'public', why: 'location list for booking' },
  { path: '/api/locations/:slug/validate-bypass-code', methods: ['POST', 'OPTIONS'], access: 'public', why: 'booking bypass code check' },
  { path: '/api/settings/hold-fee-config', methods: ['GET'], access: 'public', why: 'booking reads hold-fee config; PUT is admin' },
  { path: '/api/members', methods: ['GET'], access: 'public', why: 'public booking checks "is this phone a member"; route returns only first name to non-admins and requires ?phone=' },
  { path: '/api/membership/check-by-phone', methods: ['POST'], access: 'public', why: 'legacy /reserve form member check' },
  { path: '/api/holds', methods: ['POST'], access: 'public', why: 'table hold during checkout' },
  { path: '/api/holds/:token', access: 'public', why: 'hold token is the credential' },
  { path: '/api/create-cover-charge-payment', methods: ['POST'], access: 'public', why: 'guest cover charge; amount computed server-side from the location' },
  { path: '/api/capture-payment', methods: ['POST'], access: 'public', why: 'booking capture; route checks the reservation matches the PaymentIntent' },
  { path: '/api/cancel-payment', methods: ['POST'], access: 'public', why: 'booking releases its own authorization after a failure' },
  { path: '/api/admin/menu-files', methods: ['GET'], access: 'public', why: 'public menu viewer on / and /rooftopkc' },

  // ── RSVP (public link) ──────────────────────────────────────────────────
  { path: '/api/rsvp', methods: ['POST'], access: 'public', why: 'public RSVP page and member dashboard' },
  { path: '/api/rsvp/attendee-count', methods: ['GET'], access: 'public', why: 'public RSVP page' },
  { path: '/api/rsvp/update', access: 'admin', why: 'admin calendar' },
  { path: '/api/rsvp/delete', access: 'admin', why: 'admin calendar' },
  { path: '/api/rsvp/:rsvpUrl', methods: ['GET'], access: 'public', why: 'RSVP URL is the credential' },

  // ── Application → agreement → payment → onboarding (token links) ────────
  { path: '/api/waitlist/submit', methods: ['POST'], access: 'public', why: '/apply form' },
  { path: '/api/questionnaires/:id/questions', methods: ['GET'], access: 'public', why: 'apply/signup questionnaire' },
  { path: '/api/questionnaire-analytics', methods: ['POST'], access: 'public', why: 'questionnaire page analytics' },
  { path: '/api/questionnaire-responses', methods: ['POST'], access: 'public', why: 'questionnaire page submit' },
  { path: '/api/invitation/submit', methods: ['POST'], access: 'public', why: '/invitation form; route validates the invitation token' },
  { path: '/api/agreement/validate', methods: ['GET'], access: 'public', why: 'agreement token link' },
  { path: '/api/agreement/sign', methods: ['POST'], access: 'public', why: 'agreement token link' },
  { path: '/api/payment/validate', methods: ['GET'], access: 'public', why: 'payment token link' },
  { path: '/api/payment/create-intent', methods: ['POST'], access: 'public', why: 'payment token link' },
  { path: '/api/payment/confirm', methods: ['POST'], access: 'public', why: 'payment token link' },
  { path: '/api/onboard/validate', methods: ['GET'], access: 'public', why: 'onboarding token link' },
  { path: '/api/onboard/save-contact-info', methods: ['POST'], access: 'public', why: 'onboarding token link' },
  { path: '/api/onboard/save-additional-members', methods: ['POST'], access: 'public', why: 'onboarding token link' },
  { path: '/api/referral/create-onboard', methods: ['POST'], access: 'public', why: '/refer/[code] page' },
  { path: '/api/referral/submit', methods: ['POST'], access: 'public', why: '/refer/[code] page' },

  // ── Health ──────────────────────────────────────────────────────────────
  { path: '/api/health', methods: ['GET'], access: 'public', why: 'uptime check; anon key, no data' },
];

function ruleRegex(path: string): RegExp {
  const deep = path.endsWith('/*');
  const base = deep ? path.slice(0, -2) : path;
  const body = base
    .split('/')
    .map((seg) => (seg.startsWith(':') ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/');
  return new RegExp(`^${body}${deep ? '(?:/.*)?' : ''}/?$`);
}

const COMPILED = API_ACCESS_RULES.map((rule) => ({ rule, re: ruleRegex(rule.path) }));

/** Resolve the access class for a request. Unmatched = 'admin'. */
export function classifyApiRequest(pathname: string, method: string): { access: ApiAccess; rule?: ApiAccessRule } {
  const m = (method || 'GET').toUpperCase() === 'HEAD' ? 'GET' : (method || 'GET').toUpperCase();
  // Collapse duplicate slashes so //api/x cannot dodge a rule.
  const path = pathname.replace(/\/{2,}/g, '/');
  for (const { rule, re } of COMPILED) {
    if (!re.test(path)) continue;
    if (rule.methods && !rule.methods.includes(m)) continue;
    return { access: rule.access, rule };
  }
  return { access: 'admin' };
}
