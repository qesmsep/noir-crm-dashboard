'use client';

import { useEffect } from 'react';

/**
 * Global error handler to catch unhandled promise rejections
 * and provide detailed debugging information
 */
export default function GlobalErrorHandler() {
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('🔴 [Unhandled Promise Rejection]', {
        reason: event.reason,
        promise: event.promise,
        stack: event.reason?.stack,
        message: event.reason?.message,
        type: typeof event.reason,
      });

      // Log the full stack trace if available
      if (event.reason instanceof Error) {
        console.error('Stack trace:', event.reason.stack);
      }

      // Prevent default to avoid the error being swallowed
      // event.preventDefault(); // Commented out to let Next.js handle it
    };

    const handleError = (event: ErrorEvent) => {
      console.error('🔴 [Global Error]', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
        stack: event.error?.stack,
      });
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  return null;
}
