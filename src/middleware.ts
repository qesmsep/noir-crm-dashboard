import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
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
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images (public images)
     * - menu (menu images)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|images|menu).*)',
  ],
};
