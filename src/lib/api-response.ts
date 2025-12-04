import { NextApiResponse } from 'next';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/**
 * Standard API response formats for consistency across the application
 */

export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    [key: string]: any;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: any;
    requestId?: string;
  };
}

/**
 * Standardized API response utility for consistent error and success responses
 */
export class ApiResponse {
  /**
   * Success response - 200 OK
   */
  static success<T = any>(
    res: NextApiResponse,
    data: T,
    message?: string,
    meta?: any
  ): void {
    const response: ApiSuccessResponse<T> = {
      success: true,
      data,
      ...(message && { message }),
      ...(meta && { meta }),
    };
    res.status(200).json(response);
  }

  /**
   * Created response - 201 Created
   */
  static created<T = any>(
    res: NextApiResponse,
    data: T,
    message: string = 'Resource created successfully'
  ): void {
    const response: ApiSuccessResponse<T> = {
      success: true,
      data,
      message,
    };
    res.status(201).json(response);
  }

  /**
   * No content response - 204 No Content
   */
  static noContent(res: NextApiResponse): void {
    res.status(204).end();
  }

  /**
   * Bad request error - 400
   */
  static badRequest(
    res: NextApiResponse,
    message: string = 'Bad request',
    details?: any,
    requestId?: string
  ): void {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        message,
        code: 'BAD_REQUEST',
        ...(details && { details }),
        ...(requestId && { requestId }),
      },
    };
    res.status(400).json(response);
  }

  /**
   * Unauthorized error - 401
   */
  static unauthorized(
    res: NextApiResponse,
    message: string = 'Unauthorized access',
    requestId?: string
  ): void {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        message,
        code: 'UNAUTHORIZED',
        ...(requestId && { requestId }),
      },
    };
    res.status(401).json(response);
  }

  /**
   * Forbidden error - 403
   */
  static forbidden(
    res: NextApiResponse,
    message: string = 'Access forbidden',
    requestId?: string
  ): void {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        message,
        code: 'FORBIDDEN',
        ...(requestId && { requestId }),
      },
    };
    res.status(403).json(response);
  }

  /**
   * Not found error - 404
   */
  static notFound(
    res: NextApiResponse,
    message: string = 'Resource not found',
    requestId?: string
  ): void {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        message,
        code: 'NOT_FOUND',
        ...(requestId && { requestId }),
      },
    };
    res.status(404).json(response);
  }

  /**
   * Method not allowed error - 405
   */
  static methodNotAllowed(
    res: NextApiResponse,
    allowedMethods?: string[],
    requestId?: string
  ): void {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        message: 'Method not allowed',
        code: 'METHOD_NOT_ALLOWED',
        ...(allowedMethods && { details: { allowedMethods } }),
        ...(requestId && { requestId }),
      },
    };
    res.status(405).json(response);
    if (allowedMethods) {
      res.setHeader('Allow', allowedMethods.join(', '));
    }
  }

  /**
   * Validation error - 422
   */
  static validationError(
    res: NextApiResponse,
    errors: any,
    message: string = 'Validation failed',
    requestId?: string
  ): void {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        message,
        code: 'VALIDATION_ERROR',
        details: errors,
        ...(requestId && { requestId }),
      },
    };
    res.status(422).json(response);
  }

  /**
   * Rate limit exceeded - 429
   */
  static rateLimitExceeded(
    res: NextApiResponse,
    retryAfter?: number,
    requestId?: string
  ): void {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        message: 'Rate limit exceeded. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        ...(retryAfter && { details: { retryAfter } }),
        ...(requestId && { requestId }),
      },
    };
    res.status(429).json(response);
    if (retryAfter) {
      res.setHeader('Retry-After', retryAfter.toString());
    }
  }

  /**
   * Internal server error - 500
   */
  static internalError(
    res: NextApiResponse,
    message: string = 'Internal server error',
    error?: any,
    requestId?: string
  ): void {
    // Log the actual error for debugging
    if (error) {
      console.error('[API Error]', {
        message,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        requestId,
      });
    }

    const response: ApiErrorResponse = {
      success: false,
      error: {
        message,
        code: 'INTERNAL_ERROR',
        ...(requestId && { requestId }),
        // Only include error details in development
        ...(process.env.NODE_ENV === 'development' &&
          error && {
            details: error instanceof Error ? error.message : error,
          }),
      },
    };
    res.status(500).json(response);
  }

  /**
   * Service unavailable - 503
   */
  static serviceUnavailable(
    res: NextApiResponse,
    message: string = 'Service temporarily unavailable',
    retryAfter?: number,
    requestId?: string
  ): void {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        message,
        code: 'SERVICE_UNAVAILABLE',
        ...(retryAfter && { details: { retryAfter } }),
        ...(requestId && { requestId }),
      },
    };
    res.status(503).json(response);
    if (retryAfter) {
      res.setHeader('Retry-After', retryAfter.toString());
    }
  }

  /**
   * Generic error handler - automatically determines appropriate response
   */
  static error(
    res: NextApiResponse,
    error: unknown,
    requestId?: string
  ): void {
    // Handle Zod validation errors
    if (error instanceof ZodError) {
      return ApiResponse.validationError(
        res,
        error.issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
        'Validation failed',
        requestId
      );
    }

    // Handle known error types
    if (error instanceof Error) {
      const message = error.message;

      // Check for specific error patterns
      if (message.includes('not found')) {
        return ApiResponse.notFound(res, message, requestId);
      }
      if (message.includes('unauthorized') || message.includes('not authenticated')) {
        return ApiResponse.unauthorized(res, message, requestId);
      }
      if (message.includes('forbidden') || message.includes('not authorized')) {
        return ApiResponse.forbidden(res, message, requestId);
      }

      // Default to internal error
      return ApiResponse.internalError(res, 'An unexpected error occurred', error, requestId);
    }

    // Unknown error type
    return ApiResponse.internalError(
      res,
      'An unexpected error occurred',
      error,
      requestId
    );
  }
}

