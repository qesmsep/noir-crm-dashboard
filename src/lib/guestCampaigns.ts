/**
 * Campaign trigger "Guest Registration" (trigger_type 'guest_registration').
 *
 * The guest intro and any follow-ups are ordinary campaign messages built in
 * Campaigns, sent to "The guest" (recipient_type 'reservation_guest') or a
 * custom phone. The trigger moment is when the guest was attached to the
 * reservation (reservation_guests.created_at).
 *
 *   Send immediately  → sent by sendGuestAddedCampaignMessages() as the guest is
 *                       added (skipped when the reservation starts within 2 hours
 *                       and the built-in day-of text is on — it covers it)
 *   Relative / time   → sent by the campaign cron via processGuestAddedCampaignMessage()
 *
 * Every send re-checks: guest still on the reservation, reservation not
 * cancelled, and (for the guest) not opted out and not a member. Follow-ups
 * keep going after the visit and stop only on STOP. One send per
 * (message, guest), claimed before sending.
 */
import { DateTime } from 'luxon';
import { supabaseAdmin } from '@/lib/supabase';
import { sendSMS } from '@/lib/sms';
import { toE164 } from '@/lib/phone';
import { MAX_SEND_ATTEMPTS, RETRY_WINDOW_MINUTES, STALE_CLAIM_MINUTES } from '@/lib/reservationCampaigns';
import {
  activeKindsFrom,
  DEFAULT_ARRIVAL_INSTRUCTIONS,
  DEFAULT_TIMEZONE,
  findMemberIdByPhone,
  introCoveredByDayOf,
  loadTemplates,
  type EventCampaignMessage,
  type GuestDeps,
} from '@/lib/reservationGuests';

import { GUEST_RECIPIENT_TYPES, guestRecipientMatches, isGuestRecipient } from '@/lib/guestRecipients';

export const GUEST_REGISTRATION_TRIGGER = 'guest_registration';
/** Sent through the guest queue when a reservation with guests moves or is cancelled. */
export const RESERVATION_MOVED_TRIGGER = 'reservation_moved';
export const RESERVATION_CANCELLED_TRIGGER = 'reservation_cancelled';
export const GUEST_EVENT_TRIGGERS = [RESERVATION_MOVED_TRIGGER, RESERVATION_CANCELLED_TRIGGER] as const;
export const SENT_BY_CAMPAIGN = 'system:campaign';
const WINDOW_FUTURE_MINUTES = 5;
const WINDOW_PAST_MINUTES = 60;

type Db = typeof supabaseAdmin;

export interface GuestCampaignMessage {
  id: string;
  name?: string;
  content: string;
  recipient_type: string;
  specific_phone?: string | null;
  timing_type: string;
  is_active?: boolean | null;
  specific_time?: string | null;
  specific_date?: string | null;
  relative_time?: string | null;
  relative_quantity?: number | null;
  relative_unit?: string | null;
  relative_proximity?: string | null;
  /** NULL/'trigger' = from when the guest was added; 'reservation_start' = from the reservation start. */
  relative_anchor?: string | null;
  campaigns?: {
    id: string;
    trigger_type: string;
    is_active?: boolean | null;
    applies_to_all_locations?: boolean | null;
    campaign_locations?: Array<{ location_id: string | null }> | null;
  } | null;
}

interface GuestCampaignGuest {
  id: string;
  reservation_id: string;
  location_id: string | null;
  status: string;
  first_name_snapshot: string | null;
  matched_member_id: string | null;
  notified_at: string | null;
  created_at: string;
  guest_contacts?: { id: string; phone: string; first_name: string; last_name: string | null; sms_opted_out_at: string | null } | null;
}

interface GuestCampaignReservation {
  id: string;
  status: string | null;
  start_time: string;
  party_size: number | null;
  first_name: string | null;
  last_name?: string | null;
  member_id: string | null;
  location_id: string | null;
}

interface LocationRow {
  id: string;
  name: string | null;
  timezone: string | null;
  guest_arrival_instructions?: string | null;
  address?: string | null;
  parking_instructions?: string | null;
}

const GUEST_SELECT =
  'id, reservation_id, location_id, status, first_name_snapshot, matched_member_id, notified_at, created_at, guest_contacts(id, phone, first_name, last_name, sms_opted_out_at)';
