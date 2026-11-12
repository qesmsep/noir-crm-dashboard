import type { NextApiRequest, NextApiResponse } from 'next';
import { listGuests, removeGuest, setGuestCheckedIn, updateGuest } from '@/lib/reservationGuests';
import { getAdmin, sendGuestError } from '@/lib/guestApi';

/**
 * PATCH  /api/admin/reservations/[id]/guests/[guestId]  { first_name?, last_name?, checked_in? }
 * DELETE /api/admin/reservations/[id]/guests/[guestId]
 * Auth: admin Bearer token.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH' && req.method !== 'DELETE') {
    res.setHeader('Allow', ['PATCH', 'DELETE']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const admin = await getAdmin(req);
  if (!admin) return res.status(401).json({ error: 'Admin access required' });
  const reservationId = String(req.query.id || '');
  const guestId = String(req.query.guestId || '');
  try {
    if (req.method === 'DELETE') {
      await removeGuest(reservationId, guestId);
    } else {
      const { first_name, last_name, checked_in } = req.body || {};
      if (typeof checked_in === 'boolean') await setGuestCheckedIn(reservationId, guestId, checked_in);
      if (first_name !== undefined || last_name !== undefined) {
        await updateGuest(reservationId, guestId, { first_name, last_name }, { via: 'staff' });
      }
    }
    return res.status(200).json({ guests: await listGuests(reservationId, 'staff') });
  } catch (err) {
    return sendGuestError(res, err);
  }
}
