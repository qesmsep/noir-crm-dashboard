import { supabase } from './supabase';

/**
 * Build auth headers (Bearer token) for admin-protected API routes from the
 * current Supabase session. Returns an empty object when there is no session,
 * letting the server respond with 401 rather than throwing client-side.
 *
 * Shared by all client components that call admin-protected endpoints so the
 * token-attaching logic lives in exactly one place.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};
}
