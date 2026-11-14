/**
 * The no-login "add your guests" link (/r/[token]/guests).
 *
 * Shows location, date, time, the host's first name and the guests already on
 * the reservation (first name and last initial only). Never exposes guests'
 * phones or any member data.
 */
import { createHash, timingSafeEqual } from 'crypto';
import { DateTime } from 'luxon';
import { supabaseAdmin } from '@/lib/supabase';
import { isReservationClosed, DEFAULT_TIMEZONE, MAX_PARTY_SIZE } from '@/lib/reservationGuests';
import { isValidTokenShape, newGuestLinkToken, tokenExpired } from '@/lib/guestApi';

type Db = typeof supabaseAdmin;

export interface GuestLinkSummary {
  location_name: string;
  date: string;
  time: string;
  host_first_name: string;
  /** How many more guests fit (party size − 1 − current guests). */
  spots_left: number;
  /** Current party size, host included. */
  party_size: number;
  /** Most guests this page can still add, raising the party size if needed (capacity is checked on save). */
  max_more: number;
  /** Guests already on the reservation: first name and last initial only, in the order added. */
  guests: string[];
  /** Path of the self-register link the member can send to guests (/r/<join token>/join), or null. */
  join_path: string | null;
}

/** What a guest sees on the self-register page: no guest list, no member data. */
export interface GuestJoinSummary {
  location_name: string;
  date: string;
  time: string;
  host_first_name: string;
}

/** "Tim W." from first name + optional last name. Never more than the last initial. */
export function guestDisplayName(first: string | null | undefined, last: string | null | undefined): string {
  const f = (first || '').trim();
  const initial = (last || '').trim().charAt(0).toUpperCase();
  return initial ? `${f} ${initial}.` : f;
}

export type GuestLinkLookup =
  | { ok: true; reservationId: string; partySize: number; summary: GuestLinkSummary }
  | { ok: false; reason: 'invalid' | 'expired' | 'closed' };

type ReservationRow = {
  id: string;
  status: string | null;
  start_time: string;
  end_time: string | null;
  party_size: number | null;
  first_name: string | null;
  member_id: string | null;
  location_id: string | null;
  guest_link_token?: string | null;
  guest_link_expires_at: string | null;
};
const RESERVATION_COLUMNS = 'id, status, start_time, end_time, party_size, first_name, member_id, location_id, guest_link_token, guest_link_expires_at';

async function summarize(db: Db, r: ReservationRow): Promise<GuestLinkSummary> {
  const [{ data: loc }, { data: member }, { data: guests }] = await Promise.all([
    r.location_id
      ? db.from('locations').select('name, timezone').eq('id', r.location_id).maybeSingle()
      : Promise.resolve({ data: null }),
    !r.first_name && r.member_id
      ? db.from('members').select('first_name').eq('member_id', r.member_id).maybeSingle()
      : Promise.resolve({ data: null }),
    db
      .from('reservation_guests')
      .select('id, first_name_snapshot, created_at, guest_contacts(first_name, last_name)')
      .eq('reservation_id', r.id)
      .eq('status', 'active')
      .order('created_at', { ascending: true }),
  ]);

  const tz = (loc as { timezone?: string } | null)?.timezone || DEFAULT_TIMEZONE;
  const start = DateTime.fromISO(r.start_time, { zone: 'utc' }).setZone(tz);
  const host = (r.first_name || (member as { first_name?: string } | null)?.first_name || '').trim();
  type GuestNameRow = { first_name_snapshot: string | null; guest_contacts?: { first_name?: string | null; last_name?: string | null } | null };
  const guestRows = ((guests as GuestNameRow[] | null) || []);
  const guestNames = guestRows
    .map((g) => guestDisplayName(g.first_name_snapshot || g.guest_contacts?.first_name, g.guest_contacts?.last_name) || 'Guest');
  const join = r.guest_link_token ? guestJoinToken(r.id, r.guest_link_token) : null;
  return {
    location_name: (loc as { name?: string } | null)?.name || 'Noir',
    date: start.toFormat('cccc, LLLL d'),
    time: start.toFormat('h:mm a'),
    host_first_name: host.split(' ')[0] || 'Your host',
    spots_left: Math.max(0, (r.party_size || 1) - 1 - guestRows.length),
    guests: guestNames,
    party_size: r.party_size || 1,
    max_more: Math.max(0, MAX_PARTY_SIZE - 1 - guestRows.length),
    join_path: join ? `/r/${join}/join` : null,
  };
}

export async function lookupGuestLink(token: unknown, deps: { db?: Db; now?: DateTime } = {}): Promise<GuestLinkLookup> {
  const db = deps.db ?? supabaseAdmin;
  const now = deps.now ?? DateTime.utc();
  if (!isValidTokenShape(token)) return { ok: false, reason: 'invalid' };

  const { data: r } = await db
    .from('reservations')
    .select(RESERVATION_COLUMNS)
    .eq('guest_link_token', token)
    .maybeSingle();
  if (!r) return { ok: false, reason: 'invalid' };
  if (tokenExpired(r.guest_link_expires_at, now)) return { ok: false, reason: 'expired' };
  if (isReservationClosed(r, now)) return { ok: false, reason: 'closed' };

  return { ok: true, reservationId: r.id, partySize: r.party_size || 1, summary: await summarize(db, r as ReservationRow) };
}

