import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { getAdmin } from '@/lib/guestApi';

/**
 * PATCH /api/admin/reservation-guests/[guestId]/follow-up  { followed_up: boolean, note?: string }
 * Sets / clears followed_up_at, followed_up_by (admin email), follow_up_note.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', ['PATCH']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const admin = await getAdmin(req);
  if (!admin) return res.status(401).json({ error: 'Admin access required' });

  const { followed_up, note } = req.body || {};
  const noteText = note == null ? null : String(note).trim().slice(0, 1000) || null;
  const patch = followed_up
    ? { followed_up_at: new Date().toISOString(), followed_up_by: admin.email, follow_up_note: noteText }
    : { followed_up_at: null, followed_up_by: null, follow_up_note: noteText };

  const { data, error } = await supabaseAdmin
    .from('reservation_guests')
    .update(patch)
    .eq('id', String(req.query.guestId || ''))
    .select('id, followed_up_at, followed_up_by, follow_up_note')
    .maybeSingle();
  if (error) return res.status(500).json({ error: 'Could not save.' });
  if (!data) return res.status(404).json({ error: 'Guest not found' });
  return res.status(200).json(data);
}
