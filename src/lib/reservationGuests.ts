/**
 * Reservation guests: people a member brings on a reservation.
 *
 * One module every entry point calls — member portal, the no-login guest link,
 * staff (admin), the reschedule/cancel paths and the sending cron. "Guest" here
 * always means a reservation guest; the campaign engine's "guest" (any
 * non-member reservation phone) is a different thing and is never touched here.
 *
 * guestCampaigns.ts imports from this module, so this module loads it with
 * await import() inside functions to avoid a circular import at load time.
 *
 * Texts:
 *   intro + follow-ups  Campaigns, trigger "Guest Registration"
 *                 (src/lib/guestCampaigns.ts). The immediate intro always
 *                 goes when a guest is added; a "before the reservation" text
 *                 whose time has passed goes right after it.
 *   day of        a Guest Registration message timed from the reservation
 *                 ("Relative to: The reservation time"); a guest added after
 *                 that time but before the start gets it right away
 *   moved         Campaigns, trigger "Reservation moved": to guests already
 *                 texted, when the reservation's time changes
 *   cancelled     Campaigns, trigger "Reservation cancelled": to guests
 *                 already texted, when the reservation is cancelled
 *   member_link   to the host, from the staff "Text link to member" button
 * Moved and cancelled texts go through the guest queue
 * (scheduled_guest_messages, one row per guest and campaign message). The
 * legacy built-in day_of / time_changed / cancelled templates still work if
 * someone turns them back on, but they are off and no longer shown.
 * Nothing is ever sent to an opted-out contact or a guest who is already a
 * member.
 */
import { DateTime } from 'luxon';
import { guestRecipientMatches } from '@/lib/guestRecipients';
import { supabaseAdmin } from '@/lib/supabase';
import { sendSMS } from '@/lib/sms';
import { last10, maskPhone, toE164, formatPhoneDisplay } from '@/lib/phone';

/** Built-in texts queued to guests. */
export const GUEST_KINDS = ['day_of', 'time_changed', 'cancelled'] as const;
export type GuestMessageKind = (typeof GUEST_KINDS)[number];
/** Every editable built-in template, including the host's guest-link text. */
export const TEMPLATE_KINDS = ['day_of', 'time_changed', 'cancelled', 'member_link'] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];
export type AddedVia = 'portal' | 'guest_link' | 'staff';

export const DEFAULT_DAY_OF_OFFSET_MINUTES = 120;
/** If the reservation starts within this window (and day_of is on), the immediate campaign intro is skipped. */
export const INTRO_SKIP_WINDOW_MINUTES = 120;
export { DEFAULT_TIMEZONE, DEFAULT_ARRIVAL_INSTRUCTIONS } from '@/lib/guestMessageRender';
import { DEFAULT_TIMEZONE, renderGuestMessage } from '@/lib/guestMessageRender';
import { isCapacityError } from '@/lib/capacity';
export const SENT_BY_SYSTEM = 'system:guests';
const MAX_NAME_LENGTH = 60;

type Db = typeof supabaseAdmin;

/** Same ceiling as reservation booking (validations.ts). */
export const MAX_PARTY_SIZE = 20;
type SendFn = typeof sendSMS;

export interface GuestDeps {
  db?: Db;
  send?: SendFn;
  now?: () => DateTime;
}

function resolve(deps: GuestDeps = {}) {
  return {
    db: deps.db ?? supabaseAdmin,
    send: deps.send ?? sendSMS,
    now: (deps.now ?? (() => DateTime.utc()))(),
  };
}

export class GuestServiceError extends Error {
  constructor(public code: string, message: string, public status = 400, public rowErrors?: RowError[]) {
    super(message);
    this.name = 'GuestServiceError';
  }
}

export interface GuestInput {
  first_name: string;
  last_name?: string | null;
  phone: string;
}

export interface RowError {
  index: number;
  field?: 'first_name' | 'phone' | 'last_name';
  error: string;
}

interface ReservationRow {
  id: string;
  status: string | null;
  start_time: string;
  end_time: string | null;
  party_size: number;
  phone: string | null;
  first_name: string | null;
  last_name?: string | null;
  member_id: string | null;
  location_id: string | null;
}

interface ContactRow {
  id: string;
  phone: string;
  first_name: string;
  last_name: string | null;
  sms_opted_out_at: string | null;
}

interface GuestRow {
  id: string;
  reservation_id: string;
  guest_contact_id: string;
  location_id: string | null;
  added_by_member_id: string | null;
  added_via: AddedVia;
  first_name_snapshot: string | null;
  matched_member_id: string | null;
  status: 'active' | 'removed';
  checked_in_at: string | null;
  notified_at: string | null;
  followed_up_at?: string | null;
  followed_up_by?: string | null;
  follow_up_note?: string | null;
  created_at?: string;
  guest_contacts?: ContactRow | null;
}

export interface TemplateRow {
  kind: TemplateKind;
  body: string;
  is_active: boolean;
  send_offset_minutes: number | null;
}

interface LocationRow {
  id: string;
  name: string | null;
  timezone: string | null;
  guest_arrival_instructions?: string | null;
  address?: string | null;
  parking_instructions?: string | null;
}

const RESERVATION_COLUMNS = 'id, status, start_time, end_time, party_size, phone, first_name, last_name, member_id, location_id';
const GUEST_COLUMNS =
  'id, reservation_id, guest_contact_id, location_id, added_by_member_id, added_via, first_name_snapshot, matched_member_id, status, checked_in_at, notified_at, followed_up_at, followed_up_by, follow_up_note, created_at, guest_contacts(id, phone, first_name, last_name, sms_opted_out_at)';

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function isReservationClosed(r: Pick<ReservationRow, 'status' | 'start_time' | 'end_time'>, now: DateTime): string | null {
  if (r.status === 'cancelled') return 'reservation_cancelled';
  const end = DateTime.fromISO(r.end_time || r.start_time, { zone: 'utc' });
  if (end.isValid && end <= now) return 'reservation_ended';
  return null;
}

export interface PlannedMessage {
  kind: GuestMessageKind;
  scheduledFor: DateTime;
}

/**
 * When a new guest's built-in texts go out: `day_of` at start − offset in the
 * venue timezone, or now if that moment has passed (and the start hasn't).
 */
