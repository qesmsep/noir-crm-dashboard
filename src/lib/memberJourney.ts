/**
 * 90-day member journey: the rules, with no database or network in them so
 * they can be unit tested. Loading and sending live in memberJourneyData.ts.
 *
 * A member's journey is not stored anywhere. It is worked out from two facts:
 *   - the day they joined (members.join_date, day 0)
 *   - the dates they visited (house-account purchases in the ledger)
 * plus member_journey_log, which records the texts sent and the team actions
 * marked done.
 */

import { isVisit, CHICAGO_TZ } from './businessMetricsCore';

export const JOURNEY_DAYS = 90;
/** A text that fell behind can still go out this many days after day 90. */
export const CATCH_UP_DAYS = 14;
/** A failed text is tried again on later mornings, up to this many times. */
export const MAX_SEND_ATTEMPTS = 3;
/** Texts go out at 10:28 AM local time. */
export const SEND_HOUR = 10;
export const SEND_MINUTE = 28;

export const DEFAULT_FOOTER =
  'Welcome note {{n}} of {{total}}. Sent automatically, but we read and answer every reply.';

export const MEMBER_SITE = 'https://noirkc.com';

export interface JourneyStep {
  key: string;
  position: number;
  day_offset: number;
  label: string;
  body: string;
  post_id: string | null;
  audience: 'all' | 'primary';
  is_active: boolean;
}

export interface JourneySettings {
  enabled: boolean;
  /** Only members who joined on or after this date get the texts. */
  start_date: string | null;
  footer: string;
}

export interface JourneyLogRow {
  member_id: string;
  step_key: string;
  kind: 'text' | 'action';
  status: 'sent' | 'failed' | 'done';
  attempts: number;
  updated_at: string;
}

export function parseSettings(value: unknown): JourneySettings {
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return {
    enabled: v.enabled === true,
    start_date: typeof v.start_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.start_date) ? v.start_date : null,
    footer: typeof v.footer === 'string' ? v.footer : DEFAULT_FOOTER,
  };
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** YYYY-MM-DD from a date or timestamp string, as the rest of the app reads join_date. */
export function dateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

/** Whole days from one YYYY-MM-DD to another. */
export function daysBetween(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86400000);
}

/** The member's journey day today. The join date is day 0. Null if no join date. */
export function journeyDay(joinDate: string | null | undefined, today: string): number | null {
  const jd = dateOnly(joinDate);
  if (!jd) return null;
  return daysBetween(jd, today);
}

export function inJourney(day: number | null): boolean {
  return day !== null && day >= 0 && day <= JOURNEY_DAYS;
}

/** Week 1 is days 0 to 6. */
export function journeyWeek(day: number): number {
  return Math.min(13, Math.floor(day / 7) + 1);
}

/** The date in a time zone as YYYY-MM-DD. */
export function localDate(at: Date, tz: string = CHICAGO_TZ): string {
  return at.toLocaleDateString('en-CA', { timeZone: tz });
}

/**
 * True for the hour that starts at 10:28 AM local time. The cron fires at two
 * UTC times so that one of them lands here in both summer and winter; the
 * other is ignored.
 */
export function isSendWindow(at: Date, tz: string = CHICAGO_TZ): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
  }).formatToParts(at);
  const hour = Number(parts.find(p => p.type === 'hour')?.value);
  const minute = Number(parts.find(p => p.type === 'minute')?.value);
  const mins = hour * 60 + minute;
  const start = SEND_HOUR * 60 + SEND_MINUTE;
  return mins >= start && mins < start + 60;
}

// ---------------------------------------------------------------------------
// Visits
// ---------------------------------------------------------------------------

export interface LedgerVisitRow {
  type: string | null;
  note: string | null;
  date: string | null;
}

/**
 * The dates an account visited, oldest first. A visit is a day with at least
 * one house-account purchase at a venue (the same rule the business dashboard
 * uses). Several charges on one night are one visit.
 */
export function visitDates(rows: LedgerVisitRow[], onOrAfter?: string | null): string[] {
  const days = new Set<string>();
  for (const r of rows) {
    if (r.type !== 'purchase' || !isVisit(r.note)) continue;
    const d = dateOnly(r.date);
    if (!d) continue;
    if (onOrAfter && d < onOrAfter) continue;
    days.add(d);
  }
  return [...days].sort();
}

// ---------------------------------------------------------------------------
// Texts
// ---------------------------------------------------------------------------

/** The steps this member gets, in order. */
export function stepsFor(steps: JourneyStep[], isPrimary: boolean): JourneyStep[] {
  return steps
    .filter(s => s.is_active && (s.audience === 'all' || isPrimary))
    .sort((a, b) => a.position - b.position || a.day_offset - b.day_offset);
}