/**
 * Next.js App Router response utilities
 */
export class AppRouterResponse {
  static success<T = any>(data: T, status: number = 200, message?: string) {
    return NextResponse.json(
      {
        success: true,
        data,
        ...(message && { message }),
      } as ApiSuccessResponse<T>,
      { status }
    );
  }

  static error(message: string, status: number = 500, code?: string, details?: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message,
          ...(code && { code }),
          ...(details && { details }),
        },
      } as ApiErrorResponse,
      { status }
    );
  }

  static badRequest(message: string = 'Bad request', details?: any) {
    return AppRouterResponse.error(message, 400, 'BAD_REQUEST', details);
  }

  static unauthorized(message: string = 'Unauthorized') {
    return AppRouterResponse.error(message, 401, 'UNAUTHORIZED');
  }

  static forbidden(message: string = 'Forbidden') {
    return AppRouterResponse.error(message, 403, 'FORBIDDEN');
  }

  static notFound(message: string = 'Not found') {
    return AppRouterResponse.error(message, 404, 'NOT_FOUND');
  }

  static methodNotAllowed(allowedMethods: string[]) {
    return new NextResponse(
      JSON.stringify({
        success: false,
        error: {
          message: 'Method not allowed',
          code: 'METHOD_NOT_ALLOWED',
          details: { allowedMethods },
        },
      } as ApiErrorResponse),
      {
        status: 405,
        headers: {
          'Allow': allowedMethods.join(', '),
          'Content-Type': 'application/json',
        },
      }
    );
  }

  static validationError(errors: any, message: string = 'Validation failed') {
    return AppRouterResponse.error(message, 422, 'VALIDATION_ERROR', errors);
  }

  static internalError(message: string = 'Internal server error', error?: any) {
    if (error) {
      console.error('[App Router Error]', {
        message,
        error: error instanceof Error ? error.message : error,
      });
    }
    return AppRouterResponse.error(message, 500, 'INTERNAL_ERROR');
  }
}
