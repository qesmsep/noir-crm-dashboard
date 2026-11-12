import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { getAdmin } from '@/lib/guestApi';

/**
 * GET /api/admin/reservation-guests/names?ids=uuid,uuid,...
 * → { names: { [reservationId]: ['Ava', 'Bo'] } }  (active guests, first names only)
 * For the door views (day drawer, timeline). Auth: admin Bearer token.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!(await getAdmin(req))) return res.status(401).json({ error: 'Admin access required' });

  const ids = String(req.query.ids || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => UUID.test(s))
    .slice(0, 500);
  if (ids.length === 0) return res.status(200).json({ names: {} });

  const { data, error } = await supabaseAdmin
    .from('reservation_guests')
    .select('reservation_id, first_name_snapshot, created_at, guest_contacts(first_name)')
    .in('reservation_id', ids)
    .eq('status', 'active')
    .order('created_at', { ascending: true });
  if (error) return res.status(200).json({ names: {} }); // table not there yet: show nothing

  const names: Record<string, string[]> = {};
  (data || []).forEach((g: { reservation_id: string; first_name_snapshot: string | null; guest_contacts: unknown }) => {
    const contact = Array.isArray(g.guest_contacts) ? g.guest_contacts[0] : g.guest_contacts;
    const name = g.first_name_snapshot || (contact as { first_name?: string } | null)?.first_name;
    if (!name) return;
    (names[g.reservation_id] ||= []).push(name);
  });
  return res.status(200).json({ names });
}