// ---------------------------------------------------------------------------
// Self-register ("join") link: the member sends it to guests, and each guest
// adds only themselves.
//
// Token = 22 chars of the reservation id (base64url of its 16 bytes) + 22 chars
// of sha256("noir-guest-join:v1:" + the member's guest-link token). The member
// token is 256 random bits, so the join token can't be forged and can't be
// turned back into the member link (which shows the guest list). It needs no
// new column, expires with the member link, and stops working if staff rotate
// the member link.
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const JOIN_TOKEN_RE = /^[A-Za-z0-9_-]{44}$/;

function joinSignature(guestLinkToken: string): string {
  return createHash('sha256').update(`noir-guest-join:v1:${guestLinkToken}`).digest('base64url').slice(0, 22);
}

export function guestJoinToken(reservationId: string, guestLinkToken: string): string | null {
  if (!UUID_RE.test(reservationId) || !isValidTokenShape(guestLinkToken)) return null;
  const idPart = Buffer.from(reservationId.replace(/-/g, ''), 'hex').toString('base64url');
  return idPart + joinSignature(guestLinkToken);
}

function parseJoinToken(token: unknown): { reservationId: string; signature: string } | null {
  if (typeof token !== 'string' || !JOIN_TOKEN_RE.test(token)) return null;
  const idPart = token.slice(0, 22);
  const bytes = Buffer.from(idPart, 'base64url');
  if (bytes.length !== 16 || bytes.toString('base64url') !== idPart) return null;
  const hex = bytes.toString('hex');
  const reservationId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  return { reservationId, signature: token.slice(22) };
}

export type GuestJoinLookup =
  | { ok: true; reservationId: string; partySize: number; guestCount: number; summary: GuestJoinSummary }
  | { ok: false; reason: 'invalid' | 'expired' | 'closed' };

export async function lookupGuestJoin(token: unknown, deps: { db?: Db; now?: DateTime } = {}): Promise<GuestJoinLookup> {
  const db = deps.db ?? supabaseAdmin;
  const now = deps.now ?? DateTime.utc();
  const parsed = parseJoinToken(token);
  if (!parsed) return { ok: false, reason: 'invalid' };

  const { data: r } = await db.from('reservations').select(RESERVATION_COLUMNS).eq('id', parsed.reservationId).maybeSingle();
  if (!r || !r.guest_link_token || !isValidTokenShape(r.guest_link_token)) return { ok: false, reason: 'invalid' };
  const expected = Buffer.from(joinSignature(r.guest_link_token));
  const given = Buffer.from(parsed.signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, reason: 'invalid' };
  if (tokenExpired(r.guest_link_expires_at, now)) return { ok: false, reason: 'expired' };
  if (isReservationClosed(r, now)) return { ok: false, reason: 'closed' };

  const full = await summarize(db, r as ReservationRow);
  return {
    ok: true,
    reservationId: r.id,
    partySize: r.party_size || 1,
    guestCount: full.guests.length,
    summary: { location_name: full.location_name, date: full.date, time: full.time, host_first_name: full.host_first_name },
  };
}

export type EnsureLinkResult =
  | { ok: true; token: string; expiresAt: string; created: boolean }
  | { ok: false; status: number; error: string };

/**
 * Create (or return the current) guest-link token for a reservation. The token
 * is 32 random bytes and expires when the reservation ends.
 */
export async function ensureGuestLink(reservationId: string, deps: { db?: Db; now?: DateTime } = {}): Promise<EnsureLinkResult> {
  const db = deps.db ?? supabaseAdmin;
  const now = deps.now ?? DateTime.utc();
  const { data: r, error } = await db
    .from('reservations')
    .select('id, status, start_time, end_time, guest_link_token, guest_link_expires_at')
    .eq('id', reservationId)
    .maybeSingle();
  if (error) return { ok: false, status: 500, error: 'Guest links need the reservation-guests migration applied.' };
  if (!r) return { ok: false, status: 404, error: 'Reservation not found' };
  if (isReservationClosed(r, now)) return { ok: false, status: 409, error: 'This reservation is cancelled or over.' };
  if (r.guest_link_token && !tokenExpired(r.guest_link_expires_at, now)) {
    return { ok: true, token: r.guest_link_token, expiresAt: r.guest_link_expires_at, created: false };
  }
  const token = newGuestLinkToken();
  const expiresAt = r.end_time || DateTime.fromISO(r.start_time, { zone: 'utc' }).plus({ hours: 4 }).toISO()!;
  const { error: saveError } = await db.from('reservations').update({ guest_link_token: token, guest_link_expires_at: expiresAt }).eq('id', reservationId);
  if (saveError) return { ok: false, status: 500, error: 'Could not create the link.' };
  return { ok: true, token, expiresAt, created: true };
}

/**
 * Abuse cap for the public link: total guests ever added through this
 * reservation's link (removed ones included, so remove-and-re-add loops count)
 * may not exceed party size − 1 plus a small allowance for corrections, and
 * never more than GUEST_LINK_HARD_CAP. Every add can trigger texts, so this
 * bounds how many numbers a leaked link can make us text.
 */
export const GUEST_LINK_CORRECTION_ALLOWANCE = 2;
export const GUEST_LINK_HARD_CAP = 20;

export function guestLinkAddCap(partySize: number): number {
  return Math.min(GUEST_LINK_HARD_CAP, Math.max(0, (partySize || 1) - 1) + GUEST_LINK_CORRECTION_ALLOWANCE);
}

export async function guestLinkAddsUsed(reservationId: string, deps: { db?: Db } = {}): Promise<number> {
  const db = deps.db ?? supabaseAdmin;
  const { data } = await db.from('reservation_guests').select('id').eq('reservation_id', reservationId).eq('added_via', 'guest_link');
  return ((data as unknown[]) || []).length;
}
