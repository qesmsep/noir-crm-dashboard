/**
 * Centralized error logging for the member portal
 *
 * This utility logs errors to the console AND could be extended to:
 * - Send to external logging service (e.g., Sentry, LogRocket)
 * - Store in database for admin review
 * - Send alerts for critical errors
 */

export interface ErrorLogEntry {
  timestamp: string;
  level: 'error' | 'warning' | 'info';
  message: string;
  context?: {
    userId?: string;
    page?: string;
    action?: string;
    [key: string]: any;
  };
  error?: Error | unknown;
  stack?: string;
}

class ErrorLogger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  /**
   * Log an error with context
   */
  error(message: string, error?: Error | unknown, context?: ErrorLogEntry['context']) {
    const logEntry: ErrorLogEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      context,
      error,
      stack: error instanceof Error ? error.stack : undefined,
    };

    // Always log to console in development
    if (this.isDevelopment) {
      console.error('❌ [ErrorLogger]', message, {
        context,
        error,
        stack: logEntry.stack,
      });
    }

    // In production, log to console but could also send to external service
    if (!this.isDevelopment) {
      console.error('[ErrorLogger]', logEntry);

      // TODO: Send to external logging service
      // this.sendToLoggingService(logEntry);
    }

    // Log to API endpoint for database storage
    this.logToDatabase(logEntry);
  }

  /**
   * Log a warning
   */
  warning(message: string, context?: ErrorLogEntry['context']) {
    const logEntry: ErrorLogEntry = {
      timestamp: new Date().toISOString(),
      level: 'warning',
      message,
      context,
    };

    if (this.isDevelopment) {
      console.warn('⚠️ [ErrorLogger]', message, context);
    }

    // Could also log warnings to external service if needed
  }

  /**
   * Log info message
   */
  info(message: string, context?: ErrorLogEntry['context']) {
    const logEntry: ErrorLogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      context,
    };

    if (this.isDevelopment) {
      console.info('ℹ️ [ErrorLogger]', message, context);
    }
  }

  /**
   * Log to database via API
   */
  private async logToDatabase(logEntry: ErrorLogEntry) {
    try {
      // Only log errors to database, not warnings/info
      if (logEntry.level !== 'error') return;

      await fetch('/api/member/log-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: logEntry.message,
          level: logEntry.level,
          context: logEntry.context,
          error_details: logEntry.error instanceof Error
            ? { name: logEntry.error.name, message: logEntry.error.message }
            : String(logEntry.error),
          stack_trace: logEntry.stack,
          timestamp: logEntry.timestamp,
        }),
      });
    } catch (err) {
      // Don't throw if logging fails - just console.error
      console.error('Failed to log error to database:', err);
    }
  }

  /**
   * Format error for user display
   */
  getUserFriendlyMessage(error: unknown): string {
    if (error instanceof Error) {
      // Check for specific error types
      if (error.message.includes('fetch')) {
        return 'Network error. Please check your connection and try again.';
      }
      if (error.message.includes('timeout')) {
        return 'Request timed out. Please try again.';
      }
      if (error.message.includes('session')) {
        return 'Your session has expired. Please log in again.';
      }
      if (error.message.includes('not found')) {
        return 'The requested resource was not found.';
      }

      // Return original message if it's user-friendly
      return error.message;
    }

    return 'An unexpected error occurred. Please try again or contact support.';
  }

  /**
   * Check if error is a network error
   */
  isNetworkError(error: unknown): boolean {
    if (error instanceof Error) {
      return error.message.includes('fetch') ||
             error.message.includes('network') ||
             error.message.includes('Failed to fetch');
    }
    return false;
  }

  /**
   * Check if error is an authentication error
   */
  isAuthError(error: unknown): boolean {
    if (error instanceof Error) {
      return error.message.includes('session') ||
             error.message.includes('authentication') ||
             error.message.includes('unauthorized') ||
             error.message.includes('401');
    }
    return false;
  }
}

export const errorLogger = new ErrorLogger();

/**
 * Wrapper for API calls with automatic error logging
 */
export async function withErrorLogging<T>(
  operation: () => Promise<T>,
  context: ErrorLogEntry['context']
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    errorLogger.error('API call failed', error, context);
    throw error;
  }
}

/**
 * HOC for error boundary logging
 */
export function logComponentError(
  componentName: string,
  error: Error,
  errorInfo: { componentStack: string }
) {
  errorLogger.error(`Component error in ${componentName}`, error, {
    component: componentName,
    componentStack: errorInfo.componentStack,
  });
}
