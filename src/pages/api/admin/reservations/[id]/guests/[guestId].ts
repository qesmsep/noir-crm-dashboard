import type { NextApiRequest, NextApiResponse } from 'next';
import { listGuests, removeGuest, setGuestCheckedIn, stopGuestTexts, updateGuest } from '@/lib/reservationGuests';
import { getAdmin, sendGuestError } from '@/lib/guestApi';

/**
 * PATCH  /api/admin/reservations/[id]/guests/[guestId]  { first_name?, last_name?, checked_in?, stop_texts? }
 *        stop_texts: true stops every guest text to this guest's phone (like STOP).
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
      const { first_name, last_name, checked_in, stop_texts } = req.body || {};
      if (typeof checked_in === 'boolean') await setGuestCheckedIn(reservationId, guestId, checked_in);
      if (first_name !== undefined || last_name !== undefined) {
        await updateGuest(reservationId, guestId, { first_name, last_name }, { via: 'staff' });
      }
      // Last, so a failed name or check-in change doesn't leave texts stopped behind an error.
      if (stop_texts === true) await stopGuestTexts(reservationId, guestId);
    }
    return res.status(200).json({ guests: await listGuests(reservationId, 'staff') });
  } catch (err) {
    return sendGuestError(res, err);
  }
}
