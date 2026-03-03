/**
 * Temporary simplified logger to fix Next.js startup issue
 * Winston is temporarily disabled due to file system conflicts
 */

// Simple console-based logger
const logger = {
  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] ${new Date().toISOString()}: ${message}`, ...args);
  },
  warn: (message: string, ...args: any[]) => {
    console.warn(`[WARN] ${new Date().toISOString()}: ${message}`, ...args);
  },
  info: (message: string, ...args: any[]) => {
    console.info(`[INFO] ${new Date().toISOString()}: ${message}`, ...args);
  },
  http: (message: string, ...args: any[]) => {
    console.log(`[HTTP] ${new Date().toISOString()}: ${message}`, ...args);
  },
  debug: (message: string, ...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${new Date().toISOString()}: ${message}`, ...args);
    }
  }
};

/**
 * Structured logging helpers
 */
export class Logger {
  static error(message: string, error?: Error | unknown, meta?: object): void {
    logger.error(message, { error, meta });
  }

  static warn(message: string, meta?: object): void {
    logger.warn(message, meta);
  }

  static info(message: string, meta?: object): void {
    logger.info(message, meta);
  }

  static http(message: string, meta?: object): void {
    logger.http(message, meta);
  }

  static debug(message: string, meta?: object): void {
    logger.debug(message, meta);
  }

  static apiRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    meta?: object
  ): void {
    logger.http('API Request', {
      method,
      path,
      statusCode,
      duration: `${duration}ms`,
      ...meta,
    });
  }

  static database(operation: string, table: string, duration?: number, meta?: object): void {
    logger.debug('Database Operation', {
      operation,
      table,
      ...(duration && { duration: `${duration}ms` }),
      ...meta,
    });
  }

  static auth(event: string, userId?: string, meta?: object): void {
    logger.info('Auth Event', {
      event,
      ...(userId && { userId }),
      ...meta,
    });
  }

  static payment(event: string, amount?: number, meta?: object): void {
    logger.info('Payment Event', {
      event,
      ...(amount && { amount }),
      ...meta,
    });
  }

  static externalApi(
    service: string,
    action: string,
    success: boolean,
    duration?: number,
    meta?: object
  ): void {
    logger.info('External API Call', {
      service,
      action,
      success,
      ...(duration && { duration: `${duration}ms` }),
      ...meta,
    });
  }

  static campaign(event: string, campaignId?: string, meta?: object): void {
    logger.info('Campaign Event', {
      event,
      ...(campaignId && { campaignId }),
      ...meta,
    });
  }

  static cronJob(jobName: string, success: boolean, duration?: number, meta?: object): void {
    logger.info('Cron Job', {
      jobName,
      success,
      ...(duration && { duration: `${duration}ms` }),
      ...meta,
    });
  }
}

/**
 * Request logger middleware
 */
export function createRequestLogger(requestId: string, userId?: string) {
  return {
    error: (message: string, meta?: object) =>
      Logger.error(message, undefined, { requestId, userId, ...meta }),
    warn: (message: string, meta?: object) =>
      Logger.warn(message, { requestId, userId, ...meta }),
    info: (message: string, meta?: object) =>
      Logger.info(message, { requestId, userId, ...meta }),
    debug: (message: string, meta?: object) =>
      Logger.debug(message, { requestId, userId, ...meta }),
  };
}

// Export the default logger instance for backward compatibility
export default logger;