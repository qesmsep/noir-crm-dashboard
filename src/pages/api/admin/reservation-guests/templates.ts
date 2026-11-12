import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { GUEST_KINDS } from '@/lib/reservationGuests';
import { getAdmin } from '@/lib/guestApi';

/**
 * GET /api/admin/reservation-guests/templates
 * PUT /api/admin/reservation-guests/templates  { kind, body?, is_active?, send_offset_minutes? }
 * The four reservation-guest texts, edited on Campaigns → Reservation guests.
 * Auth: admin Bearer token.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'PUT') {
    res.setHeader('Allow', ['GET', 'PUT']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!(await getAdmin(req))) return res.status(401).json({ error: 'Admin access required' });

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('guest_message_templates')
      .select('kind, body, is_active, send_offset_minutes, updated_at');
    if (error) return res.status(500).json({ error: 'Guest texts need the reservation-guests migration applied.' });
    const order = new Map(GUEST_KINDS.map((k, i) => [k, i]));
    return res.status(200).json({ templates: (data || []).sort((a, b) => (order.get(a.kind) ?? 9) - (order.get(b.kind) ?? 9)) });
  }

  const { kind, body, is_active, send_offset_minutes } = req.body || {};
  if (!GUEST_KINDS.includes(kind)) return res.status(400).json({ error: 'Unknown message kind.' });
  const patch: Record<string, unknown> = {};
  if (body !== undefined) {
    const text = String(body).trim();
    if (!text) return res.status(400).json({ error: 'Message cannot be empty.' });
    if (text.length > 480) return res.status(400).json({ error: 'Message is too long (480 characters max).' });
    patch.body = text;
  }
  if (is_active !== undefined) patch.is_active = !!is_active;
  if (send_offset_minutes !== undefined) {
    if (kind !== 'day_of') return res.status(400).json({ error: 'Only the day-of text has a send time.' });
    const n = Number(send_offset_minutes);
    if (!Number.isInteger(n) || n < 0 || n > 1440) return res.status(400).json({ error: 'Send time must be 0–1440 minutes before.' });
    patch.send_offset_minutes = n;
  }
  if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'Nothing to update.' });

  const { data, error } = await supabaseAdmin
    .from('guest_message_templates')
    .update(patch)
    .eq('kind', kind)
    .select('kind, body, is_active, send_offset_minutes, updated_at')
    .single();
  if (error) return res.status(500).json({ error: 'Could not save the message.' });
  return res.status(200).json({ template: data });
}
