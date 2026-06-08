import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from './supabase';

/**
 * Authenticated user attached to the request by withAdminAuth.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  access_level: string;
}

/**
 * A NextApiRequest that has passed admin authentication and carries the
 * resolved admin user.
 */
export interface AuthenticatedRequest extends NextApiRequest {
  user?: AuthenticatedUser;
}

type AuthenticatedHandler = (
  req: AuthenticatedRequest,
  res: NextApiResponse
) => unknown | Promise<unknown>;

/**
 * Higher-order handler that enforces admin authentication.
 *
 * Authentication uses a Bearer token in the Authorization header (the same
 * pattern used across the admin API). The token is validated against Supabase
 * Auth and the user must exist as an active row in the `admins` table.
 *
 * On success the resolved admin user is attached to `req.user` and the wrapped
 * handler is invoked. Otherwise a 401/403 response is returned.
 */
export function withAdminAuth(handler: AuthenticatedHandler) {
  return async (req: AuthenticatedRequest, res: NextApiResponse) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const {
        data: { user },
        error: authError,
      } = await supabaseAdmin.auth.getUser(token);

      if (authError || !user) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      const { data: admin } = await supabaseAdmin
        .from('admins')
        .select('access_level')
        .eq('auth_user_id', user.id)
        .eq('status', 'active')
        .single();

      if (!admin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      req.user = {
        id: user.id,
        email: user.email || '',
        access_level: admin.access_level,
      };

      return await handler(req, res);
    } catch (err) {
      console.error('Authentication error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
}
