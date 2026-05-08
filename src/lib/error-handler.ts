import { NextApiResponse } from 'next';

export interface ApiError {
  error: string;
  errorCode?: string;
  requestId?: string;
  details?: Record<string, unknown>;
}

/**
 * Set CORS headers, failing closed in production.
 *
 * Uses ALLOWED_ORIGIN env var when set, falls back to NEXT_PUBLIC_SITE_URL,
 * and defaults to '*' only in non-production environments. In production
 * without either env var no CORS header is emitted (same-origin requests
 * work without it, and a wildcard would allow any origin).
 */
export function setCorsHeaders(res: NextApiResponse, methods: string): void {
  const origin =
    process.env.ALLOWED_ORIGIN ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NODE_ENV !== 'production' ? '*' : null);

  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

/**
 * Standardized error responses for API endpoints
 */
export class ApiErrorHandler {
  private isDevelopment: boolean;
  private requestId: string;

  constructor(requestId: string) {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.requestId = requestId;
  }

  /**
   * Handle 400 Bad Request errors
   */
  badRequest(res: NextApiResponse, message: string, details?: Record<string, unknown>): void {
    const response: ApiError = {
      error: message,
      errorCode: 'BAD_REQUEST',
      requestId: this.requestId,
    };

    if (this.isDevelopment && details) {
      response.details = details;
    }

    res.status(400).json(response);
  }

  /**
   * Handle 401 Unauthorized errors
   */
  unauthorized(res: NextApiResponse, message: string = 'Unauthorized'): void {
    res.status(401).json({
      error: message,
      errorCode: 'UNAUTHORIZED',
      requestId: this.requestId,
    });
  }

  /**
   * Handle 403 Forbidden errors
   */
  forbidden(res: NextApiResponse, message: string = 'Forbidden: Admin access required'): void {
    res.status(403).json({
      error: message,
      errorCode: 'FORBIDDEN',
      requestId: this.requestId,
    });
  }

  /**
   * Handle 404 Not Found errors
   */
  notFound(res: NextApiResponse, resource: string): void {
    res.status(404).json({
      error: `${resource} not found`,
      errorCode: 'NOT_FOUND',
      requestId: this.requestId,
    });
  }

  /**
   * Handle 429 Too Many Requests errors
   */
  tooManyRequests(res: NextApiResponse, retryAfter?: number): void {
    const response: ApiError = {
      error: 'Too many requests. Please try again later.',
      errorCode: 'RATE_LIMIT_EXCEEDED',
      requestId: this.requestId,
    };

    if (retryAfter) {
      res.setHeader('Retry-After', retryAfter.toString());
    }

    res.status(429).json(response);
  }

  /**
   * Handle 500 Internal Server Error
   */
  internalError(res: NextApiResponse, error: unknown, userMessage?: string): void {
    // Log error for debugging
    console.error(`[${this.requestId}] Internal error:`, error);

    const response: ApiError = {
      error: userMessage || 'An unexpected error occurred. Please try again.',
      errorCode: 'INTERNAL_ERROR',
      requestId: this.requestId,
    };

    // Include error details in development
    if (this.isDevelopment && error instanceof Error) {
      response.details = {
        message: error.message,
        stack: error.stack,
      };
    }

    res.status(500).json(response);
  }

  /**
   * Log info message with request ID
   */
  static log(requestId: string, message: string, data?: any): void {
    if (data) {
      console.log(`[${requestId}] ${message}`, data);
    } else {
      console.log(`[${requestId}] ${message}`);
    }
  }

  /**
   * Log error message with request ID
   */
  static logError(requestId: string, message: string, error?: unknown): void {
    if (error) {
      console.error(`[${requestId}] ${message}`, error);
    } else {
      console.error(`[${requestId}] ${message}`);
    }
  }
}