export interface NextText {
  /** The text to send this morning, if there is one. */
  send: { step: JourneyStep; n: number; total: number } | null;
  /** Due texts that are waiting on their how-to post being published. */
  waitingOnPost: JourneyStep[];
}

/**
 * Which text, if any, goes to this member this morning: the earliest one that
 * is due and has not been sent. One text a day at most, so a member who fell
 * behind catches up one morning at a time instead of getting a burst.
 *
 * A text whose how-to post is still a draft waits, and does not hold up the
 * texts after it.
 */
export function pickNextText(args: {
  steps: JourneyStep[];
  isPrimary: boolean;
  day: number;
  log: JourneyLogRow[];
  publishedPostIds: Set<string>;
}): NextText {
  const mine = stepsFor(args.steps, args.isPrimary);
  const texts = new Map(args.log.filter(l => l.kind === 'text').map(l => [l.step_key, l]));
  const out: NextText = { send: null, waitingOnPost: [] };
  if (args.day < 0 || args.day > JOURNEY_DAYS + CATCH_UP_DAYS) return out;

  mine.forEach((step, i) => {
    if (step.day_offset > args.day) return;
    const prior = texts.get(step.key);
    if (prior?.status === 'sent') return;
    if (prior?.status === 'failed' && prior.attempts >= MAX_SEND_ATTEMPTS) return;
    if (step.post_id && !args.publishedPostIds.has(step.post_id)) {
      out.waitingOnPost.push(step);
      return;
    }
    if (!out.send) out.send = { step, n: i + 1, total: mine.length };
  });
  return out;
}

/** True if the member already got a journey text on this date. */
export function sentTextOn(log: JourneyLogRow[], date: string, tz: string = CHICAGO_TZ): boolean {
  return log.some(l => l.kind === 'text' && l.status === 'sent' && localDate(new Date(l.updated_at), tz) === date);
}

export function blogLink(step: JourneyStep, site: string = MEMBER_SITE): string {
  return step.post_id ? `${site}/member/noir-life/${step.post_id}` : `${site}/member/noir-life`;
}

export function referralLink(referralCode: string | null | undefined, site: string = MEMBER_SITE): string {
  return referralCode ? `${site}/refer/${referralCode}` : `${site}/member/dashboard`;
}

/** The text exactly as the member receives it. */
export function renderText(args: {
  step: JourneyStep;
  firstName: string | null | undefined;
  referralCode?: string | null;
  n: number;
  total: number;
  footer: string;
  site?: string;
}): string {
  const first = (args.firstName || '').trim();
  let body = args.step.body
    .replace(/\{\{\s*blog_link\s*\}\}/g, blogLink(args.step, args.site))
    .replace(/\{\{\s*referral_link\s*\}\}/g, referralLink(args.referralCode, args.site));
  if (first) {
    body = body.replace(/\{\{\s*first_name\s*\}\}/g, first);
  } else {
    // No first name on file: drop the name and tidy what is left ("Hi , welcome" -> "Hi, welcome")
    body = body
      .replace(/^\s*\{\{\s*first_name\s*\}\},\s*(\w)/, (_m, c: string) => c.toUpperCase())
      .replace(/,?\s*\{\{\s*first_name\s*\}\}/g, '')
      .replace(/\s+([,.?!])/g, '$1');
  }
  const footer = (args.footer || '')
    .replace(/\{\{\s*n\s*\}\}/g, String(args.n))
    .replace(/\{\{\s*total\s*\}\}/g, String(args.total))
    .trim();
  return footer ? `${body.trim()}\n\n${footer}` : body.trim();
}

