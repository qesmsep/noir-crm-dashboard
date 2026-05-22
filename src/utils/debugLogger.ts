/**
 * Debug Logger Utility
 * Logs to both browser console and server terminal (via API endpoint)
 *
 * Set NEXT_PUBLIC_DEBUG_LOGGING=true in .env.local to enable debug logs
 */

// Check if debug logging is enabled
const DEBUG_ENABLED = process.env.NEXT_PUBLIC_DEBUG_LOGGING === 'true';

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
  // Only send to server if debug is enabled and in browser environment
  if (!DEBUG_ENABLED || typeof window === 'undefined') return;

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
    if (!DEBUG_ENABLED) return;
    console.log(`🔵 [${component}] ${message}`, data || '');
    logToServer('nav', component, message, data);
  },

  /**
   * Log setup/info events (yellow)
   */
  setup: (component: string, message: string, data?: LogData) => {
    if (!DEBUG_ENABLED) return;
    console.log(`🟡 [${component}] ${message}`, data || '');
    logToServer('setup', component, message, data);
  },

  /**
   * Log success/info events (green)
   */
  info: (component: string, message: string, data?: LogData) => {
    if (!DEBUG_ENABLED) return;
    console.log(`🟢 [${component}] ${message}`, data || '');
    logToServer('info', component, message, data);
  },

  /**
   * Log warnings (yellow with warning icon)
   */
  warn: (component: string, message: string, data?: LogData) => {
    if (!DEBUG_ENABLED) return;
    console.warn(`⚠️ [${component}] ${message}`, data || '');
    logToServer('warn', component, message, data);
  },

  /**
   * Log errors (red)
   */
  error: (component: string, message: string, data?: LogData) => {
    // Always log errors regardless of debug setting
    console.error(`🔴 [${component}] ${message}`, data || '');
    logToServer('error', component, message, data);
  },
};