import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { getAdmin } from '@/lib/guestApi';

/**
 * GET   /api/admin/locations/[id]/guest-arrival
 * PATCH /api/admin/locations/[id]/guest-arrival  { guest_arrival_instructions }
 * How reservation guests get in, per venue ({{arrival_instructions}} in guest texts).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'PATCH') {
    res.setHeader('Allow', ['GET', 'PATCH']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!(await getAdmin(req))) return res.status(401).json({ error: 'Admin access required' });
  const id = String(req.query.id || '');

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin.from('locations').select('id, guest_arrival_instructions').eq('id', id).maybeSingle();
    if (error) return res.status(500).json({ error: 'Needs the reservation-guests migration applied.' });
    if (!data) return res.status(404).json({ error: 'Location not found' });
    return res.status(200).json(data);
  }

  const raw = req.body?.guest_arrival_instructions;
  const text = raw == null ? null : String(raw).trim() || null;
  if (text && text.length > 200) return res.status(400).json({ error: 'Keep it under 200 characters — it goes in a text message.' });
  const { data, error } = await supabaseAdmin
    .from('locations')
    .update({ guest_arrival_instructions: text })
    .eq('id', id)
    .select('id, guest_arrival_instructions')
    .maybeSingle();
  if (error) return res.status(500).json({ error: 'Could not save.' });
  if (!data) return res.status(404).json({ error: 'Location not found' });
  return res.status(200).json(data);
}
