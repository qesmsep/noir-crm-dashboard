import { supabase } from './supabase';

/**
 * Attach the signed-in admin's Supabase access token to every same-origin
 * /api/* request made from a Pages Router page (the whole /admin UI).
 *
 * The admin session lives in localStorage, not a cookie, so the server only
 * sees it when the caller sends `Authorization: Bearer <token>`. Most admin
 * screens never did; the API now refuses admin routes without it
 * (src/proxy.ts). Doing it once here means every existing fetch keeps
 * working without touching each call site. A caller that already sets
 * Authorization is left alone. Requests to other origins are untouched.
 */
export function installAdminFetchAuth() {
  if (typeof window === 'undefined') return;
  const w = window as typeof window & { __noirAdminFetchAuth?: boolean };
  if (w.__noirAdminFetchAuth || typeof w.fetch !== 'function') return;
  w.__noirAdminFetchAuth = true;

  const originalFetch = w.fetch.bind(w);

  w.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    try {
      const rawUrl =
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const url = new URL(rawUrl, w.location.origin);

      if (url.origin === w.location.origin && url.pathname.startsWith('/api/')) {
        const isRequest = typeof Request !== 'undefined' && input instanceof Request;
        const headers = new Headers(init?.headers ?? (isRequest ? (input as Request).headers : undefined));

        if (!headers.has('Authorization')) {
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (session?.access_token) {
            headers.set('Authorization', `Bearer ${session.access_token}`);
            if (isRequest) {
              return originalFetch(new Request(input as Request, { ...init, headers }));
            }
            return originalFetch(input, { ...init, headers });
          }
        }
      }
    } catch (error) {
      console.warn('Could not attach admin session to request:', error);
    }

    return originalFetch(input, init);
  };
}
