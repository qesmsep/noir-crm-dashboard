import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { getAdmin } from '@/lib/guestApi';

/**
 * GET   /api/admin/locations/[id]/guest-arrival
 * PATCH /api/admin/locations/[id]/guest-arrival  { address?, guest_arrival_instructions?, parking_instructions? }
 *
 * Per-venue guest info used in texts:
 *   address                     → {{location_address}}
 *   guest_arrival_instructions  → {{arrival_instructions}}
 *   parking_instructions        → {{parking_instructions}}
 */
const FIELDS = 'id, address, guest_arrival_instructions, parking_instructions';
const LIMITS: Record<string, number> = { address: 200, guest_arrival_instructions: 1000, parking_instructions: 1000 };
const LABELS: Record<string, string> = { address: 'Address', guest_arrival_instructions: 'How guests get in', parking_instructions: 'Parking' };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'PATCH') {
    res.setHeader('Allow', ['GET', 'PATCH']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!(await getAdmin(req))) return res.status(401).json({ error: 'Admin access required' });
  const id = String(req.query.id || '');

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin.from('locations').select(FIELDS).eq('id', id).maybeSingle();
    if (error) return res.status(500).json({ error: 'Could not load location guest info.' });
    if (!data) return res.status(404).json({ error: 'Location not found' });
    return res.status(200).json(data);
  }

  const patch: Record<string, string | null> = {};
  for (const key of Object.keys(LIMITS)) {
    const raw = req.body?.[key];
    if (raw === undefined) continue;
    if (raw !== null && typeof raw !== 'string') return res.status(400).json({ error: `${LABELS[key]} must be text.` });
    const text = raw == null ? null : raw.trim() || null;
    if (text && text.length > LIMITS[key]) {
      return res.status(400).json({ error: `${LABELS[key]}: keep it under ${LIMITS[key]} characters — it goes in a text message.` });
    }
    patch[key] = text;
  }
  if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'Nothing to update.' });

  const { data, error } = await supabaseAdmin.from('locations').update(patch).eq('id', id).select(FIELDS).maybeSingle();
  if (error) return res.status(500).json({ error: 'Could not save.' });
  if (!data) return res.status(404).json({ error: 'Location not found' });
  return res.status(200).json(data);
}