export function planGuestMessages(args: {
  start: string;
  now: DateTime;
  timezone?: string | null;
  dayOfOffsetMinutes?: number | null;
  activeKinds?: Set<GuestMessageKind>;
}): PlannedMessage[] {
  const tz = args.timezone || DEFAULT_TIMEZONE;
  const now = args.now.setZone(tz);
  const start = DateTime.fromISO(args.start, { zone: 'utc' }).setZone(tz);
  const active = args.activeKinds ?? new Set<GuestMessageKind>(GUEST_KINDS);
  if (!start.isValid || start <= now || !active.has('day_of')) return [];
  const dayOfAt = start.minus({ minutes: args.dayOfOffsetMinutes ?? DEFAULT_DAY_OF_OFFSET_MINUTES });
  return [{ kind: 'day_of', scheduledFor: dayOfAt <= now ? now : dayOfAt }];
}

/**
 * True when the immediate campaign intro should be skipped: the reservation
 * starts within 2 hours and the day-of text is on (it goes out right away).
 */
export function introCoveredByDayOf(args: { start: string; now: DateTime; dayOfActive: boolean }): boolean {
  if (!args.dayOfActive) return false;
  const start = DateTime.fromISO(args.start, { zone: 'utc' });
  if (!start.isValid) return false;
  const minutes = start.diff(args.now, 'minutes').minutes;
  return minutes > 0 && minutes <= INTRO_SKIP_WINDOW_MINUTES;
}

export { renderGuestMessage, type RenderContext } from '@/lib/guestMessageRender';

function cleanName(raw: unknown): string {
  return String(raw ?? '').replace(/\s+/g, ' ').trim();
}

export interface GuestViewForMember {
  id: string;
  first_name: string;
  last_name: string | null;
  phone_masked: string;
}

export interface GuestViewForStaff extends GuestViewForMember {
  phone: string;
  phone_display: string;
  is_member: boolean;
  opted_out: boolean;
  checked_in_at: string | null;
  notified_at: string | null;
  added_via: AddedVia;
}

function toMemberView(g: GuestRow): GuestViewForMember {
  return {
    id: g.id,
    first_name: g.first_name_snapshot || g.guest_contacts?.first_name || '',
    last_name: g.guest_contacts?.last_name ?? null,
    phone_masked: maskPhone(g.guest_contacts?.phone),
  };
}

function toStaffView(g: GuestRow): GuestViewForStaff {
  return {
    ...toMemberView(g),
    phone: g.guest_contacts?.phone || '',
    phone_display: formatPhoneDisplay(g.guest_contacts?.phone),
    is_member: !!g.matched_member_id,
    opted_out: !!g.guest_contacts?.sms_opted_out_at,
    checked_in_at: g.checked_in_at,
    notified_at: g.notified_at,
    added_via: g.added_via,
  };
}

// ---------------------------------------------------------------------------
// Data access
// ---------------------------------------------------------------------------

async function loadReservation(db: Db, reservationId: string): Promise<ReservationRow> {
  const { data, error } = await db.from('reservations').select(RESERVATION_COLUMNS).eq('id', reservationId).single();
  if (error || !data) throw new GuestServiceError('reservation_not_found', 'Reservation not found.', 404);
  return data as ReservationRow;
}

async function loadActiveGuests(db: Db, reservationId: string): Promise<GuestRow[]> {
  const { data, error } = await db
    .from('reservation_guests')
    .select(GUEST_COLUMNS)
    .eq('reservation_id', reservationId)
    .eq('status', 'active')
    .order('created_at', { ascending: true });
  if (error) throw new GuestServiceError('load_failed', 'Could not load guests.', 500);
  return (data || []) as unknown as GuestRow[];
}

export async function loadTemplates(db: Db): Promise<Map<TemplateKind, TemplateRow>> {
  const { data } = await db.from('guest_message_templates').select('kind, body, is_active, send_offset_minutes');
  const map = new Map<TemplateKind, TemplateRow>();
  ((data || []) as TemplateRow[]).forEach((t) => map.set(t.kind, t));
  return map;
}

export function activeKindsFrom(templates: Map<TemplateKind, TemplateRow>): Set<GuestMessageKind> {
  // A missing template row counts as active so the seeded defaults apply even
  // if someone deleted a row; the sender skips it with a reason.
  return new Set(GUEST_KINDS.filter((k) => templates.get(k)?.is_active !== false));
}

async function loadLocation(db: Db, locationId: string | null): Promise<LocationRow | null> {
  if (!locationId) return null;
  const { data } = await db
    .from('locations')
    .select('id, name, timezone, guest_arrival_instructions, address, parking_instructions')
    .eq('id', locationId)
    .maybeSingle();
  return (data as LocationRow) || null;
}

/** Find a member by the last 10 digits of a phone, tolerant of stored formats. */
export async function findMemberIdByPhone(db: Db, phone: string): Promise<string | null> {
  const ten = last10(phone);
  if (!ten) return null;
  const { data } = await db
    .from('members')
    .select('member_id, phone, status')
    .ilike('phone', `%${ten.slice(-4)}`)
    .limit(50);
  const matches = ((data || []) as Array<{ member_id: string; phone: string | null; status: string | null }>).filter(
    (m) => last10(m.phone) === ten,
  );
  if (matches.length === 0) return null;
  const preferred = matches.find((m) => m.status === 'active') || matches[0];
  return preferred.member_id;
}

async function hostPhones(db: Db, reservation: ReservationRow): Promise<Set<string>> {
  const set = new Set<string>();
  const r10 = last10(reservation.phone);
  if (r10) set.add(r10);
  if (reservation.member_id) {
    const { data } = await db.from('members').select('phone').eq('member_id', reservation.member_id).maybeSingle();
    const m10 = last10((data as { phone?: string | null } | null)?.phone);
    if (m10) set.add(m10);
  }
  return set;
}

export interface HostName {
  first: string;
  last: string;
}

/** The host's name: the name on the reservation, else the member's. */
async function hostName(db: Db, reservation: ReservationRow): Promise<HostName> {
  const first = (reservation.first_name || '').trim();
  if (first) return { first, last: (reservation.last_name || '').trim() };
  if (reservation.member_id) {
    const { data } = await db.from('members').select('first_name, last_name').eq('member_id', reservation.member_id).maybeSingle();
    const m = (data as { first_name?: string | null; last_name?: string | null } | null) || {};
    if ((m.first_name || '').trim()) return { first: (m.first_name || '').trim(), last: (m.last_name || '').trim() };
  }
  return { first: 'your host', last: '' };
}

