/**
 * 90-day member journey: loading and sending. The rules are in memberJourney.ts.
 * Server only (uses the service-role client).
 */

import { DateTime } from 'luxon';
import { supabaseAdmin } from './supabase';
import { sendSMS } from './sms';
import { isMissingTable } from './noirLife';
import { addDays, CHICAGO_TZ } from './businessMetricsCore';
import { ACTIVE_SUBSCRIPTION_STATUSES } from './memberStatusFilter';
import {
  JOURNEY_DAYS,
  CATCH_UP_DAYS,
  JourneyLogRow,
  JourneySettings,
  JourneyStep,
  LedgerVisitRow,
  TeamAction,
  arrivalBrief,
  dateOnly,
  inJourney,
  isSendWindow,
  journeyDay,
  journeyWeek,
  localDate,
  parseSettings,
  pickNextText,
  renderText,
  sentTextOn,
  stepsFor,
  teamActions,
  toE164,
  visitDates,
} from './memberJourney';

const PAGE = 1000;

/** Supabase returns at most 1000 rows a request; read every page. */
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < PAGE) return out;
  }
}

function chunk<T>(items: T[], size = 200): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function purchasesFor(accountIds: string[], since?: string): Promise<Map<string, LedgerVisitRow[]>> {
  const byAccount = new Map<string, LedgerVisitRow[]>();
  for (const ids of chunk([...new Set(accountIds)])) {
    const rows = await fetchAll<LedgerVisitRow & { account_id: string }>((from, to) => {
      let q = supabaseAdmin
        .from('ledger')
        .select('account_id, type, note, date')
        .in('account_id', ids)
        .eq('type', 'purchase')
        .order('date', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to);
      if (since) q = q.gte('date', since);
      return q;
    });
    for (const r of rows) {
      if (!byAccount.has(r.account_id)) byAccount.set(r.account_id, []);
      byAccount.get(r.account_id)!.push(r);
    }
  }
  return byAccount;
}

// ---------------------------------------------------------------------------
// Settings and steps
// ---------------------------------------------------------------------------

export async function loadSettings(): Promise<JourneySettings> {
  const { data, error } = await supabaseAdmin
    .from('member_journey_settings')
    .select('enabled, start_date, footer')
    .eq('id', true)
    .maybeSingle();
  if (error && !isMissingTable(error)) throw error;
  return parseSettings(data);
}

