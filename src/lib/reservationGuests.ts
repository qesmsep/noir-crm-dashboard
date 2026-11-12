/**
 * Reservation guests: people a member brings on a reservation.
 *
 * One module every entry point calls — member portal, the no-login guest link,
 * staff (admin), the reschedule/cancel paths and the sending cron. "Guest" here
 * always means a reservation guest; the campaign engine's "guest" (any
 * non-member reservation phone) is a different thing and is never touched here.
 *
 * Texts:
 *   added         when a guest is added (skipped if the reservation starts
 *                 within 2 hours — day_of covers it)
 *   day_of        start − send_offset_minutes (default 120), venue timezone;
 *                 if that time has passed but the start hasn't, sent now
 *                 instead of `added` — never both
 *   time_changed  to guests already texted, when the reservation moves
 *   cancelled     to guests already texted, when the reservation is cancelled
 * Nothing is ever scheduled for an opted-out contact or a guest who is already
 * a member. No thank-you / follow-up texts are automated.
 */
import { DateTime } from 'luxon';
import { supabaseAdmin } from '@/lib/supabase';
import { sendSMS } from '@/lib/sms';
import { last10, maskPhone, toE164, formatPhoneDisplay } from '@/lib/phone';

export const GUEST_KINDS = ['added', 'day_of', 'time_changed', 'cancelled'] as const;
export type GuestMessageKind = (typeof GUEST_KINDS)[number];
export type AddedVia = 'portal' | 'guest_link' | 'staff';

export const DEFAULT_DAY_OF_OFFSET_MINUTES = 120;
/** If the reservation starts within this window, `added` is skipped. */
export const ADDED_SKIP_WINDOW_MINUTES = 120;
export const DEFAULT_TIMEZONE = 'America/Chicago';
export const DEFAULT_ARRIVAL_INSTRUCTIONS = "Give your name at the door and we'll take it from there.";
export const SENT_BY_SYSTEM = 'system:guests';
const MAX_NAME_LENGTH = 60;

type Db = typeof supabaseAdmin;
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

interface TemplateRow {
  kind: GuestMessageKind;
  body: string;
  is_active: boolean;
  send_offset_minutes: number | null;
}

interface LocationRow {
  id: string;
  name: string | null;
  timezone: string | null;
  guest_arrival_instructions?: string | null;
}

const RESERVATION_COLUMNS = 'id, status, start_time, end_time, party_size, phone, first_name, member_id, location_id';
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
 * When a new guest's texts go out. Computed in the venue timezone.
 *
 * - `added` now, unless the reservation starts within 2 hours.
 * - `day_of` at start − offset; if that moment has passed (and the start
 *   hasn't), now — and then no `added`.
 * - If the day_of template is switched off, `added` is sent regardless of the
 *   2-hour window so the guest still hears something.
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
  if (!start.isValid || start <= now) return [];

  const offset = args.dayOfOffsetMinutes ?? DEFAULT_DAY_OF_OFFSET_MINUTES;
  const dayOfAt = start.minus({ minutes: offset });
  const dayOfActive = active.has('day_of');
  const dayOfDue = dayOfAt <= now;
  const withinSkipWindow = start.diff(now, 'minutes').minutes <= ADDED_SKIP_WINDOW_MINUTES;

  const plan: PlannedMessage[] = [];
  if (dayOfActive) {
    if (!dayOfDue && !withinSkipWindow && active.has('added')) plan.push({ kind: 'added', scheduledFor: now });
    plan.push({ kind: 'day_of', scheduledFor: dayOfDue ? now : dayOfAt });
  } else if (active.has('added')) {
    plan.push({ kind: 'added', scheduledFor: now });
  }
  return plan;
}

export interface RenderContext {
  guestFirstName: string;
  hostFirstName: string;
  locationName: string;
  start: string;
  timezone?: string | null;
  arrivalInstructions?: string | null;
}