async function upsertContact(
  db: Db,
  input: { phone: string; first_name: string; last_name: string | null },
  via: AddedVia,
): Promise<ContactRow> {
  const select = 'id, phone, first_name, last_name, sms_opted_out_at';
  const { data: existing } = await db.from('guest_contacts').select(select).eq('phone', input.phone).maybeSingle();
  if (existing) {
    const contact = existing as ContactRow;
    // Names on an existing contact change only when staff edit them; never
    // blank out a known last name.
    if (via === 'staff') {
      const patch: Record<string, string | null> = { first_name: input.first_name };
      if (input.last_name) patch.last_name = input.last_name;
      await db.from('guest_contacts').update(patch).eq('id', contact.id);
      return { ...contact, ...patch } as ContactRow;
    }
    if (!contact.last_name && input.last_name) {
      await db.from('guest_contacts').update({ last_name: input.last_name }).eq('id', contact.id);
      return { ...contact, last_name: input.last_name };
    }
    return contact;
  }
  const { data: created, error } = await db
    .from('guest_contacts')
    .insert({ phone: input.phone, first_name: input.first_name, last_name: input.last_name })
    .select(select)
    .single();
  if (error?.code === '23505') {
    const { data: raced } = await db.from('guest_contacts').select(select).eq('phone', input.phone).single();
    if (raced) return raced as ContactRow;
  }
  if (error || !created) throw new GuestServiceError('save_failed', 'Could not save guest.', 500);
  return created as ContactRow;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function listGuests(
  reservationId: string,
  audience: 'member',
  deps?: GuestDeps,
): Promise<GuestViewForMember[]>;
export async function listGuests(
  reservationId: string,
  audience: 'staff',
  deps?: GuestDeps,
): Promise<GuestViewForStaff[]>;
export async function listGuests(reservationId: string, audience: 'member' | 'staff', deps: GuestDeps = {}) {
  const { db } = resolve(deps);
  const guests = await loadActiveGuests(db, reservationId);
  return audience === 'staff' ? guests.map(toStaffView) : guests.map(toMemberView);
}

/**
 * Validate and add guests to a reservation. All or nothing: if any row is
 * invalid, nothing is saved and every row's problem is returned.
 */
export async function addGuests(
  reservationId: string,
  guests: GuestInput[],
  opts: { via: AddedVia; actorMemberId?: string | null; growParty?: boolean },
  deps: GuestDeps = {},
): Promise<GuestViewForStaff[]> {
  const { db, now, send } = resolve(deps);
  if (!Array.isArray(guests) || guests.length === 0) {
    throw new GuestServiceError('no_guests', 'Add at least one guest.');
  }
  if (guests.length > 50) throw new GuestServiceError('too_many', 'Too many guests at once.');

  const reservation = await loadReservation(db, reservationId);
  const closed = isReservationClosed(reservation, now);
  if (closed === 'reservation_cancelled') throw new GuestServiceError(closed, 'This reservation was cancelled.', 409);
  if (closed === 'reservation_ended') throw new GuestServiceError(closed, 'This reservation has already ended.', 409);

  const [existing, hosts] = await Promise.all([loadActiveGuests(db, reservationId), hostPhones(db, reservation)]);
  const taken = new Set(existing.map((g) => last10(g.guest_contacts?.phone)).filter(Boolean) as string[]);

  const rowErrors: RowError[] = [];
  const clean: Array<{ phone: string; first_name: string; last_name: string | null }> = [];
  guests.forEach((g, index) => {
    const first = cleanName(g?.first_name);
    const last = cleanName(g?.last_name) || null;
    const phone = toE164(g?.phone);
    if (!first) rowErrors.push({ index, field: 'first_name', error: 'First name is required.' });
    else if (first.length > MAX_NAME_LENGTH) rowErrors.push({ index, field: 'first_name', error: 'First name is too long.' });
    if (last && last.length > MAX_NAME_LENGTH) rowErrors.push({ index, field: 'last_name', error: 'Last name is too long.' });
    if (!phone) {
      rowErrors.push({ index, field: 'phone', error: 'Enter a valid mobile number.' });
      return;
    }
    const ten = last10(phone)!;
    if (hosts.has(ten)) {
      rowErrors.push({ index, field: 'phone', error: "That's the host's own number." });
      return;
    }
    if (taken.has(ten)) {
      rowErrors.push({ index, field: 'phone', error: 'This person is already on the reservation.' });
      return;
    }
    taken.add(ten);
    if (first && first.length <= MAX_NAME_LENGTH) clean.push({ phone, first_name: first, last_name: last });
  });

  if (rowErrors.length > 0) {
    throw new GuestServiceError('invalid_rows', 'Some guests need fixing.', 400, rowErrors);
  }

  const cap = Math.max(0, (reservation.party_size || 1) - 1);
  let grewFrom: number | null = null;
  if (existing.length + clean.length > cap && opts.growParty) {
    // Raise the party size to fit. The location capacity trigger decides
    // whether there's room at that time.
    const newSize = existing.length + clean.length + 1;
    if (newSize > MAX_PARTY_SIZE) {
      throw new GuestServiceError('over_max_party', `A reservation can be for up to ${MAX_PARTY_SIZE} people. Contact us for a larger group.`, 400);
    }
    const before = reservation.party_size || 1;
    // Guarded on the size we read, so a concurrent edit or add isn't overwritten.
    const { data: grown, error: growError } = await db
      .from('reservations')
      .update({ party_size: newSize })
      .eq('id', reservation.id)
      .eq('party_size', before)
      .select('id');
    if (growError) {
      if (isCapacityError(growError)) {
        throw new GuestServiceError(
          'capacity_exceeded',
          "We don't have room to add more people at that time. Reply to our text and we'll see what we can do.",
          409,
        );
      }
      throw new GuestServiceError('save_failed', 'Could not update the party size.', 500);
    }
    if (!grown || (grown as unknown[]).length === 0) {
      throw new GuestServiceError('reservation_changed', 'The reservation just changed. Please try again.', 409);
    }
    grewFrom = before;
    reservation.party_size = newSize;
  } else if (existing.length + clean.length > cap) {
    const room = Math.max(0, cap - existing.length);
    throw new GuestServiceError(
      'over_party_size',
      room === 0
        ? `Your party size is ${reservation.party_size}, so there's no room for more guests. Raise the party size on the reservation first.`
        : `Your party size is ${reservation.party_size}, so you can add ${room} more guest${room === 1 ? '' : 's'}. Raise the party size on the reservation to add more.`,
      400,
    );
  }

  const created: GuestRow[] = [];
  const createdNames: string[] = [];
  try {
    for (const g of clean) {
      const contact = await upsertContact(db, g, opts.via);
      const matched = await findMemberIdByPhone(db, contact.phone);
      const { data: row, error } = await db
        .from('reservation_guests')
        .insert({
          reservation_id: reservation.id,
          guest_contact_id: contact.id,
          location_id: reservation.location_id,
          added_by_member_id: opts.actorMemberId ?? null,
          host_member_id: reservation.member_id,
          added_via: opts.via,
          first_name_snapshot: g.first_name,
          matched_member_id: matched,
          status: 'active',
        })
        .select('id')
        .single();
      if (error?.code === '23505') continue; // added concurrently — already on the reservation
      if (error || !row) throw new GuestServiceError('save_failed', 'Could not save guest.', 500);
      created.push({ id: (row as { id: string }).id } as GuestRow);
      createdNames.push(g.first_name);
    }
  } catch (err) {
    // Any failure mid-loop (contact upsert, member lookup, insert): don't leave the party inflated.
    await shrinkGrownParty(db, reservation.id, grewFrom, reservation.party_size, existing.length + created.length);
    throw err;
  }
  // Everyone was already on it (added concurrently): don't keep the bigger party.
  const finalSize = await shrinkGrownParty(db, reservation.id, grewFrom, reservation.party_size, existing.length + created.length);
  if (grewFrom !== null && finalSize > grewFrom && created.length > 0) {
    await alertStaffPartyGrew(db, send, reservation, grewFrom, finalSize, createdNames, opts.via);
  }

  // Built-in day-of text, then the "Guest Registration" campaign intro.
  // (Imported lazily: guestCampaigns builds on this module.)
  const { sendGuestAddedCampaignMessages } = await import('@/lib/guestCampaigns');
  for (const g of created) {
    await scheduleGuestMessages(g.id, deps);
    await sendGuestAddedCampaignMessages(g.id, deps);
  }

  return listGuests(reservation.id, 'staff', deps);
}

/**
 * After addGuests raised the party size, bring it back down to fit the guests
 * actually saved (never below where it started). Guarded on the size we set,
 * so a later edit by someone else is left alone.
 */
async function shrinkGrownParty(db: Db, reservationId: string, grewFrom: number | null, grownTo: number | null, guestCount: number): Promise<number> {
  if (grewFrom === null || !grownTo) return grownTo || 0;
  const fit = Math.max(grewFrom, guestCount + 1);
  if (fit >= grownTo) return grownTo;
  const { error } = await db.from('reservations').update({ party_size: fit }).eq('id', reservationId).eq('party_size', grownTo);
  if (error) {
    console.error('[reservation guests] could not shrink party size back after a failed add', reservationId, error.message);
    return grownTo;
  }
  return fit;
}

/**
 * Text staff right away when an add raised the party size. Goes to the
 * location's admin notification phone, else the one in Settings (the same
 * number reservation alerts use). Never throws: the guest is already added.
 */
async function alertStaffPartyGrew(
  db: Db,
  send: SendFn,
  reservation: ReservationRow,
  from: number,
  to: number,
  addedNames: string[],
  via: AddedVia,
): Promise<void> {
  try {
    const { data: loc } = reservation.location_id
      ? await db.from('locations').select('name, timezone, admin_notification_phone').eq('id', reservation.location_id).maybeSingle()
      : { data: null };
    const location = loc as { name?: string | null; timezone?: string | null; admin_notification_phone?: string | null } | null;
    let phone = (location?.admin_notification_phone || '').trim();
    if (!phone) {
      const { data: settings } = await db.from('settings').select('admin_notification_phone').limit(1).maybeSingle();
      phone = ((settings as { admin_notification_phone?: string | null } | null)?.admin_notification_phone || '').trim();
    }
    if (!phone) {
      console.warn('[reservation guests] party grew but no admin notification phone is set', reservation.id);
      return;
    }
    const to164 = toE164(phone) || phone;
    const host = await hostName(db, reservation);
    const hostLabel = [host.first, host.last ? `${host.last.charAt(0)}.` : ''].filter(Boolean).join(' ');
    const when = DateTime.fromISO(reservation.start_time, { zone: 'utc' })
      .setZone(location?.timezone || DEFAULT_TIMEZONE)
      .toFormat('ccc L/d h:mm a');
    const how = via === 'guest_link' ? 'guest link' : via === 'portal' ? 'member portal' : 'staff';
    const content =
      `Noir: party grew from ${from} to ${to} for ${hostLabel}, ${when}${location?.name ? `, ${location.name}` : ''}. ` +
      `Added via ${how}: ${addedNames.join(', ')}. Please make room.`;
    const result = await send({ to: to164, content });
    if (!result.success) console.error('[reservation guests] party-grew alert failed', reservation.id, result.error);
  } catch (err) {
    console.error('[reservation guests] party-grew alert failed', reservation.id, err);
  }
}

export async function removeGuest(reservationId: string, guestId: string, deps: GuestDeps = {}): Promise<void> {
  const { db } = resolve(deps);
  const { data, error } = await db
    .from('reservation_guests')
    .update({ status: 'removed' })
    .eq('id', guestId)
    .eq('reservation_id', reservationId)
    .eq('status', 'active')
    .select('id');
  if (error) throw new GuestServiceError('save_failed', 'Could not remove guest.', 500);
  if (!data || (data as unknown[]).length === 0) throw new GuestServiceError('guest_not_found', 'Guest not found.', 404);
  await cancelPendingForGuests(db, [guestId]);
}

/** Name only. A phone change is remove + add. */
export async function updateGuest(
  reservationId: string,
  guestId: string,
  patch: { first_name?: string; last_name?: string | null },
  opts: { via: AddedVia },
  deps: GuestDeps = {},
): Promise<GuestViewForStaff> {
  const { db } = resolve(deps);
  const { data: guest } = await db
    .from('reservation_guests')
    .select(GUEST_COLUMNS)
    .eq('id', guestId)
    .eq('reservation_id', reservationId)
    .eq('status', 'active')
    .maybeSingle();
  if (!guest) throw new GuestServiceError('guest_not_found', 'Guest not found.', 404);
  const g = guest as unknown as GuestRow;

  const first = patch.first_name !== undefined ? cleanName(patch.first_name) : undefined;
  const last = patch.last_name !== undefined ? cleanName(patch.last_name) || null : undefined;
  if (first !== undefined && (!first || first.length > MAX_NAME_LENGTH)) {
    throw new GuestServiceError('invalid_rows', 'First name is required.', 400, [{ index: 0, field: 'first_name', error: 'First name is required.' }]);
  }
  if (last && last.length > MAX_NAME_LENGTH) {
    throw new GuestServiceError('invalid_rows', 'Last name is too long.', 400, [{ index: 0, field: 'last_name', error: 'Last name is too long.' }]);
  }

  if (first !== undefined) {
    await db.from('reservation_guests').update({ first_name_snapshot: first }).eq('id', guestId);
  }
  if (opts.via === 'staff' && g.guest_contacts) {
    const contactPatch: Record<string, string | null> = {};
    if (first !== undefined) contactPatch.first_name = first;
    if (last !== undefined) contactPatch.last_name = last;
    if (Object.keys(contactPatch).length) await db.from('guest_contacts').update(contactPatch).eq('id', g.guest_contact_id);
  } else if (last && g.guest_contacts && !g.guest_contacts.last_name) {
    await db.from('guest_contacts').update({ last_name: last }).eq('id', g.guest_contact_id);
  }

  const all = await listGuests(reservationId, 'staff', deps);
  const updated = all.find((x) => x.id === guestId);
  if (!updated) throw new GuestServiceError('guest_not_found', 'Guest not found.', 404);
  return updated;
}

export async function setGuestCheckedIn(reservationId: string, guestId: string, checkedIn: boolean, deps: GuestDeps = {}): Promise<void> {
  const { db, now } = resolve(deps);
  const { data, error } = await db
    .from('reservation_guests')
    .update({ checked_in_at: checkedIn ? now.toISO() : null })
    .eq('id', guestId)
    .eq('reservation_id', reservationId)
    .select('id');
  if (error) throw new GuestServiceError('save_failed', 'Could not update check-in.', 500);
  if (!data || (data as unknown[]).length === 0) throw new GuestServiceError('guest_not_found', 'Guest not found.', 404);
}

export async function countActiveGuests(reservationId: string, deps: GuestDeps = {}): Promise<number> {
  const { db } = resolve(deps);
  const { data, error } = await db
    .from('reservation_guests')
    .select('id')
    .eq('reservation_id', reservationId)
    .eq('status', 'active');
  if (error) {
    // Table not there yet (migration not applied): no guests.
    return 0;
  }
  return (data || []).length;
}

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------

async function insertPending(db: Db, guestId: string, kind: GuestMessageKind, at: DateTime, campaignMessageId: string | null = null): Promise<void> {
  const { error } = await db
    .from('scheduled_guest_messages')
    .insert({ reservation_guest_id: guestId, kind, scheduled_for: at.toUTC().toISO(), status: 'pending', campaign_message_id: campaignMessageId });
  if (error?.code === '23505') {
    let q = db
      .from('scheduled_guest_messages')
      .update({ scheduled_for: at.toUTC().toISO() })
      .eq('reservation_guest_id', guestId)
      .eq('kind', kind)
      .eq('status', 'pending');
    q = campaignMessageId ? q.eq('campaign_message_id', campaignMessageId) : q.is('campaign_message_id', null);
    await q;
  } else if (error) {
    console.error('[reservation guests] could not schedule', kind, guestId, error.message);
  }
}

async function cancelPendingForGuests(db: Db, guestIds: string[], kinds?: GuestMessageKind[], reason = 'cancelled'): Promise<void> {
  if (guestIds.length === 0) return;
  let q = db
    .from('scheduled_guest_messages')
    .update({ status: 'cancelled', skip_reason: reason })
    .in('reservation_guest_id', guestIds)
    .eq('status', 'pending');
  if (kinds) q = q.in('kind', kinds);
  await q;
}

function guestIsTextable(g: GuestRow): boolean {
  return g.status === 'active' && !g.guest_contacts?.sms_opted_out_at;
}

/** Queue a new guest's texts (see planGuestMessages). */
export async function scheduleGuestMessages(reservationGuestId: string, deps: GuestDeps = {}): Promise<void> {
  const { db, now } = resolve(deps);
  const { data: guest } = await db.from('reservation_guests').select(GUEST_COLUMNS).eq('id', reservationGuestId).maybeSingle();
  if (!guest) return;
  const g = guest as unknown as GuestRow;
  if (!guestIsTextable(g)) return;

  const reservation = await loadReservation(db, g.reservation_id);
  if (isReservationClosed(reservation, now)) return;
  const [templates, location] = await Promise.all([loadTemplates(db), loadLocation(db, reservation.location_id)]);
  const plan = planGuestMessages({
    start: reservation.start_time,
    now,
    timezone: location?.timezone,
    dayOfOffsetMinutes: templates.get('day_of')?.send_offset_minutes,
    activeKinds: activeKindsFrom(templates),
  });
  for (const p of plan) await insertPending(db, g.id, p.kind, p.scheduledFor);
}

/**
 * The reservation's start time changed. Not-yet-texted guests get their plan
 * recomputed; guests already texted get `time_changed` now and a fresh day_of
 * only if its time is still ahead.
 */
export async function onReservationRescheduled(reservationId: string, deps: GuestDeps = {}): Promise<void> {
  const { db, now } = resolve(deps);
  try {
    const reservation = await loadReservation(db, reservationId);
    if (isReservationClosed(reservation, now)) return;
    const guests = (await loadActiveGuests(db, reservationId)).filter(guestIsTextable);
    if (guests.length === 0) return;
    const [templates, location] = await Promise.all([loadTemplates(db), loadLocation(db, reservation.location_id)]);
    const active = activeKindsFrom(templates);
    const tz = location?.timezone || DEFAULT_TIMEZONE;
    const start = DateTime.fromISO(reservation.start_time, { zone: 'utc' }).setZone(tz);
    const offset = templates.get('day_of')?.send_offset_minutes ?? DEFAULT_DAY_OF_OFFSET_MINUTES;
    const dayOfAt = start.minus({ minutes: offset });

    const { loadGuestEventMessages, RESERVATION_MOVED_TRIGGER } = await import('@/lib/guestCampaigns');
    const moved = await loadGuestEventMessages(db, RESERVATION_MOVED_TRIGGER, reservation.location_id);

    for (const g of guests) {
      if (!g.notified_at) {
        await cancelPendingForGuests(db, [g.id], undefined, 'rescheduled');
        const plan = planGuestMessages({ start: reservation.start_time, now, timezone: tz, dayOfOffsetMinutes: offset, activeKinds: active });
        for (const p of plan) await insertPending(db, g.id, p.kind, p.scheduledFor);
        continue;
      }
      await cancelPendingForGuests(db, [g.id], ['day_of', 'time_changed'], 'rescheduled');
      // "Reservation moved" campaign messages (legacy built-in only if someone turned it back on).
      for (const m of moved) await insertPending(db, g.id, 'time_changed', now, m.id);
      if (active.has('time_changed')) await insertPending(db, g.id, 'time_changed', now);
      if (active.has('day_of') && dayOfAt > now) await insertPending(db, g.id, 'day_of', dayOfAt);
    }
  } catch (err) {
    console.error('[reservation guests] onReservationRescheduled failed', reservationId, err);
  }
}

/**
 * The reservation was cancelled. Cancel everything pending; guests already
 * texted get `cancelled`. With `sendNow` (the reservation is about to be
 * deleted, which cascades the queue away) the cancelled texts are sent inline.
 */
export async function onReservationCancelled(
  reservationId: string,
  opts: { sendNow?: boolean } = {},
  deps: GuestDeps = {},
): Promise<void> {
  const { db, now } = resolve(deps);
  try {
    const guests = await loadActiveGuests(db, reservationId);
    if (guests.length === 0) return;
    await cancelPendingForGuests(db, guests.map((g) => g.id), undefined, 'reservation_cancelled');
    const toTell = guests.filter((g) => g.notified_at && guestIsTextable(g));
    if (toTell.length === 0) return;

    const reservation = await loadReservation(db, reservationId);
    const templates = await loadTemplates(db);
    const { loadGuestEventMessages, RESERVATION_CANCELLED_TRIGGER } = await import('@/lib/guestCampaigns');
    const messages = await loadGuestEventMessages(db, RESERVATION_CANCELLED_TRIGGER, reservation.location_id);
    // "Reservation cancelled" campaign messages, plus the legacy built-in only if someone turned it back on.
    const sends: Array<EventCampaignMessage | null> = [...messages];
    if (templates.get('cancelled')?.is_active === true) sends.push(null);
    if (sends.length === 0) return;

    if (!opts.sendNow) {
      for (const g of toTell) for (const m of sends) await insertPending(db, g.id, 'cancelled', now, m?.id ?? null);
      return;
    }
    const [location, host] = await Promise.all([loadLocation(db, reservation.location_id), hostName(db, reservation)]);
    for (const g of toTell) {
      for (const m of sends) {
        await deliver(db, deps, {
          kind: 'cancelled',
          guest: g,
          reservation,
          location,
          host,
          template: m ? null : templates.get('cancelled') || null,
          campaignMessage: m,
        });
      }
    }
  } catch (err) {
    console.error('[reservation guests] onReservationCancelled failed', reservationId, err);
  }
}

// ---------------------------------------------------------------------------
// Opt-out
// ---------------------------------------------------------------------------

export const OPT_OUT_KEYWORDS = ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'];
export const OPT_IN_KEYWORDS = ['START', 'UNSTOP'];

export function classifyOptKeyword(text: string | null | undefined): 'opt_out' | 'opt_in' | null {
  const word = String(text ?? '')
    .trim()
    .replace(/[.!\s]+$/g, '')
    .toUpperCase();
  if (OPT_OUT_KEYWORDS.includes(word)) return 'opt_out';
  if (OPT_IN_KEYWORDS.includes(word)) return 'opt_in';
  return null;
}

/**
 * Opt a guest contact out of every guest text: mark the phone opted out and
 * cancel anything already queued for any reservation that phone is on.
 * Campaign texts re-check the opt-out at send time, so they stop too.
 */
async function optOutContact(db: Db, contactId: string, now: DateTime): Promise<void> {
  const { error } = await db.from('guest_contacts').update({ sms_opted_out_at: now.toISO() }).eq('id', contactId);
  if (error) throw new GuestServiceError('save_failed', 'Could not stop texts.', 500);
  const { data: guestRows, error: listError } = await db.from('reservation_guests').select('id').eq('guest_contact_id', contactId);
  if (listError) console.error('[reservation guests] opt-out: could not list guest rows; sends still re-check the opt-out', listError.message);
  await cancelPendingForGuests(db, ((guestRows || []) as Array<{ id: string }>).map((r) => r.id), undefined, 'opted_out');
}

/**
 * Staff "Stop texts" switch: stops every queued and future guest text to this
 * guest's phone, the same as the guest texting STOP. One way only: staff can't
 * turn texts back on, because a guest's own STOP must not be overridden. The
 * guest can resume by texting START.
 */
export async function stopGuestTexts(reservationId: string, guestId: string, deps: GuestDeps = {}): Promise<void> {
  const { db, now } = resolve(deps);
  const { data, error } = await db
    .from('reservation_guests')
    .select('id, guest_contact_id')
    .eq('id', guestId)
    .eq('reservation_id', reservationId)
    .maybeSingle();
  if (error) throw new GuestServiceError('save_failed', 'Could not stop texts.', 500);
  if (!data) throw new GuestServiceError('guest_not_found', 'Guest not found.', 404);
  await optOutContact(db, (data as { guest_contact_id: string }).guest_contact_id, now);
}

/**
 * Apply STOP / START from an inbound text to the guest contact with that phone,
 * if there is one. Returns what happened; never throws.
 */
export async function handleGuestOptKeyword(
  fromPhone: string,
  text: string,
  deps: GuestDeps = {},
): Promise<'opted_out' | 'opted_in' | 'no_contact' | 'not_keyword'> {
  const kind = classifyOptKeyword(text);
  if (!kind) return 'not_keyword';
  const { db, now } = resolve(deps);
  try {
    const phone = toE164(fromPhone);
    if (!phone) return 'no_contact';
    const { data: contact } = await db.from('guest_contacts').select('id').eq('phone', phone).maybeSingle();
    if (!contact) return 'no_contact';
    const contactId = (contact as { id: string }).id;
    if (kind === 'opt_in') {
      await db.from('guest_contacts').update({ sms_opted_out_at: null }).eq('id', contactId);
      return 'opted_in';
    }
    await optOutContact(db, contactId, now);
    return 'opted_out';
  } catch (err) {
    console.error('[reservation guests] opt keyword handling failed', err);
    return 'no_contact';
  }
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

async function logGuestMessage(
  db: Db,
  row: { phone: string; content: string; reservationId: string; sentBy: string; ok: boolean; error?: string; messageId?: string },
  now: DateTime,
): Promise<void> {
  const { error } = await db.from('guest_messages').insert({
    phone: row.phone,
    content: row.content,
    reservation_id: row.reservationId,
    sent_by: row.sentBy,
    status: row.ok ? 'sent' : 'failed',
    error_message: row.ok ? null : row.error || 'Unknown error',
    openphone_message_id: row.messageId ?? null,
    timestamp: now.toISO(),
  });
  if (error) console.error('[reservation guests] could not log guest message', error.message);
}

interface DeliverArgs {
  kind: GuestMessageKind;
  guest: GuestRow;
  reservation: ReservationRow;
  location: LocationRow | null;
  host: HostName;
  template: TemplateRow | null;
  /** A campaign message (Reservation moved / cancelled) sent instead of a built-in template. */
  campaignMessage?: EventCampaignMessage | null;
}

/** A "Reservation moved" / "Reservation cancelled" campaign message. */
export interface EventCampaignMessage {
  id: string;
  content: string;
  /** Message and its campaign both on. */
  active: boolean;
  /** All guests, guests who are members, or guests who aren't. */
  recipient_type: string;
}

type DeliverResult = { status: 'sent'; messageId?: string } | { status: 'skipped'; reason: string } | { status: 'failed'; error: string };

/** Fill a campaign message with the same placeholders as Guest Registration messages. */
async function renderEventCampaignMessage(content: string, a: DeliverArgs, contact: ContactRow, db: Db): Promise<string> {
  const { renderGuestCampaignMessage } = await import('@/lib/guestCampaigns');
  // {{calendar_link}}: a cancelled reservation has no calendar file, so it renders empty there.
  let calendarLink = '';
  if (a.kind !== 'cancelled' && content.includes('{{calendar_link}}')) {
    const { guestLinksForReservation } = await import('@/lib/reservationCampaigns');
    calendarLink = (await guestLinksForReservation(a.reservation.id, db)).calendarLink;
  }
  return renderGuestCampaignMessage(content, {
    calendarLink,
    guestFirstName: a.guest.first_name_snapshot || contact.first_name,
    guestLastName: contact.last_name,
    hostFirstName: a.host.first,
    hostLastName: a.host.last,
    locationName: a.location?.name || 'Noir',
    locationAddress: a.location?.address,
    parkingInstructions: a.location?.parking_instructions,
    start: a.reservation.start_time,
    partySize: a.reservation.party_size,
    timezone: a.location?.timezone || DEFAULT_TIMEZONE,
    arrivalInstructions: a.location?.guest_arrival_instructions,
  });
}

/** Re-check, render, send and log one guest text. */
async function deliver(db: Db, deps: GuestDeps, a: DeliverArgs): Promise<DeliverResult> {
  const { send, now } = resolve(deps);
  const contact = a.guest.guest_contacts;
  if (!contact) return { status: 'skipped', reason: 'no_contact' };
  if (a.campaignMessage) {
    if (!a.campaignMessage.active) return { status: 'skipped', reason: 'campaign_inactive' };
  } else {
    if (!a.template) return { status: 'skipped', reason: 'no_template' };
    if (!a.template.is_active) return { status: 'skipped', reason: 'template_inactive' };
  }
  if (a.guest.status !== 'active') return { status: 'skipped', reason: 'guest_removed' };
  if (contact.sms_opted_out_at) return { status: 'skipped', reason: 'opted_out' };
  if (a.kind !== 'cancelled') {
    const closed = isReservationClosed(a.reservation, now);
    if (closed) return { status: 'skipped', reason: closed };
  }
  // Members on someone else's reservation get the guest texts too. Keep the
  // member badge current if they joined since they were added.
  let isMember = !!a.guest.matched_member_id;
  if (!isMember) {
    const memberNow = await findMemberIdByPhone(db, contact.phone);
    if (memberNow) {
      isMember = true;
      await db.from('reservation_guests').update({ matched_member_id: memberNow }).eq('id', a.guest.id);
    }
  }
  if (a.campaignMessage && !guestRecipientMatches(a.campaignMessage.recipient_type, isMember)) {
    return { status: 'skipped', reason: isMember ? 'recipient_nonmembers_only' : 'recipient_members_only' };
  }

  const content = a.campaignMessage
    ? await renderEventCampaignMessage(a.campaignMessage.content, a, contact, db)
    : renderGuestMessage(a.template!.body, {
    guestFirstName: a.guest.first_name_snapshot || contact.first_name,
    hostFirstName: a.host.first,
    hostLastName: a.host.last,
    locationAddress: a.location?.address,
    parkingInstructions: a.location?.parking_instructions,
    locationName: a.location?.name || 'Noir',
    start: a.reservation.start_time,
    timezone: a.location?.timezone,
    arrivalInstructions: a.location?.guest_arrival_instructions,
  });
  const result = await send({ to: contact.phone, content });
  await logGuestMessage(
    db,
    { phone: contact.phone, content, reservationId: a.reservation.id, sentBy: SENT_BY_SYSTEM, ok: result.success, error: result.error, messageId: result.messageId },
    now,
  );
  if (!result.success) return { status: 'failed', error: result.error || 'Send failed' };
  if (!a.guest.notified_at) {
    await db.from('reservation_guests').update({ notified_at: now.toISO() }).eq('id', a.guest.id).is('notified_at', null);
  }
  return { status: 'sent', messageId: result.messageId };
}

export interface ProcessResult {
  claimed: number;
  sent: number;
  skipped: number;
  failed: number;
}

/**
 * Send due guest texts. Rows are claimed (pending → sending) one by one with a
 * conditional update, so overlapping runs can't double-send.
 */
export async function processDueGuestMessages(opts: { limit?: number } = {}, deps: GuestDeps = {}): Promise<ProcessResult> {
  const { db, now } = resolve(deps);
  const limit = opts.limit ?? 50;
  const result: ProcessResult = { claimed: 0, sent: 0, skipped: 0, failed: 0 };

  // A run that died mid-send leaves rows in 'sending'. Never resend them.
  await db
    .from('scheduled_guest_messages')
    .update({ status: 'failed', error_message: 'Interrupted while sending; not retried to avoid a duplicate text' })
    .eq('status', 'sending')
    .lt('updated_at', now.minus({ minutes: 15 }).toUTC().toISO()!);

  const { data: due, error } = await db
    .from('scheduled_guest_messages')
    .select('id')
    .eq('status', 'pending')
    .lte('scheduled_for', now.toUTC().toISO()!)
    .order('scheduled_for', { ascending: true })
    .limit(limit);
  if (error) {
    console.error('[reservation guests] could not load due messages', error.message);
    return result;
  }

  const templates = await loadTemplates(db);
  const locationCache = new Map<string, LocationRow | null>();
  const hostCache = new Map<string, HostName>();
  const campaignCache = new Map<string, EventCampaignMessage | null>();

  for (const { id } of (due || []) as Array<{ id: string }>) {
    const { data: claimedRows } = await db
      .from('scheduled_guest_messages')
      .update({ status: 'sending' })
      .eq('id', id)
      .eq('status', 'pending')
      .select('id, kind, reservation_guest_id, campaign_message_id');
    const claimed = ((claimedRows || []) as Array<{ id: string; kind: GuestMessageKind; reservation_guest_id: string; campaign_message_id?: string | null }>)[0];
    if (!claimed) continue; // another run took it
    result.claimed++;

    let outcome: DeliverResult;
    try {
      const { data: guest } = await db
        .from('reservation_guests')
        .select(GUEST_COLUMNS)
        .eq('id', claimed.reservation_guest_id)
        .maybeSingle();
      if (!guest) {
        outcome = { status: 'skipped', reason: 'guest_missing' };
      } else {
        const g = guest as unknown as GuestRow;
        const { data: res } = await db.from('reservations').select(RESERVATION_COLUMNS).eq('id', g.reservation_id).maybeSingle();
        if (!res) {
          outcome = { status: 'skipped', reason: 'reservation_missing' };
        } else {
          const reservation = res as ReservationRow;
          const locKey = reservation.location_id || '';
          if (!locationCache.has(locKey)) locationCache.set(locKey, await loadLocation(db, reservation.location_id));
          if (!hostCache.has(reservation.id)) hostCache.set(reservation.id, await hostName(db, reservation));
          let campaignMessage: EventCampaignMessage | null = null;
          if (claimed.campaign_message_id) {
            if (!campaignCache.has(claimed.campaign_message_id)) {
              const { loadEventCampaignMessage } = await import('@/lib/guestCampaigns');
              campaignCache.set(claimed.campaign_message_id, await loadEventCampaignMessage(db, claimed.campaign_message_id));
            }
            campaignMessage = campaignCache.get(claimed.campaign_message_id) || null;
          }
          outcome = claimed.campaign_message_id && !campaignMessage
            ? { status: 'skipped', reason: 'campaign_message_missing' }
            : await deliver(db, deps, {
                kind: claimed.kind,
                guest: g,
                reservation,
                location: locationCache.get(locKey) || null,
                host: hostCache.get(reservation.id)!,
                template: templates.get(claimed.kind) || null,
                campaignMessage,
              });
        }
      }
    } catch (err) {
      outcome = { status: 'failed', error: err instanceof Error ? err.message : 'Unknown error' };
    }

    if (outcome.status === 'sent') {
      result.sent++;
      await db
        .from('scheduled_guest_messages')
        .update({ status: 'sent', sent_at: now.toISO(), openphone_message_id: outcome.messageId ?? null })
        .eq('id', claimed.id);
    } else if (outcome.status === 'skipped') {
      result.skipped++;
      await db.from('scheduled_guest_messages').update({ status: 'skipped', skip_reason: outcome.reason }).eq('id', claimed.id);
    } else {
      result.failed++;
      await db.from('scheduled_guest_messages').update({ status: 'failed', error_message: outcome.error }).eq('id', claimed.id);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Staff texting (Membership → Guests)
// ---------------------------------------------------------------------------

/** Manual text from staff to a guest. Blocked if the contact opted out. */
export async function sendStaffGuestText(
  reservationGuestId: string,
  content: string,
  sentBy: string,
  deps: GuestDeps = {},
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { db, send, now } = resolve(deps);
  const text = String(content ?? '').trim();
  if (!text) return { ok: false, error: 'Message is empty.', status: 400 };
  if (text.length > 1000) return { ok: false, error: 'Message is too long.', status: 400 };
  const { data: guest } = await db.from('reservation_guests').select(GUEST_COLUMNS).eq('id', reservationGuestId).maybeSingle();
  if (!guest) return { ok: false, error: 'Guest not found.', status: 404 };
  const g = guest as unknown as GuestRow;
  if (!g.guest_contacts) return { ok: false, error: 'Guest has no phone.', status: 400 };
  if (g.guest_contacts.sms_opted_out_at) return { ok: false, error: 'This guest opted out of texts.', status: 409 };
  const result = await send({ to: g.guest_contacts.phone, content: text });
  await logGuestMessage(
    db,
    { phone: g.guest_contacts.phone, content: text, reservationId: g.reservation_id, sentBy, ok: result.success, error: result.error, messageId: result.messageId },
    now,
  );
  return result.success ? { ok: true } : { ok: false, error: result.error || 'Send failed.', status: 502 };
}
