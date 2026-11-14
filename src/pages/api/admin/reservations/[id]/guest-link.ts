import type { NextApiRequest, NextApiResponse } from 'next';
import { ensureGuestLink } from '@/lib/guestLink';
import { getAdmin, guestLinkUrl } from '@/lib/guestApi';

/**
 * POST /api/admin/reservations/[id]/guest-link
 * Creates (or returns the current) no-login add-guests link for a reservation.
 * Auth: admin Bearer token.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!(await getAdmin(req))) return res.status(401).json({ error: 'Admin access required' });
  const link = await ensureGuestLink(String(req.query.id || ''));
  if (!link.ok) return res.status(link.status).json({ error: link.error });
  return res.status(link.created ? 201 : 200).json({ url: guestLinkUrl(link.token), expires_at: link.expiresAt });
}
