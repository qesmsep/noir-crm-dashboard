import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { parse, serialize } from 'cookie';
import { getSessionCookieDomain } from '@/lib/security';

/**
 * Logout endpoint - clears session cookie and deletes session from database
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get session from cookie
    const cookies = parse(req.headers.cookie || '');
    const sessionToken = cookies.member_session;

    if (sessionToken) {
      // Delete session from database
      await supabaseAdmin
        .from('member_portal_sessions')
        .delete()
        .eq('session_token', sessionToken);
    }

    // Clear the cookie, both host-only and on the site domain it was set with
    const clearOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 0, // Expire immediately
      path: '/',
    };
    const cookieDomain = getSessionCookieDomain(req.headers.host);
    res.setHeader('Set-Cookie', [
      serialize('member_session', '', clearOptions),
      ...(cookieDomain ? [serialize('member_session', '', { ...clearOptions, domain: cookieDomain })] : []),
    ]);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