const RESERVATION_SELECT = 'id, status, start_time, party_size, first_name, last_name, member_id, location_id';
const MESSAGE_SELECT = `
  id, name, content, recipient_type, specific_phone, timing_type, is_active,
  specific_time, specific_date, relative_time, relative_quantity, relative_unit, relative_proximity, relative_anchor,
  campaigns!inner ( id, trigger_type, is_active, applies_to_all_locations, campaign_locations ( location_id ) )
`;

function resolve(deps: GuestDeps = {}) {
  return { db: deps.db ?? supabaseAdmin, send: deps.send ?? sendSMS, now: (deps.now ?? (() => DateTime.utc()))() };
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function messageAppliesToGuestLocation(
  message: GuestCampaignMessage,
  locationId: string | null,
  trigger: string = GUEST_REGISTRATION_TRIGGER,
): boolean {
  const c = message.campaigns;
  if (!c || c.trigger_type !== trigger || c.is_active === false) return false;
  if (c.applies_to_all_locations) return true;
  return !!locationId && (c.campaign_locations || []).some((cl) => cl.location_id === locationId);
}

export function anchorsOnReservation(message: GuestCampaignMessage): boolean {
  return message.timing_type === 'relative' && message.relative_anchor === 'reservation_start';
}

const LUXON_UNITS = { minute: 'minutes', hour: 'hours', day: 'days', week: 'weeks', month: 'months', year: 'years' } as const;

/**
 * When this message goes out for one guest, in the venue timezone.
 *
 * Counted from when the guest was added (default) or, with relative_anchor
 * 'reservation_start', from the reservation start ("3 hours before the
 * reservation", "1 day after"). Minute offsets — and hour offsets from the
 * reservation — are exact; larger units land on the message's clock time,
 * like other campaigns.
 */
export function guestAddedSendTime(
  message: GuestCampaignMessage,
  addedAt: DateTime,
  timezone: string,
  reservationStart?: string | null,
): DateTime | null {
  if (message.timing_type === 'immediate') return addedAt.setZone(timezone);
  const fromReservation = anchorsOnReservation(message);
  if (fromReservation && !reservationStart) return null;
  const trigger = fromReservation
    ? DateTime.fromISO(reservationStart!, { zone: 'utc' }).setZone(timezone)
    : addedAt.setZone(timezone);
  if (message.timing_type === 'relative') {
    const q = message.relative_quantity || 0;
    const unit = message.relative_unit || 'day';
    const sign = message.relative_proximity === 'before' ? -1 : 1;
    const luxonUnit = LUXON_UNITS[unit as keyof typeof LUXON_UNITS] || 'days';
    const moved = q > 0 ? trigger.plus({ [luxonUnit]: sign * q }) : trigger;
    if (unit === 'minute' || (fromReservation && unit === 'hour')) return moved.set({ second: 0, millisecond: 0 });
    const [h, m] = (message.relative_time || '10:00').split(':').map(Number);
    return moved.set({ hour: h || 0, minute: m || 0, second: 0, millisecond: 0 });
  }
  if (message.timing_type === 'specific_time') {
    const [h, m] = (message.specific_time || '10:00').split(':').map(Number);
    const day = message.specific_date ? DateTime.fromISO(message.specific_date, { zone: timezone }) : trigger;
    return day.set({ hour: h || 0, minute: m || 0, second: 0, millisecond: 0 });
  }
  return null;
}

/** Signed offset in minutes (approximate for months/years) for a relative message. */
function signedOffsetMinutes(message: GuestCampaignMessage): number {
  const q = message.relative_quantity || 0;
  const per = ({ minute: 1, hour: 60, day: 1440, week: 10080, month: 44640, year: 527040 } as Record<string, number>)[message.relative_unit || 'day'] || 1440;
  return (message.relative_proximity === 'before' ? -1 : 1) * q * per;
}

/** How far back to look for guests whose send time could be due now. */
export function lookbackMinutes(message: GuestCampaignMessage): number {
  const cap = 400 * 24 * 60;
  if (message.timing_type === 'relative') {
    const q = message.relative_quantity || 0;
    const per = ({ minute: 1, hour: 60, day: 1440, week: 10080, month: 44640, year: 527040 } as Record<string, number>)[message.relative_unit || 'day'] || 1440;
    return Math.min(cap, q * per + 1440 + WINDOW_PAST_MINUTES + 1);
  }
  if (message.timing_type === 'specific_time' && message.specific_date) return 30 * 1440;
  return 2 * 1440;
}

export function renderGuestCampaignMessage(
  content: string,
  ctx: {
    guestFirstName: string;
    guestLastName: string | null;
    hostFirstName: string;
    hostLastName?: string | null;
    locationName: string;
    locationAddress?: string | null;
    parkingInstructions?: string | null;
    start: string;
    partySize: number | null;
    timezone: string;
    arrivalInstructions?: string | null;
    /** {{calendar_link}}: the reservation's add-to-calendar file. */
    calendarLink?: string | null;
  },
): string {
  const start = DateTime.fromISO(ctx.start, { zone: 'utc' }).setZone(ctx.timezone);
  const arrival = (ctx.arrivalInstructions || '').trim() || DEFAULT_ARRIVAL_INSTRUCTIONS;
  return content
    .replace(/\{\{(guest_first_name|first_name)\}\}/g, () => ctx.guestFirstName)
    .replace(/\{\{(guest_last_name|last_name)\}\}/g, () => ctx.guestLastName || '')
    .replace(/\{\{host_first_name\}\}/g, () => ctx.hostFirstName)
    .replace(/\{\{host_last_name\}\}/g, () => ctx.hostLastName || '')
    .replace(/\{\{location_name\}\}/g, () => ctx.locationName)
    .replace(/\{\{location_address\}\}/g, () => (ctx.locationAddress || '').trim())
    .replace(/\{\{parking_instructions\}\}/g, () => (ctx.parkingInstructions || '').trim())
    .replace(/\{\{reservation_date\}\}/g, () => start.isValid ? start.toFormat('cccc, LLLL d') : '')
    .replace(/\{\{reservation_time\}\}/g, () => start.isValid ? start.toFormat('h:mm a') : '')
    .replace(/\{\{party_size\}\}/g, () => ctx.partySize != null ? String(ctx.partySize) : '')
    .replace(/\{\{arrival_instructions\}\}/g, () => arrival)
    .replace(/\{\{calendar_link\}\}/g, () => ctx.calendarLink || '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

interface Context {
  guest: GuestCampaignGuest;
  reservation: GuestCampaignReservation;
  location: LocationRow | null;
  host: string;
  hostLast: string;
}

async function loadContext(db: Db, guestId: string): Promise<Context | null> {
  const { data: guest } = await db.from('reservation_guests').select(GUEST_SELECT).eq('id', guestId).maybeSingle();
  if (!guest) return null;
  const g = guest as unknown as GuestCampaignGuest;
  const { data: res } = await db.from('reservations').select(RESERVATION_SELECT).eq('id', g.reservation_id).maybeSingle();
  if (!res) return null;
  const reservation = res as GuestCampaignReservation;
  const locationId = reservation.location_id || g.location_id;
  const { data: loc } = locationId
    ? await db
        .from('locations')
        .select('id, name, timezone, guest_arrival_instructions, address, parking_instructions')
        .eq('id', locationId)
        .maybeSingle()
    : { data: null };
  let host = (reservation.first_name || '').trim().split(' ')[0];
  let hostLast = host ? (reservation.last_name || '').trim() : '';
  if (!host && reservation.member_id) {
    const { data: m } = await db.from('members').select('first_name, last_name').eq('member_id', reservation.member_id).maybeSingle();
    host = ((m as { first_name?: string } | null)?.first_name || '').trim();
    hostLast = host ? ((m as { last_name?: string } | null)?.last_name || '').trim() : '';
  }
  return { guest: g, reservation, location: (loc as LocationRow) || null, host: host || 'your host', hostLast };
}

export type GuestCampaignOutcome = 'sent' | 'duplicate' | 'exhausted' | 'failed' | `skipped:${string}`;

/** Re-check, render, claim, send and log one guest-added campaign message. */
async function deliver(
  db: Db,
  deps: GuestDeps,
  message: GuestCampaignMessage,
  ctx: Context,
  scheduledTime: DateTime,
): Promise<GuestCampaignOutcome> {
  const { send, now } = resolve(deps);
  const { guest, reservation, location } = ctx;
  const contact = guest.guest_contacts;
  if (guest.status !== 'active') return 'skipped:guest_removed';
  if (reservation.status === 'cancelled') return 'skipped:reservation_cancelled';
  if (!contact) return 'skipped:no_contact';

  const toGuest = isGuestRecipient(message.recipient_type);
  let phone: string | null;
  if (toGuest) {
    if (contact.sms_opted_out_at) return 'skipped:opted_out';
    // Members on someone else's reservation get the guest texts too. Keep the
    // member badge current if they joined since they were added.
    let isMember = !!guest.matched_member_id;
    if (!isMember) {
      const memberNow = await findMemberIdByPhone(db, contact.phone);
      if (memberNow) {
        isMember = true;
        await db.from('reservation_guests').update({ matched_member_id: memberNow }).eq('id', guest.id);
      }
    }
    if (!guestRecipientMatches(message.recipient_type, isMember)) {
      return isMember ? 'skipped:recipient_nonmembers_only' : 'skipped:recipient_members_only';
    }
    phone = contact.phone;
  } else if (message.recipient_type === 'specific_phone') {
    phone = toE164(message.specific_phone);
  } else {
    return 'skipped:unsupported_recipient';
  }
  if (!phone) return 'skipped:no_phone';

  // {{calendar_link}} never goes out empty: skip this text if the link can't be made.
  let calendarLink = '';
  if (message.content.includes('{{calendar_link}}')) {
    const { guestLinksForReservation } = await import('@/lib/reservationCampaigns');
    calendarLink = (await guestLinksForReservation(reservation.id, db)).calendarLink;
    if (!calendarLink) return 'skipped:no_calendar_link';
  }

  const content = renderGuestCampaignMessage(message.content, {
    guestFirstName: guest.first_name_snapshot || contact.first_name,
    guestLastName: contact.last_name,
    hostFirstName: ctx.host,
    hostLastName: ctx.hostLast,
    locationAddress: location?.address,
    parkingInstructions: location?.parking_instructions,
    locationName: location?.name || 'Noir',
    start: reservation.start_time,
    partySize: reservation.party_size,
    timezone: location?.timezone || DEFAULT_TIMEZONE,
    arrivalInstructions: location?.guest_arrival_instructions,
    calendarLink,
  });

  // Stop after MAX_SEND_ATTEMPTS failed tries for this (message, guest).
  const { data: failedRows } = await db
    .from('scheduled_messages')
    .select('id')
    .eq('campaign_message_id', message.id)
    .eq('reservation_guest_id', guest.id)
    .eq('status', 'failed');
  if ((failedRows || []).length >= MAX_SEND_ATTEMPTS) return 'exhausted';

  const { data: claimed, error: claimError } = await db
    .from('scheduled_messages')
    .insert({
      campaign_message_id: message.id,
      reservation_guest_id: guest.id,
      member_id: null,
      phone_number: phone,
      message_content: content,
      scheduled_time: scheduledTime.toISO(),
      status: 'pending',
    })
    .select('id')
    .single();
  if (claimError?.code === '23505') return 'duplicate';
  if (claimError || !claimed) {
    console.error('[guest campaigns] could not record send', claimError?.message);
    return 'failed';
  }
  const rowId = (claimed as { id: string }).id;

  const result = await send({ to: phone, content });
  await db
    .from('scheduled_messages')
    .update(result.success ? { status: 'sent', sent_time: now.toISO() } : { status: 'failed', error_message: result.error || 'Send failed' })
    .eq('id', rowId);

  if (toGuest) {
    await db.from('guest_messages').insert({
      phone,
      content,
      reservation_id: reservation.id,
      sent_by: SENT_BY_CAMPAIGN,
      status: result.success ? 'sent' : 'failed',
      error_message: result.success ? null : result.error || 'Send failed',
      openphone_message_id: result.messageId ?? null,
      timestamp: now.toISO(),
    });
    if (result.success && !guest.notified_at) {
      await db.from('reservation_guests').update({ notified_at: now.toISO() }).eq('id', guest.id).is('notified_at', null);
    }
  }
  return result.success ? 'sent' : 'failed';
}

async function loadGuestAddedMessages(db: Db, immediateOnly: boolean): Promise<GuestCampaignMessage[]> {
  let q = db.from('campaign_messages').select(MESSAGE_SELECT).eq('is_active', true).eq('campaigns.trigger_type', GUEST_REGISTRATION_TRIGGER);
  if (immediateOnly) q = q.eq('timing_type', 'immediate');
  const { data, error } = await q;
  if (error) {
    console.error('[guest campaigns] could not load messages', error.message);
    return [];
  }
  return (data || []) as unknown as GuestCampaignMessage[];
}

/**
 * Active "Reservation moved" / "Reservation cancelled" messages to the guest
 * for a reservation's location. Empty on any error (nothing is sent).
 */
export async function loadGuestEventMessages(db: Db, trigger: string, locationId: string | null): Promise<EventCampaignMessage[]> {
  const { data, error } = await db
    .from('campaign_messages')
    .select(MESSAGE_SELECT)
    .eq('is_active', true)
    .in('recipient_type', [...GUEST_RECIPIENT_TYPES])
    .eq('campaigns.trigger_type', trigger);
  if (error) {
    console.error('[guest campaigns] could not load messages', trigger, error.message);
    return [];
  }
  return ((data || []) as unknown as GuestCampaignMessage[])
    .filter((m) => messageAppliesToGuestLocation(m, locationId, trigger))
    .map((m) => ({ id: m.id, content: m.content, active: true, recipient_type: m.recipient_type }));
}

/** One queued moved/cancelled message, re-read at send time (it may have been edited or turned off). */
export async function loadEventCampaignMessage(db: Db, id: string): Promise<EventCampaignMessage | null> {
  const { data } = await db.from('campaign_messages').select(MESSAGE_SELECT).eq('id', id).maybeSingle();
  if (!data) return null;
  const m = data as unknown as GuestCampaignMessage;
  return { id: m.id, content: m.content, active: m.is_active !== false && m.campaigns?.is_active !== false, recipient_type: m.recipient_type };
}

/**
 * Called as a guest is added: send every active "Send immediately"
 * Guest Registration message for the guest's location. Never throws.
 */
export async function sendGuestAddedCampaignMessages(
  guestId: string,
  deps: GuestDeps & { onlyMessageIds?: string[] } = {},
): Promise<{ outcomes: GuestCampaignOutcome[]; reason?: string }> {
  const { db, now } = resolve(deps);
  try {
    const ctx = await loadContext(db, guestId);
    if (!ctx) return { outcomes: [], reason: 'guest_not_found' };
    const locationId = ctx.reservation.location_id || ctx.guest.location_id;
    const all = (await loadGuestAddedMessages(db, false)).filter((m) => messageAppliesToGuestLocation(m, locationId));
    const tz = ctx.location?.timezone || DEFAULT_TIMEZONE;
    const immediate = all.filter((m) => m.timing_type === 'immediate');
    const catchUp = all.filter((m) => isLateCatchUp(m, ctx.reservation.start_time, now, tz));
    const pick = (list: GuestCampaignMessage[]) => list.filter((m) => !deps.onlyMessageIds || deps.onlyMessageIds.includes(m.id));
    const messages = pick(immediate);
    const late = pick(catchUp);
    if (messages.length === 0 && late.length === 0) return { outcomes: [], reason: 'no_matching_message' };

    const outcomes: GuestCampaignOutcome[] = [];
    // Added after a "before the reservation" text's time: it goes now. It
    // covers the intro, so the guest-facing intro is skipped (staff alerts
    // still go), as it is when the legacy built-in day-of text is on.
    for (const m of late) outcomes.push(await deliver(db, deps, m, ctx, now));
    const templates = await loadTemplates(db);
    const legacyDayOf = introCoveredByDayOf({ start: ctx.reservation.start_time, now, dayOfActive: activeKindsFrom(templates).has('day_of') });
    const isMember = !!ctx.guest.matched_member_id;
    const lateToGuest = catchUp.some((m) => guestRecipientMatches(m.recipient_type, isMember));
    if (legacyDayOf || lateToGuest) {
      for (const m of messages.filter((x) => !isGuestRecipient(x.recipient_type))) outcomes.push(await deliver(db, deps, m, ctx, now));
      return { outcomes, reason: 'intro_covered_by_day_of' };
    }
    for (const m of messages) outcomes.push(await deliver(db, deps, m, ctx, now));
    return { outcomes };
  } catch (err) {
    console.error('[guest campaigns] immediate send failed', guestId, err);
    return { outcomes: [], reason: 'error' };
  }
}

/**
 * A message timed minutes or hours before the reservation whose moment has
 * already passed, while the reservation is still ahead: a guest added late
 * gets it right away (the cron only looks back an hour).
 */
export function isLateCatchUp(message: GuestCampaignMessage, reservationStart: string, now: DateTime, timezone: string): boolean {
  if (!anchorsOnReservation(message) || message.relative_proximity !== 'before') return false;
  if (message.relative_unit !== 'minute' && message.relative_unit !== 'hour') return false;
  const start = DateTime.fromISO(reservationStart, { zone: 'utc' });
  if (!start.isValid || start <= now) return false;
  const target = guestAddedSendTime(message, now, timezone, reservationStart);
  return !!target && target <= now;
}

/**
 * Cron: send one delayed Guest Registration message to every guest whose
 * send time falls in the window now. Returns how many were sent.
 */
export async function processGuestAddedCampaignMessage(message: GuestCampaignMessage, deps: GuestDeps = {}): Promise<number> {
  const { db, now } = resolve(deps);
  if (message.timing_type === 'immediate') return 0; // sent as the guest is added
  if (message.campaigns?.is_active === false) return 0;

  // Which guests could be due now. Counted from the reservation: guests on
  // reservations starting in the matching window. Counted from when the guest
  // was added: guests added within the lookback.
  type Candidate = { id: string; location_id: string | null; created_at: string; reservation_start?: string | null };
  let candidates: Candidate[] = [];
  if (anchorsOnReservation(message)) {
    const offset = signedOffsetMinutes(message);
    // Offsets in minutes are approximate for calendar units (a month is 28–31
    // days, a year 365–366) and day+ units land on a clock time, so widen the
    // search; the exact send time is computed per guest below.
    const slack = ({ minute: 0, hour: 0, day: 1440, week: 1440, month: 5 * 1440, year: 3 * 1440 } as Record<string, number>)[message.relative_unit || 'day'] ?? 1440;
    const from = now.minus({ minutes: offset + WINDOW_PAST_MINUTES + 1 + slack }).toUTC().toISO()!;
    const to = now.minus({ minutes: offset - WINDOW_FUTURE_MINUTES - 1 - slack }).toUTC().toISO()!;
    const { data: resRows, error: resError } = await db
      .from('reservations')
      .select('id, start_time, status')
      .gte('start_time', from)
      .lte('start_time', to)
      .order('start_time', { ascending: true })
      .limit(2000);
    if (resError) {
      console.error('[guest campaigns] could not load reservations', resError.message);
      return 0;
    }
    if ((resRows || []).length >= 2000) console.warn('[guest campaigns] reservation window hit the 2000-row cap; some guests may be skipped', message.id);
    const live = ((resRows || []) as Array<{ id: string; start_time: string; status: string | null }>).filter((r) => r.status !== 'cancelled');
    if (live.length === 0) return 0;
    const startById = new Map(live.map((r) => [r.id, r.start_time]));
    const ids = [...startById.keys()];
    for (let i = 0; i < ids.length; i += 150) {
      const { data: guestRows, error: guestError } = await db
        .from('reservation_guests')
        .select('id, location_id, created_at, reservation_id')
        .eq('status', 'active')
        .in('reservation_id', ids.slice(i, i + 150));
      if (guestError) {
        console.error('[guest campaigns] could not load guests', guestError.message);
        return 0;
      }
      for (const g of (guestRows || []) as Array<Candidate & { reservation_id: string }>) {
        candidates.push({ ...g, reservation_start: startById.get(g.reservation_id) || null });
      }
    }
  } else {
    const since = now.minus({ minutes: lookbackMinutes(message) }).toUTC().toISO()!;
    const { data: guests, error } = await db
      .from('reservation_guests')
      .select('id, location_id, created_at')
      .eq('status', 'active')
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .limit(1000);
    if (error) {
      console.error('[guest campaigns] could not load guests', error.message);
      return 0;
    }
    candidates = (guests || []) as Candidate[];
  }

  const tzCache = new Map<string, string>();
  let sent = 0;
  for (const row of candidates) {
    if (!messageAppliesToGuestLocation(message, row.location_id)) continue;
    const locKey = row.location_id || '';
    if (!tzCache.has(locKey)) {
      const { data: loc } = row.location_id
        ? await db.from('locations').select('timezone').eq('id', row.location_id).maybeSingle()
        : { data: null };
      tzCache.set(locKey, (loc as { timezone?: string } | null)?.timezone || DEFAULT_TIMEZONE);
    }
    const target = guestAddedSendTime(message, DateTime.fromISO(row.created_at, { zone: 'utc' }), tzCache.get(locKey)!, row.reservation_start);
    if (!target) continue;
    const diff = target.diff(now, 'minutes').minutes;
    if (diff > WINDOW_FUTURE_MINUTES || diff < -WINDOW_PAST_MINUTES) continue;

    // Cheap pre-check before loading everything; the claim is the real guard.
    const { data: already } = await db
      .from('scheduled_messages')
      .select('id')
      .eq('campaign_message_id', message.id)
      .eq('reservation_guest_id', row.id)
      .in('status', ['pending', 'sent'])
      .limit(1);
    if (already && (already as unknown[]).length > 0) continue;

    const ctx = await loadContext(db, row.id);
    if (!ctx) continue;
    if ((await deliver(db, deps, message, ctx, target)) === 'sent') sent++;
  }
  return sent;
}

/**
 * Cron safety net for "Send immediately" Guest Registration texts, same rules
 * as retryImmediateReservationSends: stale claims are marked failed, failed
 * sends for guests added in the last RETRY_WINDOW_MINUTES are retried, at most
 * MAX_SEND_ATTEMPTS attempts per (message, guest). Delayed follow-ups retry
 * through the normal cron window under the same attempt cap.
 */
export async function retryImmediateGuestSends(deps: GuestDeps = {}): Promise<{ staleMarked: number; retried: number }> {
  const { db, now } = resolve(deps);
  const out = { staleMarked: 0, retried: 0 };
  try {
    const { data: stale } = await db
      .from('scheduled_messages')
      .update({ status: 'failed', error_message: 'Interrupted before the send finished' })
      .eq('status', 'pending')
      .not('reservation_guest_id', 'is', null)
      .is('sent_time', null)
      .lt('created_at', now.minus({ minutes: STALE_CLAIM_MINUTES }).toUTC().toISO()!)
      .select('id');
    out.staleMarked = ((stale as unknown[]) || []).length;

    const { data: failed } = await db
      .from('scheduled_messages')
      .select('campaign_message_id, reservation_guest_id')
      .eq('status', 'failed')
      .not('reservation_guest_id', 'is', null)
      .gte('created_at', now.minus({ minutes: RETRY_WINDOW_MINUTES }).toUTC().toISO()!);
    const attempts = new Map<string, { messageId: string; guestId: string; count: number }>();
    for (const row of (failed || []) as Array<{ campaign_message_id: string; reservation_guest_id: string }>) {
      const key = `${row.campaign_message_id}|${row.reservation_guest_id}`;
      const a = attempts.get(key) || { messageId: row.campaign_message_id, guestId: row.reservation_guest_id, count: 0 };
      a.count++;
      attempts.set(key, a);
    }
    const byGuest = new Map<string, string[]>();
    for (const a of attempts.values()) {
      if (a.count >= MAX_SEND_ATTEMPTS) continue;
      byGuest.set(a.guestId, [...(byGuest.get(a.guestId) || []), a.messageId]);
    }
    for (const [guestId, messageIds] of byGuest) {
      const r = await sendGuestAddedCampaignMessages(guestId, { ...deps, onlyMessageIds: messageIds });
      out.retried += r.outcomes.filter((o) => o === 'sent').length;
    }
  } catch (err) {
    console.error('[guest campaigns] retry pass failed', err);
  }
  return out;
}
