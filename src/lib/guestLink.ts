/**
 * The no-login "add your guests" link (/r/[token]/guests).
 *
 * Shows only location, date, time and the host's first name. Never exposes
 * existing guests' phones or any member data.
 */
import { DateTime } from 'luxon';
import { supabaseAdmin } from '@/lib/supabase';
import { isReservationClosed, DEFAULT_TIMEZONE } from '@/lib/reservationGuests';
import { isValidTokenShape, newGuestLinkToken, tokenExpired } from '@/lib/guestApi';

type Db = typeof supabaseAdmin;

export interface GuestLinkSummary {
  location_name: string;
  date: string;
  time: string;
  host_first_name: string;
  /** How many more guests fit (party size − 1 − current guests). */
  spots_left: number;
}

export type GuestLinkLookup =
  | { ok: true; reservationId: string; partySize: number; summary: GuestLinkSummary }
  | { ok: false; reason: 'invalid' | 'expired' | 'closed' };

export async function lookupGuestLink(token: unknown, deps: { db?: Db; now?: DateTime } = {}): Promise<GuestLinkLookup> {
  const db = deps.db ?? supabaseAdmin;
  const now = deps.now ?? DateTime.utc();
  if (!isValidTokenShape(token)) return { ok: false, reason: 'invalid' };

  const { data: r } = await db
    .from('reservations')
    .select('id, status, start_time, end_time, party_size, first_name, member_id, location_id, guest_link_expires_at')
    .eq('guest_link_token', token)
    .maybeSingle();
  if (!r) return { ok: false, reason: 'invalid' };
  if (tokenExpired(r.guest_link_expires_at, now)) return { ok: false, reason: 'expired' };
  if (isReservationClosed(r, now)) return { ok: false, reason: 'closed' };

  const [{ data: loc }, { data: member }, { data: guests }] = await Promise.all([
    r.location_id
      ? db.from('locations').select('name, timezone').eq('id', r.location_id).maybeSingle()
      : Promise.resolve({ data: null }),
    !r.first_name && r.member_id
      ? db.from('members').select('first_name').eq('member_id', r.member_id).maybeSingle()
      : Promise.resolve({ data: null }),
    db.from('reservation_guests').select('id').eq('reservation_id', r.id).eq('status', 'active'),
  ]);

  const tz = (loc as { timezone?: string } | null)?.timezone || DEFAULT_TIMEZONE;
  const start = DateTime.fromISO(r.start_time, { zone: 'utc' }).setZone(tz);
  const host = (r.first_name || (member as { first_name?: string } | null)?.first_name || '').trim();
  return {
    ok: true,
    reservationId: r.id,
    partySize: r.party_size || 1,
    summary: {
      location_name: (loc as { name?: string } | null)?.name || 'Noir',
      date: start.toFormat('cccc, LLLL d'),
      time: start.toFormat('h:mm a'),
      host_first_name: host.split(' ')[0] || 'Your host',
      spots_left: Math.max(0, (r.party_size || 1) - 1 - ((guests as unknown[]) || []).length),
    },
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
