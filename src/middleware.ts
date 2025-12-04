import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

/**
 * Global middleware for Next.js App Router
 * Adds request ID tracking and basic security headers
 */
export function middleware(request: NextRequest) {
  const requestId = uuidv4();
  const startTime = Date.now();

  // Clone the request headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);
  requestHeaders.set('x-request-start', startTime.toString());

  // Create response with modified headers
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Add security and tracking headers to response
  response.headers.set('x-request-id', requestId);
  response.headers.set('x-frame-options', 'DENY');
  response.headers.set('x-content-type-options', 'nosniff');
  response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  response.headers.set('x-xss-protection', '1; mode=block');

  // Add performance timing header
  const duration = Date.now() - startTime;
  response.headers.set('x-response-time', `${duration}ms`);

  // Log request in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[${requestId}] ${request.method} ${request.nextUrl.pathname} - ${duration}ms`);
  }

  return response;
}

/**
 * Configure which routes to run middleware on
 * Exclude static files and internal Next.js routes
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*$).*)',
  ],
};
