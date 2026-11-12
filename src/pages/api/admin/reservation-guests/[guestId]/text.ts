import type { NextApiRequest, NextApiResponse } from 'next';
import { sendStaffGuestText } from '@/lib/reservationGuests';
import { getAdmin } from '@/lib/guestApi';

/**
 * POST /api/admin/reservation-guests/[guestId]/text  { content }
 * Staff text to a guest. Blocked if the guest opted out. Logged to
 * guest_messages with the reservation id and sent_by = the admin's email.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const admin = await getAdmin(req);
  if (!admin) return res.status(401).json({ error: 'Admin access required' });
  const result = await sendStaffGuestText(String(req.query.guestId || ''), req.body?.content, admin.email);
  if (!result.ok) return res.status(result.status).json({ error: result.error });
  return res.status(200).json({ success: true });
}
