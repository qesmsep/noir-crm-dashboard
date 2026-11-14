import type { NextApiRequest, NextApiResponse } from 'next';
import { DateTime } from 'luxon';
import { supabaseAdmin } from '@/lib/supabase';
import { formatPhoneDisplay, last10 } from '@/lib/phone';
import { getAdmin } from '@/lib/guestApi';

/**
 * GET /api/admin/reservation-guests?location_id=&from=YYYY-MM-DD&to=YYYY-MM-DD&not_followed_up=1&format=csv
 *
 * One row per guest visit, for staff follow-up on Campaigns → Reservation
 * guests. "Now a member" is computed at query time by matching members.phone
 * on the last 10 digits. Auth: admin Bearer token.
 */
export interface GuestVisitRow {
  id: string;
  reservation_id: string;
  guest_name: string;
  phone: string;
  phone_display: string;
  host_name: string;
  location_name: string;
  reservation_start: string;
  checked_in: boolean;
  visit_count: number;
  last_visit: string | null;
  opted_out: boolean;
  now_member: boolean;
  followed_up_at: string | null;
  followed_up_by: string | null;
  follow_up_note: string | null;
}

const MAX_ROWS = 500;

function csvCell(v: unknown): string {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // keep spreadsheets from running formulas
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!(await getAdmin(req))) return res.status(401).json({ error: 'Admin access required' });

  const { location_id, from, to, not_followed_up, format } = req.query;
  const tz = 'America/Chicago';

  let q = supabaseAdmin
    .from('reservation_guests')
    .select(
      'id, reservation_id, guest_contact_id, first_name_snapshot, checked_in_at, followed_up_at, followed_up_by, follow_up_note, location_id, ' +
        'guest_contacts(id, phone, first_name, last_name, sms_opted_out_at), ' +
        'reservations!inner(id, start_time, first_name, last_name, member_id, status), ' +
        'locations(name)',
    )
    .eq('status', 'active')
    .or('status.is.null,status.neq.cancelled', { referencedTable: 'reservations' })
    .order('created_at', { ascending: false })
    .limit(MAX_ROWS);

  if (typeof location_id === 'string' && location_id) q = q.eq('location_id', location_id);
  if (typeof from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    q = q.gte('reservations.start_time', DateTime.fromISO(from, { zone: tz }).startOf('day').toUTC().toISO()!);
  }
  if (typeof to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    q = q.lte('reservations.start_time', DateTime.fromISO(to, { zone: tz }).endOf('day').toUTC().toISO()!);
  }
  if (not_followed_up === '1') q = q.is('followed_up_at', null);

  const { data, error } = await q;
  if (error) {
    console.error('reservation-guests list error', error);
    return res.status(500).json({ error: 'Could not load guests. Is the reservation-guests migration applied?' });
  }
  type Raw = {
    id: string;
    reservation_id: string;
    guest_contact_id: string;
    first_name_snapshot: string | null;
    checked_in_at: string | null;
    followed_up_at: string | null;
    followed_up_by: string | null;
    follow_up_note: string | null;
    guest_contacts: { phone: string; first_name: string; last_name: string | null; sms_opted_out_at: string | null } | null;
    reservations: { start_time: string; first_name: string | null; last_name: string | null; member_id: string | null } | null;
    locations: { name: string | null } | null;
  };
  const rows = (data || []) as unknown as Raw[];

  // Visit history per contact: checked-in visits only.
  const contactIds = [...new Set(rows.map((r) => r.guest_contact_id))];
  const visits = new Map<string, { count: number; last: string | null }>();
  if (contactIds.length) {
    const { data: history } = await supabaseAdmin
      .from('reservation_guests')
      .select('guest_contact_id, checked_in_at, reservations(start_time)')
      .in('guest_contact_id', contactIds)
      .not('checked_in_at', 'is', null);
    ((history || []) as unknown as Array<{ guest_contact_id: string; checked_in_at: string; reservations: { start_time: string } | null }>).forEach((h) => {
      const v = visits.get(h.guest_contact_id) || { count: 0, last: null };
      v.count += 1;
      const when = h.reservations?.start_time || h.checked_in_at;
      if (!v.last || when > v.last) v.last = when;
      visits.set(h.guest_contact_id, v);
    });
  }

  // Members now, by last 10 digits.
  const { data: members } = await supabaseAdmin.from('members').select('phone').not('phone', 'is', null);
  const memberPhones = new Set(((members || []) as Array<{ phone: string | null }>).map((m) => last10(m.phone)).filter(Boolean) as string[]);

  // Host names for member bookings without a name on the reservation.
  const hostIds = [...new Set(rows.filter((r) => !r.reservations?.first_name && r.reservations?.member_id).map((r) => r.reservations!.member_id!))];
  const hostNames = new Map<string, string>();
  if (hostIds.length) {
    const { data: hosts } = await supabaseAdmin.from('members').select('member_id, first_name, last_name').in('member_id', hostIds);
    ((hosts || []) as Array<{ member_id: string; first_name: string | null; last_name: string | null }>).forEach((h) =>
      hostNames.set(h.member_id, `${h.first_name || ''} ${h.last_name || ''}`.trim()),
    );
  }

  const out: GuestVisitRow[] = rows.map((r) => {
    const c = r.guest_contacts;
    const v = visits.get(r.guest_contact_id);
    const resv = r.reservations;
    return {
      id: r.id,
      reservation_id: r.reservation_id,
      guest_name: `${r.first_name_snapshot || c?.first_name || ''} ${c?.last_name || ''}`.trim(),
      phone: c?.phone || '',
      phone_display: formatPhoneDisplay(c?.phone),
      host_name: `${resv?.first_name || ''} ${resv?.last_name || ''}`.trim() || (resv?.member_id ? hostNames.get(resv.member_id) || '' : ''),
      location_name: r.locations?.name || '',
      reservation_start: resv?.start_time || '',
      checked_in: !!r.checked_in_at,
      visit_count: v?.count || 0,
      last_visit: v?.last || null,
      opted_out: !!c?.sms_opted_out_at,
      now_member: !!c && memberPhones.has(last10(c.phone) || ''),
      followed_up_at: r.followed_up_at,
      followed_up_by: r.followed_up_by,
      follow_up_note: r.follow_up_note,
    };
  });
  out.sort((a, b) => (a.reservation_start < b.reservation_start ? 1 : -1));

  if (format === 'csv') {
    const header = ['Guest', 'Phone', 'Host', 'Location', 'Date', 'Checked in', 'Visits', 'Last visit', 'Opted out', 'Now a member', 'Followed up', 'Followed up by', 'Note'];
    const fmt = (iso: string | null) => (iso ? DateTime.fromISO(iso, { zone: 'utc' }).setZone(tz).toFormat('yyyy-LL-dd h:mm a') : '');
    const lines = [header, ...out.map((r) => [
      r.guest_name, r.phone_display, r.host_name, r.location_name, fmt(r.reservation_start), r.checked_in ? 'yes' : 'no',
      r.visit_count, fmt(r.last_visit), r.opted_out ? 'yes' : 'no', r.now_member ? 'yes' : 'no', fmt(r.followed_up_at), r.followed_up_by || '', r.follow_up_note || '',
    ])].map((cells) => cells.map(csvCell).join(','));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="reservation-guests-${DateTime.now().setZone(tz).toFormat('yyyy-LL-dd')}.csv"`);
    return res.status(200).send(lines.join('\n'));
  }

  return res.status(200).json({ rows: out, truncated: rows.length >= MAX_ROWS });
}
