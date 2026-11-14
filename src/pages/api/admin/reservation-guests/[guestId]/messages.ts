import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { getAdmin } from '@/lib/guestApi';

/**
 * GET /api/admin/reservation-guests/[guestId]/messages
 * Texts sent to this guest's phone (all visits), newest first, from guest_messages.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!(await getAdmin(req))) return res.status(401).json({ error: 'Admin access required' });

  const { data: guest } = await supabaseAdmin
    .from('reservation_guests')
    .select('id, guest_contacts(phone)')
    .eq('id', String(req.query.guestId || ''))
    .maybeSingle();
  const contact = guest && (Array.isArray(guest.guest_contacts) ? guest.guest_contacts[0] : guest.guest_contacts);
  if (!contact?.phone) return res.status(404).json({ error: 'Guest not found' });

  const { data, error } = await supabaseAdmin
    .from('guest_messages')
    .select('id, content, sent_by, status, error_message, timestamp, created_at, reservation_id')
    .eq('phone', contact.phone)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return res.status(500).json({ error: 'Could not load messages.' });
  return res.status(200).json({ messages: data || [] });
}
