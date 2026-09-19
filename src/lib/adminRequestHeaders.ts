import { supabase } from './supabase';

/**
 * JSON headers, plus the caller's admin session when there is one.
 *
 * Admin surfaces send this so the server can tell staff from a guest — a
 * back-dated reservation (a walk-in logged after the fact, a mistaken entry
 * re-entered) is refused for guests and allowed for staff.
 *
 * Best effort by design: a missing session costs the admin-only exemptions on
 * the server, it does not block an ordinary booking. A caller that *requires*
 * the credentials, such as a private-event override, checks for the
 * Authorization key itself and fails loudly.
 */
export async function adminRequestHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
  } catch (error) {
    console.warn('Could not attach admin session to request:', error);
  }

  return headers;
}
