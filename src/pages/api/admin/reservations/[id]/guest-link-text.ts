import type { NextApiRequest, NextApiResponse } from 'next';
import { textGuestLinkToMember } from '@/lib/memberGuestLink';
import { getAdmin } from '@/lib/guestApi';

/**
 * POST /api/admin/reservations/[id]/guest-link-text
 * Texts the host the add-guests link using the "Member guest link" message
 * from the Campaigns trigger "Staff Texts Guest Link". Auth: admin Bearer token.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const admin = await getAdmin(req);
  if (!admin) return res.status(401).json({ error: 'Admin access required' });
  const result = await textGuestLinkToMember(String(req.query.id || ''), admin.email);
  if (!result.ok) return res.status(result.status).json({ error: result.error });
  return res.status(200).json({ success: true, url: result.url });
}
