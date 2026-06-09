import type { NextApiRequest } from 'next';

/**
 * Simple in-memory sliding-window rate limiter for API routes.
 *
 * ⚠️ LIMITATION IN SERVERLESS DEPLOYMENTS (Vercel, AWS Lambda, etc.):
 * This implementation stores state in a Map on the module instance. In serverless
 * environments, each invocation may be a fresh cold start with empty state, meaning
 * rate limiting effectiveness is reduced in production serverless deployments.
 *
 * MITIGATION STRATEGY:
 * - All endpoints require admin authentication (reduces attack surface significantly)
 * - Expensive operations (e.g., /api/inventory/scan) use Vercel platform-level rate
 *   limiting via vercel.json (see rateLimit config for scan.ts)
 * - Vercel provides built-in DDoS protection and Supabase has auth rate limiting
 * - This provides defense-in-depth for authenticated admin-only endpoints
 *
 * For public-facing APIs or higher security requirements, consider:
 * - Redis/Upstash-backed distributed rate limiter
 * - Vercel Edge Middleware with KV storage
 * - Cloudflare rate limiting at CDN layer
 */
interface RateLimiterOptions {
  /** Maximum number of requests allowed within the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

interface RequestRecord {
  count: number;
  resetAt: number;
}

/**
 * Derive a client identifier from the request. Prefers the forwarded client
 * IP, falling back to the socket address.
 *
 * SECURITY NOTE: On Vercel, x-vercel-forwarded-for is automatically populated
 * by the edge and cannot be spoofed by clients. We prioritize this over
 * x-forwarded-for which can be spoofed. For authenticated routes, prefer using
 * a custom key (e.g., user.id) by passing it to check() and getRetryAfter().
 */
function getClientKey(req: NextApiRequest): string {
  // Vercel sets x-vercel-forwarded-for which is trusted and can't be spoofed
  const vercelForwarded = req.headers['x-vercel-forwarded-for'];
  if (typeof vercelForwarded === 'string' && vercelForwarded.length > 0) {
    return vercelForwarded.split(',')[0].trim();
  }
  if (Array.isArray(vercelForwarded) && vercelForwarded.length > 0) {
    return vercelForwarded[0];
  }

  // Fall back to x-forwarded-for (can be spoofed, but better than nothing)
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0];
  }

  return req.socket?.remoteAddress || 'unknown';
}

class RateLimiter {
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly hits = new Map<string, RequestRecord>();
  private lastCleanup = Date.now();
  private readonly cleanupIntervalMs = 60 * 1000; // Clean up every minute

  constructor(options: RateLimiterOptions) {
    this.limit = options.limit;
    this.windowMs = options.windowMs;
  }

  /**
   * Remove expired entries to prevent memory leak
   */
  private cleanup(): void {
    const now = Date.now();

    // Only run cleanup periodically to avoid overhead on every request
    if (now - this.lastCleanup < this.cleanupIntervalMs) {
      return;
    }

    for (const [key, record] of this.hits.entries()) {
      if (now > record.resetAt) {
        this.hits.delete(key);
      }
    }

    this.lastCleanup = now;
  }

  /**
   * Returns true if the request is within the allowed rate, false otherwise.
   * @param req - The request object
   * @param customKey - Optional custom key (e.g., user ID) instead of IP-based key
   */
  async check(req: NextApiRequest, customKey?: string): Promise<boolean> {
    const key = customKey || getClientKey(req);
    const now = Date.now();

    // Periodically clean up expired entries
    this.cleanup();

    const record = this.hits.get(key);

    if (!record || now > record.resetAt) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    if (record.count >= this.limit) {
      return false;
    }

    record.count += 1;
    return true;
  }

  /**
   * Returns the number of seconds the client should wait before retrying.
   * @param req - The request object
   * @param customKey - Optional custom key (e.g., user ID) instead of IP-based key
   */
  getRetryAfter(req: NextApiRequest, customKey?: string): number {
    const key = customKey || getClientKey(req);
    const record = this.hits.get(key);
    if (!record) return 0;
    return Math.max(0, Math.ceil((record.resetAt - Date.now()) / 1000));
  }
}

/**
 * Shared rate limiter instances for use across API routes.
 */
export const rateLimiters = {
  /** Standard API rate limit: 100 requests per minute per client. */
  standard: new RateLimiter({ limit: 100, windowMs: 60 * 1000 }),
  /** Stricter limit for sensitive/expensive operations. */
  strict: new RateLimiter({ limit: 20, windowMs: 60 * 1000 }),
};
