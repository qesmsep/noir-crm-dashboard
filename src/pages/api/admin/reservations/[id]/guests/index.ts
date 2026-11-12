import type { NextApiRequest, NextApiResponse } from 'next';
import { addGuests, listGuests } from '@/lib/reservationGuests';
import { getAdmin, sendGuestError } from '@/lib/guestApi';

/**
 * GET  /api/admin/reservations/[id]/guests  — staff view (name, member/opt-out flags, check-in)
 * POST /api/admin/reservations/[id]/guests  — add guests as staff { guests: [...] }
 * Auth: admin Bearer token.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const admin = await getAdmin(req);
  if (!admin) return res.status(401).json({ error: 'Admin access required' });
  const reservationId = String(req.query.id || '');
  try {
    if (req.method === 'POST') {
      const guests = await addGuests(reservationId, Array.isArray(req.body?.guests) ? req.body.guests : [], { via: 'staff' });
      return res.status(201).json({ guests });
    }
    return res.status(200).json({ guests: await listGuests(reservationId, 'staff') });
  } catch (err) {
    return sendGuestError(res, err);
  }
}
