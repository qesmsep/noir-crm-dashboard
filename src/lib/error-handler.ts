import { NextApiResponse } from 'next';

export interface ApiError {
  error: string;
  errorCode?: string;
  requestId?: string;
  details?: any;
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
  badRequest(res: NextApiResponse, message: string, details?: any): void {
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
  internalError(res: NextApiResponse, error: any, userMessage?: string): void {
    // Log error for debugging
    console.error(`[${this.requestId}] Internal error:`, error);

    const response: ApiError = {
      error: userMessage || 'An unexpected error occurred. Please try again.',
      errorCode: 'INTERNAL_ERROR',
      requestId: this.requestId,
    };

    // Include error details in development
    if (this.isDevelopment) {
      response.details = {
        message: error?.message,
        stack: error?.stack,
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
  static logError(requestId: string, message: string, error?: any): void {
    if (error) {
      console.error(`[${requestId}] ${message}`, error);
    } else {
      console.error(`[${requestId}] ${message}`);
    }
  }
}