/** +1XXXXXXXXXX from however the phone is stored. Null if it is not a US number. */
export function toE164(phone: string | null | undefined): string | null {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

// ---------------------------------------------------------------------------
// Team actions (the visits track, done by hand)
// ---------------------------------------------------------------------------

export type ActionKey =
  | 'no_visit_21'
  | 'visit1_gift'
  | 'visit1_note'
  | 'visit2_referral'
  | 'visit3_gift'
  | 'regular_touch'
  | 'day_30'
  | 'day_90';

export interface TeamAction {
  key: ActionKey;
  title: string;
  detail: string;
  /** Words Nicole or Angel can send as they are. */
  script?: string;
  /** 'alert' needs a person soon; 'todo' is a task; 'milestone' is a date to know about. */
  tone: 'alert' | 'todo' | 'milestone';
}

/** "Nov 28" from 2026-11-28. */
function shortDate(d: string): string {
  return new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

const MILESTONE_SHOWS_FOR = 3; // days a milestone stays on the dashboard

/**
 * What the team should do for this member now. Only things that are due and
 * not yet marked done are returned.
 */
export function teamActions(args: {
  firstName: string | null | undefined;
  day: number;
  visits: string[];
  today: string;
  done: Set<string>;
}): TeamAction[] {
  const { day, visits, today, done } = args;
  const name = (args.firstName || 'They').trim();
  const out: TeamAction[] = [];
  const add = (a: TeamAction) => { if (!done.has(a.key)) out.push(a); };
  if (day < 0 || day > JOURNEY_DAYS + CATCH_UP_DAYS) return out;

  if (visits.length === 0 && day >= 21) {
    add({
      key: 'no_visit_21',
      tone: 'alert',
      title: `No visit yet, day ${day}`,
      detail: `${name} joined ${day} days ago and has not been in. A personal note from Nicole, with an offer to book their first table, is the best next step.`,
    });
  }

  if (visits.length >= 1) {
    const sinceFirst = daysBetween(visits[0], today);
    if (sinceFirst >= 1) {
      add({
        key: 'visit1_gift',
        tone: 'todo',
        title: 'Welcome gift not marked as given',
        detail: `First visit was ${shortDate(visits[0])}. Mark it done if they got their welcome gift, or have it ready next time.`,
      });
    }
    if (sinceFirst >= 3) {
      add({
        key: 'visit1_note',
        tone: 'todo',
        title: 'Send the first-visit note',
        detail: `First visit was ${shortDate(visits[0])}. A short note with no pitch, three to five days after.`,
        script: 'It was great having you in. Hope you enjoyed your first visit with us. We look forward to seeing you again soon.',
      });
    }
  }

  if (visits.length >= 2 && daysBetween(visits[1], today) >= 1) {
    add({
      key: 'visit2_referral',
      tone: 'todo',
      title: 'First referral ask',
      detail: `Second visit was ${shortDate(visits[1])}. Introduce the referral program.`,
      script: `So good to see you again, ${name}. Our members bring the best people. If someone in your circle would love Noir, send us their name and we'll take it from there.`,
    });
  }

  if (visits.length >= 3 && daysBetween(visits[2], today) >= 1) {
    add({
      key: 'visit3_gift',
      tone: 'todo',
      title: 'Third-visit thank-you gift not marked as given',
      detail: `Third visit was ${shortDate(visits[2])}. "You've made it three times. We're so glad you're here."`,
    });
  }

  if (day >= 60 && day <= 75 && visits.length >= 4) {
    add({
      key: 'regular_touch',
      tone: 'todo',
      title: 'An unexpected touch for a regular',
      detail: `${visits.length} visits so far. A small tasting, an off-menu cocktail, a first taste of something new or a bartender's pick. Recognition is worth more than the perk.`,
    });
  }

  if (day >= 30 && day < 30 + MILESTONE_SHOWS_FOR) {
    add({
      key: 'day_30',
      tone: 'milestone',
      title: day === 30 ? '30 days today' : `30 days, ${day - 30} day${day - 30 > 1 ? 's' : ''} ago`,
      detail: `${visits.length} visit${visits.length === 1 ? '' : 's'} so far. The 30-day text asks for their go-to drink; add the answer to their profile.`,
    });
  }

  if (day >= JOURNEY_DAYS && day < JOURNEY_DAYS + MILESTONE_SHOWS_FOR) {
    add({
      key: 'day_90',
      tone: 'milestone',
      title: day === JOURNEY_DAYS ? '90 days today' : `90 days, ${day - JOURNEY_DAYS} day${day - JOURNEY_DAYS > 1 ? 's' : ''} ago`,
      detail: `${visits.length} visit${visits.length === 1 ? '' : 's'} in their first 90 days.`,
    });
  }

  return out;
}

export const ACTION_KEYS: ActionKey[] = [
  'no_visit_21', 'visit1_gift', 'visit1_note', 'visit2_referral', 'visit3_gift', 'regular_touch', 'day_30', 'day_90',
];

/**
 * What the floor team should know when this member walks in tonight.
 * `priorVisits` is the visits before today.
 */
export function arrivalBrief(priorVisits: number, day: number | null): { visitNumber: number; note: string } {
  const visitNumber = priorVisits + 1;
  if (!inJourney(day)) return { visitNumber, note: '' };
  if (visitNumber === 1) {
    return {
      visitNumber,
      note: 'First visit. Welcome gift. Greet them by name, introduce yourself, ask what they like to drink and make a recommendation. Note their spirit, favorite cocktails, how they take it and where they like to sit.',
    };
  }
  if (visitNumber === 2) {
    return {
      visitNumber,
      note: 'Second visit. "Good to see you again. Want your usual, or are you feeling adventurous tonight?" Make them their cocktail.',
    };
  }
  if (visitNumber === 3) {
    return { visitNumber, note: 'Third visit. Thank-you gift: "You\'ve made it three times. We\'re so glad you\'re here."' };
  }
  if (day !== null && day >= 60 && day <= 75) {
    return { visitNumber, note: 'A regular in their first 90 days. A good night for an unexpected touch: a tasting, something off-menu or a bartender\'s pick.' };
  }
  return { visitNumber, note: '' };
}
