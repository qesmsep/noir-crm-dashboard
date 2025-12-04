/**
 * Debug Logger Utility
 * Logs to both browser console and server terminal (via API endpoint)
 */

type LogLevel = 'info' | 'warn' | 'error' | 'nav' | 'setup';

interface LogData {
  [key: string]: any;
}

/**
 * Send log to server terminal via API endpoint
 */
async function logToServer(
  level: LogLevel,
  component: string,
  message: string,
  data?: LogData
): Promise<void> {
  // Only send to server in browser environment
  if (typeof window === 'undefined') return;

  try {
    // Fire and forget - don't block on logging
    fetch('/api/debug-log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        level,
        component,
        message,
        data,
      }),
    }).catch(() => {
      // Silently fail if API is unavailable
    });
  } catch (error) {
    // Silently fail if fetch is unavailable
  }
}

/**
 * Debug logger that outputs to both browser console and terminal
 */
export const debugLog = {
  /**
   * Log navigation events (blue)
   */
  nav: (component: string, message: string, data?: LogData) => {
    console.log(`🔵 [${component}] ${message}`, data || '');
    logToServer('nav', component, message, data);
  },

  /**
   * Log setup/info events (yellow)
   */
  setup: (component: string, message: string, data?: LogData) => {
    console.log(`🟡 [${component}] ${message}`, data || '');
    logToServer('setup', component, message, data);
  },

  /**
   * Log success/info events (green)
   */
  info: (component: string, message: string, data?: LogData) => {
    console.log(`🟢 [${component}] ${message}`, data || '');
    logToServer('info', component, message, data);
  },

  /**
   * Log warnings (yellow with warning icon)
   */
  warn: (component: string, message: string, data?: LogData) => {
    console.warn(`⚠️ [${component}] ${message}`, data || '');
    logToServer('warn', component, message, data);
  },

  /**
   * Log errors (red)
   */
  error: (component: string, message: string, error?: Error | unknown, data?: LogData) => {
    const errorData = error instanceof Error
      ? { error: { message: error.message, stack: error.stack, name: error.name }, ...data }
      : { error, ...data };
    
    console.error(`🔴 [${component}] ${message}`, errorData || '');
    logToServer('error', component, message, errorData);
  },
};

