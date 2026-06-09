import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from './supabase';
import { rateLimiters } from './rate-limiter';

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

/**
 * Composed middleware that applies rate limiting BEFORE authentication.
 *
 * CRITICAL: Rate limiting must run before withAdminAuth to prevent
 * unauthenticated flood requests from exhausting the auth database.
 *
 * Usage:
 *   async function myHandler(req: AuthenticatedRequest, res: NextApiResponse) { ... }
 *   export default withRateLimitAndAuth(myHandler);
 *
 * SECURITY NOTE: Uses IP-based rate limiting (via x-forwarded-for header)
 * since this runs before authentication. This is best-effort DDoS protection.
 * For stronger guarantees, use Cloudflare rate limiting or Redis-backed limits.
 */
export function withRateLimitAndAuth(handler: AuthenticatedHandler) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Apply rate limiting BEFORE auth check
    const rateLimitPassed = await rateLimiters.standard.check(req);
    if (!rateLimitPassed) {
      const retryAfter = rateLimiters.standard.getRetryAfter(req);
      res.setHeader('Retry-After', retryAfter.toString());
      res.setHeader('X-RateLimit-Limit', '100');
      res.setHeader('X-RateLimit-Remaining', '0');
      return res.status(429).json({
        error: 'Too many requests',
        message: 'Please wait before making another request',
        retryAfter
      });
    }

    // Rate limit passed, proceed to auth check
    return withAdminAuth(handler)(req, res);
  };
}

/**
 * Stricter rate limit for expensive operations (AI vision, large file uploads, etc.)
 * Limits to 20 requests per minute to prevent cost abuse and resource exhaustion.
 *
 * Usage:
 *   export default withStrictRateLimitAndAuth(expensiveHandler);
 */
export function withStrictRateLimitAndAuth(handler: AuthenticatedHandler) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Apply strict rate limiting BEFORE auth check
    const rateLimitPassed = await rateLimiters.strict.check(req);
    if (!rateLimitPassed) {
      const retryAfter = rateLimiters.strict.getRetryAfter(req);
      res.setHeader('Retry-After', retryAfter.toString());
      res.setHeader('X-RateLimit-Limit', '20');
      res.setHeader('X-RateLimit-Remaining', '0');
      return res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded for this endpoint. Please wait before making another request',
        retryAfter
      });
    }

    // Rate limit passed, proceed to auth check
    return withAdminAuth(handler)(req, res);
  };
}