export function renderGuestMessage(body: string, ctx: RenderContext): string {
  const tz = ctx.timezone || DEFAULT_TIMEZONE;
  const start = DateTime.fromISO(ctx.start, { zone: 'utc' }).setZone(tz);
  const arrival = (ctx.arrivalInstructions || '').trim() || DEFAULT_ARRIVAL_INSTRUCTIONS;
  return body
    .replace(/\{\{guest_first_name\}\}/g, ctx.guestFirstName)
    .replace(/\{\{host_first_name\}\}/g, ctx.hostFirstName)
    .replace(/\{\{location_name\}\}/g, ctx.locationName)
    .replace(/\{\{date\}\}/g, start.isValid ? start.toFormat('cccc, LLLL d') : '')
    .replace(/\{\{time\}\}/g, start.isValid ? start.toFormat('h:mm a') : '')
    .replace(/\{\{arrival_instructions\}\}/g, arrival)
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

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

async function loadTemplates(db: Db): Promise<Map<GuestMessageKind, TemplateRow>> {
  const { data } = await db.from('guest_message_templates').select('kind, body, is_active, send_offset_minutes');
  const map = new Map<GuestMessageKind, TemplateRow>();
  ((data || []) as TemplateRow[]).forEach((t) => map.set(t.kind, t));
  return map;
}

function activeKindsFrom(templates: Map<GuestMessageKind, TemplateRow>): Set<GuestMessageKind> {
  // A missing template row counts as active so the seeded defaults apply even
  // if someone deleted a row; the sender skips it with a reason.
  return new Set(GUEST_KINDS.filter((k) => templates.get(k)?.is_active !== false));
}

async function loadLocation(db: Db, locationId: string | null): Promise<LocationRow | null> {
  if (!locationId) return null;
  const { data } = await db
    .from('locations')
    .select('id, name, timezone, guest_arrival_instructions')
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

async function hostFirstName(db: Db, reservation: ReservationRow): Promise<string> {
  if (reservation.first_name && reservation.first_name.trim()) return reservation.first_name.trim();
  if (reservation.member_id) {
    const { data } = await db.from('members').select('first_name').eq('member_id', reservation.member_id).maybeSingle();
    const name = (data as { first_name?: string | null } | null)?.first_name;
    if (name) return name;
  }
  return 'your host';
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
  opts: { via: AddedVia; actorMemberId?: string | null },
  deps: GuestDeps = {},
): Promise<GuestViewForStaff[]> {
  const { db, now } = resolve(deps);
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
  if (existing.length + clean.length > cap) {
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
  }

  for (const g of created) {
    await scheduleGuestMessages(g.id, deps);
  }

  return listGuests(reservation.id, 'staff', deps);
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

async function insertPending(db: Db, guestId: string, kind: GuestMessageKind, at: DateTime): Promise<void> {
  const { error } = await db
    .from('scheduled_guest_messages')
    .insert({ reservation_guest_id: guestId, kind, scheduled_for: at.toUTC().toISO(), status: 'pending' });
  if (error?.code === '23505') {
    await db
      .from('scheduled_guest_messages')
      .update({ scheduled_for: at.toUTC().toISO() })
      .eq('reservation_guest_id', guestId)
      .eq('kind', kind)
      .eq('status', 'pending');
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
  return g.status === 'active' && !g.matched_member_id && !g.guest_contacts?.sms_opted_out_at;
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

    for (const g of guests) {
      if (!g.notified_at) {
        await cancelPendingForGuests(db, [g.id], undefined, 'rescheduled');
        const plan = planGuestMessages({ start: reservation.start_time, now, timezone: tz, dayOfOffsetMinutes: offset, activeKinds: active });
        for (const p of plan) await insertPending(db, g.id, p.kind, p.scheduledFor);
        continue;
      }
      await cancelPendingForGuests(db, [g.id], ['day_of', 'time_changed', 'added'], 'rescheduled');
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
    const templates = await loadTemplates(db);
    if (templates.get('cancelled')?.is_active === false) return;
    const toTell = guests.filter((g) => g.notified_at && guestIsTextable(g));
    if (toTell.length === 0) return;

    if (!opts.sendNow) {
      for (const g of toTell) await insertPending(db, g.id, 'cancelled', now);
      return;
    }
    const reservation = await loadReservation(db, reservationId);
    const [location, host] = await Promise.all([loadLocation(db, reservation.location_id), hostFirstName(db, reservation)]);
    for (const g of toTell) {
      await deliver(db, deps, {
        kind: 'cancelled',
        guest: g,
        reservation,
        location,
        host,
        template: templates.get('cancelled') || null,
      });
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
    await db.from('guest_contacts').update({ sms_opted_out_at: now.toISO() }).eq('id', contactId);
    const { data: guestRows } = await db.from('reservation_guests').select('id').eq('guest_contact_id', contactId);
    await cancelPendingForGuests(db, ((guestRows || []) as Array<{ id: string }>).map((r) => r.id), undefined, 'opted_out');
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
  host: string;
  template: TemplateRow | null;
}

type DeliverResult = { status: 'sent'; messageId?: string } | { status: 'skipped'; reason: string } | { status: 'failed'; error: string };

/** Re-check, render, send and log one guest text. */
async function deliver(db: Db, deps: GuestDeps, a: DeliverArgs): Promise<DeliverResult> {
  const { send, now } = resolve(deps);
  const contact = a.guest.guest_contacts;
  if (!contact) return { status: 'skipped', reason: 'no_contact' };
  if (!a.template) return { status: 'skipped', reason: 'no_template' };
  if (!a.template.is_active) return { status: 'skipped', reason: 'template_inactive' };
  if (a.guest.status !== 'active') return { status: 'skipped', reason: 'guest_removed' };
  if (contact.sms_opted_out_at) return { status: 'skipped', reason: 'opted_out' };
  if (a.guest.matched_member_id) return { status: 'skipped', reason: 'matched_member' };
  if (a.kind !== 'cancelled') {
    const closed = isReservationClosed(a.reservation, now);
    if (closed) return { status: 'skipped', reason: closed };
  }
  // Someone may have joined since the guest was added.
  const memberNow = await findMemberIdByPhone(db, contact.phone);
  if (memberNow) {
    await db.from('reservation_guests').update({ matched_member_id: memberNow }).eq('id', a.guest.id);
    return { status: 'skipped', reason: 'matched_member' };
  }

  const content = renderGuestMessage(a.template.body, {
    guestFirstName: a.guest.first_name_snapshot || contact.first_name,
    hostFirstName: a.host,
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
  const hostCache = new Map<string, string>();

  for (const { id } of (due || []) as Array<{ id: string }>) {
    const { data: claimedRows } = await db
      .from('scheduled_guest_messages')
      .update({ status: 'sending' })
      .eq('id', id)
      .eq('status', 'pending')
      .select('id, kind, reservation_guest_id');
    const claimed = ((claimedRows || []) as Array<{ id: string; kind: GuestMessageKind; reservation_guest_id: string }>)[0];
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
          if (!hostCache.has(reservation.id)) hostCache.set(reservation.id, await hostFirstName(db, reservation));
          outcome = await deliver(db, deps, {
            kind: claimed.kind,
            guest: g,
            reservation,
            location: locationCache.get(locKey) || null,
            host: hostCache.get(reservation.id)!,
            template: templates.get(claimed.kind) || null,
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
// Staff texting (Campaigns → Reservation guests)
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
