/**
 * The no-login "add your guests" link (/r/[token]/guests).
 *
 * Shows only location, date, time and the host's first name. Never exposes
 * existing guests' phones or any member data.
 */
import { DateTime } from 'luxon';
import { supabaseAdmin } from '@/lib/supabase';
import { isReservationClosed, DEFAULT_TIMEZONE } from '@/lib/reservationGuests';
import { isValidTokenShape, tokenExpired } from '@/lib/guestApi';

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
  | { ok: true; reservationId: string; summary: GuestLinkSummary }
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
    summary: {
      location_name: (loc as { name?: string } | null)?.name || 'Noir',
      date: start.toFormat('cccc, LLLL d'),
      time: start.toFormat('h:mm a'),
      host_first_name: host.split(' ')[0] || 'Your host',
      spots_left: Math.max(0, (r.party_size || 1) - 1 - ((guests as unknown[]) || []).length),
    },
  };
}
