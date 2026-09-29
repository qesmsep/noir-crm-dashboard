import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { classifyApiRequest } from './lib/api-access-policy';
import {
  isCronAuthorizedHeader,
  resolveAdmin,
  resolveMemberSession,
  secretsMatch,
} from './lib/admin-auth';
import { supabaseAdmin } from './lib/supabase';

/*
 * API choke point. Every /api/* request is classified by
 * src/lib/api-access-policy.ts (default: admin) and refused here unless the
 * caller proves that class. Routes keep their own checks on top of this.
 *
 * Proxy always runs on the Node.js runtime in Next 16, so the Supabase
 * lookups below use the same service client the API routes use.
 */

const CACHE_TTL_MS = 60_000;
const CACHE_MAX = 500;
// Positive results only, per credential, per instance. A revoked admin or an
// expired member session is refused again within CACHE_TTL_MS.
const verified = new Map<string, number>();

function cacheHit(key: string): boolean {
  const until = verified.get(key);
  if (until === undefined) return false;
  if (until < Date.now()) {
    verified.delete(key);
    return false;
  }
  return true;
}

function cacheSet(key: string) {
  if (verified.size >= CACHE_MAX) {
    const oldest = verified.keys().next().value;
    if (oldest !== undefined) verified.delete(oldest);
  }
  verified.set(key, Date.now() + CACHE_TTL_MS);
}

function bearerToken(request: NextRequest): string | undefined {
  const header = request.headers.get('authorization');
  return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
}

async function isAdmin(request: NextRequest): Promise<boolean> {
  const token = bearerToken(request);
  if (!token) return false;
  const key = `admin:${token}`;
  if (cacheHit(key)) return true;
  const admin = await resolveAdmin(token);
  if (admin) cacheSet(key);
  return !!admin;
}

function isInternal(request: NextRequest): boolean {
  return secretsMatch(request.headers.get('x-internal-secret'), process.env.CRON_SECRET);
}

async function hasMemberSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get('member_session')?.value;
  if (!token) return false;
  const key = `member:${token}`;
  if (cacheHit(key)) return true;
  const session = await resolveMemberSession(token);
  if (session) cacheSet(key);
  return !!session;
}

async function isSupabaseUser(request: NextRequest): Promise<boolean> {
  const token = bearerToken(request);
  if (!token) return false;
  const key = `user:${token}`;
  if (cacheHit(key)) return true;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  const ok = !error && !!data?.user;
  if (ok) cacheSet(key);
  return ok;
}

function deny(status: 401 | 403, message: string) {
  return NextResponse.json({ error: message }, { status });
}

async function guardApi(request: NextRequest) {
  const { access } = classifyApiRequest(request.nextUrl.pathname, request.method);

  try {
    switch (access) {
      case 'public':
        return NextResponse.next();

      case 'cron':
        return isCronAuthorizedHeader(request.headers.get('authorization'))
          ? NextResponse.next()
          : deny(401, 'Unauthorized');

      case 'member':
        if ((await hasMemberSession(request)) || (await isAdmin(request))) return NextResponse.next();
        return deny(401, 'Unauthorized');

      case 'member-supabase':
        if (
          (await hasMemberSession(request)) ||
          (await isAdmin(request)) ||
          (await isSupabaseUser(request))
        ) {
          return NextResponse.next();
        }
        return deny(401, 'Unauthorized');

      case 'admin':
      default:
        if (isInternal(request) || (await isAdmin(request))) return NextResponse.next();
        return deny(bearerToken(request) ? 403 : 401, bearerToken(request) ? 'Admin access required' : 'Unauthorized');
    }
  } catch (error) {
    console.error('[proxy] API auth check failed:', error);
    return deny(401, 'Unauthorized');
  }
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname === '/api' || pathname.startsWith('/api/')) {
    return guardApi(request);
  }

  const hostname = request.headers.get('host') || '';

  // Handle therooftopkc.com domain
  if (hostname.includes('therooftopkc.com')) {
    const url = request.nextUrl.clone();

    // If already on /rooftopkc path, continue normally
    if (url.pathname.startsWith('/rooftopkc')) {
      return NextResponse.next();
    }

    // If on root path, redirect to /rooftopkc
    if (url.pathname === '/' || url.pathname === '') {
      url.pathname = '/rooftopkc';
      return NextResponse.rewrite(url);
    }

    // For other paths, prepend /rooftopkc to maintain app functionality
    // (e.g., /member/login -> /rooftopkc/member/login isn't needed,
    //  keep member/admin paths as-is)
    return NextResponse.next();
  }

  // Handle noirkc.com or localhost - serve default homepage
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Every API route goes through the auth choke point above.
    '/api/:path*',
    /*
     * Page requests, except:
     * - api (handled by the matcher above)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images (public images)
     * - menu (menu images)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|images|menu).*)',
  ],
};