export async function saveSettings(next: JourneySettings): Promise<void> {
  const { error } = await supabaseAdmin
    .from('member_journey_settings')
    .upsert({ id: true, ...next, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) throw error;
}

/** The steps, in order. `ready` is false until the migration has been applied. */
export async function loadSteps(): Promise<{ steps: JourneyStep[]; ready: boolean }> {
  const { data, error } = await supabaseAdmin
    .from('member_journey_steps')
    .select('key, position, day_offset, label, body, post_id, audience, is_active')
    .order('position', { ascending: true });
  if (error) {
    if (isMissingTable(error)) return { steps: [], ready: false };
    throw error;
  }
  return { steps: (data || []) as JourneyStep[], ready: true };
}

async function publishedPosts(steps: JourneyStep[]): Promise<Set<string>> {
  const ids = [...new Set(steps.map(s => s.post_id).filter(Boolean) as string[])];
  if (ids.length === 0) return new Set();
  const { data, error } = await supabaseAdmin
    .from('noir_life_posts')
    .select('id')
    .in('id', ids)
    .eq('is_published', true);
  if (error && !isMissingTable(error)) throw error;
  return new Set((data || []).map((p: { id: string }) => p.id));
}

// ---------------------------------------------------------------------------
// The roster: every member in their first 90 days
// ---------------------------------------------------------------------------

interface MemberRow {
  member_id: string;
  account_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  member_type: string | null;
  join_date: string | null;
  referral_code: string | null;
  contact_preferences: { sms?: boolean } | null;
}

export interface RosterRow {
  memberId: string;
  accountId: string;
  name: string;
  firstName: string | null;
  isPrimary: boolean;
  joinDate: string;
  day: number;
  week: number;
  /** Joined on or after the series start date, so they get the texts and the team tasks. */
  enrolled: boolean;
  visits: string[];
  textsSent: number;
  textsTotal: number;
  nextText: { label: string; date: string } | null;
  waitingOnPost: string[];
  /** Why this member is not being texted, if they are not. */
  notTexting: string | null;
  actions: TeamAction[];
}

export interface JourneyState {
  today: string;
  ready: boolean;
  settings: JourneySettings;
  steps: JourneyStep[];
  publishedPostIds: Set<string>;
  roster: RosterRow[];
  /** Kept for the sender; not returned to the browser. */
  internal: Map<string, { member: MemberRow; log: JourneyLogRow[] }>;
}

export async function loadJourney(today: string): Promise<JourneyState> {
  const [settings, { steps, ready }] = await Promise.all([loadSettings(), loadSteps()]);
  const state: JourneyState = {
    today, ready, settings, steps, publishedPostIds: new Set(), roster: [], internal: new Map(),
  };
  if (!ready) return state;

  const earliest = addDays(today, -(JOURNEY_DAYS + CATCH_UP_DAYS));
  const [published, memberRes] = await Promise.all([
    publishedPosts(steps),
    supabaseAdmin
      .from('members')
      .select('member_id, account_id, first_name, last_name, phone, member_type, join_date, referral_code, contact_preferences')
      .eq('status', 'active')
      .gte('join_date', earliest)
      .order('join_date', { ascending: false }),
  ]);
  if (memberRes.error) throw memberRes.error;
  state.publishedPostIds = published;
  const members = ((memberRes.data || []) as MemberRow[]).filter(m => m.account_id && dateOnly(m.join_date));
  if (members.length === 0) return state;

  const memberIds = members.map(m => m.member_id);
  const accountIds = [...new Set(members.map(m => m.account_id))];

  const [accountRes, logRows, purchases] = await Promise.all([
    supabaseAdmin.from('accounts').select('account_id, subscription_status').in('account_id', accountIds),
    fetchAll<JourneyLogRow>((from, to) =>
      supabaseAdmin
        .from('member_journey_log')
        .select('member_id, step_key, kind, status, attempts, updated_at')
        .in('member_id', memberIds)
        .order('id', { ascending: true })
        .range(from, to)
    ),
    purchasesFor(accountIds, earliest),
  ]);
  if (accountRes.error) throw accountRes.error;
  const accountStatus = new Map<string, string | null>(
    (accountRes.data || []).map((a: { account_id: string; subscription_status: string | null }) => [a.account_id, a.subscription_status])
  );
  const logByMember = new Map<string, JourneyLogRow[]>();
  for (const l of logRows) {
    if (!logByMember.has(l.member_id)) logByMember.set(l.member_id, []);
    logByMember.get(l.member_id)!.push(l);
  }

  for (const m of members) {
    const joinDate = dateOnly(m.join_date)!;
    const day = journeyDay(joinDate, today)!;
    if (day < 0) continue;
    const isPrimary = (m.member_type || 'primary') === 'primary';
    const log = logByMember.get(m.member_id) || [];
    const visits = visitDates(purchases.get(m.account_id) || [], joinDate);
    const enrolled = !!settings.start_date && joinDate >= settings.start_date;
    const mine = stepsFor(steps, isPrimary);
    const sentKeys = new Set(log.filter(l => l.kind === 'text' && l.status === 'sent').map(l => l.step_key));
    const done = new Set(log.filter(l => l.kind === 'action').map(l => l.step_key));
    const upcoming = mine.find(s => !sentKeys.has(s.key));
    const next = pickNextText({ steps, isPrimary, day, log, publishedPostIds: published });

    const status = accountStatus.get(m.account_id);
    let notTexting: string | null = null;
    if (!enrolled) notTexting = settings.start_date ? 'Joined before the series started' : 'Series has not been turned on';
    else if (!settings.enabled) notTexting = 'Series is paused';
    else if (!toE164(m.phone)) notTexting = 'No mobile number on file';
    else if (m.contact_preferences?.sms === false) notTexting = 'Member turned texts off';
    else if (!status || !ACTIVE_SUBSCRIPTION_STATUSES.includes(status)) notTexting = `Membership is ${status || 'not active'}`;

    state.internal.set(m.member_id, { member: m, log });
    // The dashboard lists days 0 to 90; the extra two weeks exist only so late texts can finish.
    if (!inJourney(day) && !(enrolled && sentKeys.size < mine.length)) continue;
    state.roster.push({
      memberId: m.member_id,
      accountId: m.account_id,
      name: [m.first_name, m.last_name].filter(Boolean).join(' ') || 'Member',
      firstName: m.first_name,
      isPrimary,
      joinDate,
      day,
      week: journeyWeek(day),
      enrolled,
      visits,
      textsSent: mine.filter(s => sentKeys.has(s.key)).length,
      textsTotal: mine.length,
      nextText: upcoming ? { label: upcoming.label, date: addDays(joinDate, upcoming.day_offset) } : null,
      waitingOnPost: next.waitingOnPost.map(s => s.label),
      notTexting,
      actions: enrolled ? teamActions({ firstName: m.first_name, day, visits, today, done }) : [],
    });
  }
  return state;
}

// ---------------------------------------------------------------------------
// The morning send
// ---------------------------------------------------------------------------

export interface SendResult {
  skipped?: string;
  sent: number;
  failed: number;
  errors: string[];
}

const MAX_PER_RUN = 150;

/**
 * Send this morning's texts: at most one per member. Safe to call twice; a
 * member who already got today's text is passed over.
 */
export async function runJourneySends(now: Date = new Date(), opts: { force?: boolean } = {}): Promise<SendResult> {
  const result: SendResult = { sent: 0, failed: 0, errors: [] };
  if (!opts.force && !isSendWindow(now)) return { ...result, skipped: 'Outside the 10:28 AM send window' };

  const today = localDate(now);
  const state = await loadJourney(today);
  if (!state.ready) return { ...result, skipped: 'Journey tables are not set up yet' };
  if (!state.settings.enabled) return { ...result, skipped: 'Series is off' };

  for (const row of state.roster) {
    if (result.sent + result.failed >= MAX_PER_RUN) break;
    if (row.notTexting) continue;
    const { member, log } = state.internal.get(row.memberId)!;
    if (sentTextOn(log, today)) continue;

    const { send } = pickNextText({
      steps: state.steps, isPrimary: row.isPrimary, day: row.day, log, publishedPostIds: state.publishedPostIds,
    });
    if (!send) continue;
    const to = toE164(member.phone);
    if (!to) continue;

    // Claim the step before sending, so a second run at the same moment cannot send it too.
    const prior = log.find(l => l.kind === 'text' && l.step_key === send.step.key);
    const stamp = new Date().toISOString();
    if (prior) {
      const { data: claimed, error } = await supabaseAdmin
        .from('member_journey_log')
        .update({ attempts: prior.attempts + 1, detail: 'sending', updated_at: stamp })
        .eq('member_id', row.memberId)
        .eq('step_key', send.step.key)
        .eq('status', 'failed')
        .eq('attempts', prior.attempts)
        .select('id');
      if (error || !claimed?.length) continue;
    } else {
      const { error } = await supabaseAdmin.from('member_journey_log').insert({
        member_id: row.memberId, step_key: send.step.key, kind: 'text', status: 'failed', detail: 'sending', created_by: 'cron',
      });
      if (error) continue; // unique violation: another run has it
    }

    const content = renderText({
      step: send.step,
      firstName: member.first_name,
      referralCode: member.referral_code,
      n: send.n,
      total: send.total,
      footer: state.settings.footer,
    });
    const sms = await sendSMS({ to, content, memberId: row.memberId, accountId: row.accountId });
    const { error: logError } = await supabaseAdmin
      .from('member_journey_log')
      .update({
        status: sms.success ? 'sent' : 'failed',
        detail: sms.success ? content : `Send failed: ${sms.error || 'unknown error'}`,
        updated_at: new Date().toISOString(),
      })
      .eq('member_id', row.memberId)
      .eq('step_key', send.step.key);
    if (logError) result.errors.push(`${row.name}: sent but not recorded (${logError.message})`);
    if (sms.success) result.sent++;
    else {
      result.failed++;
      result.errors.push(`${row.name}: ${sms.error || 'send failed'}`);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Today's members: who has a table today, per location
// ---------------------------------------------------------------------------

export interface TodaysMemberRow {
  reservationId: string;
  startTime: string;
  partySize: number | null;
  table: string | null;
  reservationNotes: string | null;
  memberId: string;
  accountId: string;
  name: string;
  memberSince: string | null;
  /** Journey day, when they are in their first 90 days. */
  day: number | null;
  /** Which visit tonight is: all-time for the account. */
  visitNumber: number;
  lastVisit: string | null;
  /** What to do tonight, for members in their first 90 days. */
  brief: string;
  attributes: { key: string; value: string }[];
  notes: string[];
}

export interface TodaysLocation {
  locationId: string | null;
  name: string;
  timezone: string;
  members: TodaysMemberRow[];
  /** Reservations today that are not tied to a member. */
  guestReservations: number;
}

const last10 = (phone: string | null | undefined) => (phone || '').replace(/\D/g, '').slice(-10);

export async function loadTodaysMembers(today: string): Promise<TodaysLocation[]> {
  const dayStart = DateTime.fromISO(today, { zone: CHICAGO_TZ }).startOf('day');
  const { data: reservations, error } = await supabaseAdmin
    .from('reservations')
    .select('*')
    .gte('start_time', dayStart.toUTC().toISO())
    .lt('start_time', dayStart.plus({ days: 1 }).toUTC().toISO())
    .order('start_time', { ascending: true });
  if (error) throw error;
  const live = (reservations || []).filter((r: any) => !['cancelled', 'canceled', 'no_show'].includes(r.status));

  const [locRes, members] = await Promise.all([
    supabaseAdmin.from('locations').select('id, name, timezone'),
    fetchAll<any>((from, to) =>
      supabaseAdmin
        .from('members')
        .select('member_id, account_id, first_name, last_name, phone, join_date, status')
        .order('member_id', { ascending: true })
        .range(from, to)
    ),
  ]);
  if (locRes.error) throw locRes.error;
  const active = members.filter(m => m.status === 'active');
  const byId = new Map(active.map(m => [m.member_id, m]));
  const byPhone = new Map(active.filter(m => last10(m.phone).length === 10).map(m => [last10(m.phone), m]));

  const matched: { r: any; m: any }[] = [];
  const guestCount = new Map<string | null, number>();
  for (const r of live) {
    const m = (r.member_id && byId.get(r.member_id)) || byPhone.get(last10(r.phone));
    if (m) matched.push({ r, m });
    else guestCount.set(r.location_id || null, (guestCount.get(r.location_id || null) || 0) + 1);
  }

  const memberIds = [...new Set(matched.map(x => x.m.member_id))];
  const accountIds = [...new Set(matched.map(x => x.m.account_id).filter(Boolean))];
  const tableIds = [...new Set(matched.map(x => x.r.table_id).filter(Boolean))];

  const [purchases, attrRes, noteRes, tableRes] = await Promise.all([
    accountIds.length ? purchasesFor(accountIds) : Promise.resolve(new Map<string, LedgerVisitRow[]>()),
    memberIds.length
      ? supabaseAdmin.from('member_attributes').select('member_id, key, value').in('member_id', memberIds)
      : Promise.resolve({ data: [], error: null }),
    memberIds.length
      ? supabaseAdmin.from('member_notes').select('member_id, note, created_at').in('member_id', memberIds).order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    tableIds.length
      ? supabaseAdmin.from('tables').select('id, table_number').in('id', tableIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  // Preferences and notes are extras: a problem reading them must not hide who is coming in.
  const attrs = (attrRes.error ? [] : attrRes.data || []) as { member_id: string; key: string; value: string }[];
  const notes = (noteRes.error ? [] : noteRes.data || []) as { member_id: string; note: string }[];
  const tableNumber = new Map(((tableRes.error ? [] : tableRes.data || []) as any[]).map(t => [String(t.id), t.table_number]));

  const locations = new Map<string | null, TodaysLocation>();
  const locInfo = new Map((locRes.data || []).map((l: any) => [l.id, l]));
  const groupFor = (locationId: string | null): TodaysLocation => {
    if (!locations.has(locationId)) {
      const info = locationId ? locInfo.get(locationId) : null;
      locations.set(locationId, {
        locationId,
        name: info?.name || 'No location set',
        timezone: info?.timezone || CHICAGO_TZ,
        members: [],
        guestReservations: guestCount.get(locationId) || 0,
      });
    }
    return locations.get(locationId)!;
  };

  for (const { r, m } of matched) {
    const allVisits = visitDates(purchases.get(m.account_id) || []);
    const before = allVisits.filter(d => d < today);
    const joinDate = dateOnly(m.join_date);
    const day = journeyDay(joinDate, today);
    const journeyVisitsBefore = joinDate ? before.filter(d => d >= joinDate).length : before.length;
    const brief = arrivalBrief(journeyVisitsBefore, day);
    const tn = r.table_id ? tableNumber.get(String(r.table_id)) : null;
    groupFor(r.location_id || null).members.push({
      reservationId: r.id,
      startTime: r.start_time,
      partySize: r.party_size ?? null,
      table: tn !== undefined && tn !== null ? String(tn) : null,
      reservationNotes: r.notes || null,
      memberId: m.member_id,
      accountId: m.account_id,
      name: [m.first_name, m.last_name].filter(Boolean).join(' ') || 'Member',
      memberSince: joinDate,
      day: inJourney(day) ? day : null,
      visitNumber: before.length + 1,
      lastVisit: before.length ? before[before.length - 1] : null,
      brief: brief.note,
      attributes: attrs.filter(a => a.member_id === m.member_id && a.value).map(a => ({ key: a.key, value: a.value })),
      notes: notes.filter(n => n.member_id === m.member_id).slice(0, 2).map(n => n.note),
    });
  }
  // Locations with only guest reservations still show, so the count is not lost.
  for (const locationId of guestCount.keys()) groupFor(locationId);

  return [...locations.values()].sort((a, b) => a.name.localeCompare(b.name));
}
