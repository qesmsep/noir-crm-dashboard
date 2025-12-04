/**
 * Client-side logger
 * Lightweight logging for browser/client components
 * Falls back to console in production, structured in development
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogMeta {
  [key: string]: any;
}

class ClientLogger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  private formatLog(level: LogLevel, message: string, meta?: LogMeta): string {
    const timestamp = new Date().toISOString();
    let log = `[${timestamp}] [${level.toUpperCase()}]: ${message}`;

    if (meta && Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }

    return log;
  }

  error(message: string, error?: Error | unknown, meta?: LogMeta): void {
    const errorMeta = error instanceof Error
      ? {
          error: {
            message: error.message,
            stack: error.stack,
            name: error.name,
          },
          ...meta,
        }
      : { error, ...meta };

    if (this.isDevelopment) {
      console.error(this.formatLog('error', message, errorMeta));
      if (error instanceof Error && error.stack) {
        console.error(error.stack);
      }
    } else {
      console.error(message, errorMeta);
    }
  }

  warn(message: string, meta?: LogMeta): void {
    if (this.isDevelopment) {
      console.warn(this.formatLog('warn', message, meta));
    } else {
      console.warn(message, meta);
    }
  }

  info(message: string, meta?: LogMeta): void {
    if (this.isDevelopment) {
      console.info(this.formatLog('info', message, meta));
    } else {
      console.info(message, meta);
    }
  }

  debug(message: string, meta?: LogMeta): void {
    if (this.isDevelopment) {
      console.debug(this.formatLog('debug', message, meta));
    }
    // No-op in production
  }
}

// Export singleton instance
export const Logger = new ClientLogger();

export default Logger;
