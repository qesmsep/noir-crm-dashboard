import winston from 'winston';

/**
 * Centralized logging configuration using Winston
 * Replaces console.log throughout the application
 */

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(colors);

// Define format for logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
  winston.format.printf((info) => {
    const { timestamp, level, message, requestId, userId, ...meta } = info;

    let log = `${timestamp} [${level.toUpperCase()}]`;

    if (requestId) {
      log += ` [ReqID: ${requestId}]`;
    }

    if (userId) {
      log += ` [User: ${userId}]`;
    }

    log += `: ${message}`;

    // Add additional metadata if present
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }

    return log;
  })
);

// Define which transports to use based on environment
const transports: winston.transport[] = [
  // Always log errors to a separate file
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  // Log all levels to combined file
  new winston.transports.File({
    filename: 'logs/combined.log',
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
];

// In development, also log to console with colors
if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.printf((info) => {
          const { timestamp, level, message, requestId, userId, ...meta } = info;

          let log = `${timestamp} [${level}]`;

          if (requestId) {
            log += ` [ReqID: ${requestId}]`;
          }

          if (userId) {
            log += ` [User: ${userId}]`;
          }

          log += `: ${message}`;

          // Add metadata in development for easier debugging
          if (Object.keys(meta).length > 0) {
            log += `\n${JSON.stringify(meta, null, 2)}`;
          }

          return log;
        })
      ),
    })
  );
}

// Determine log level based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'info';
};

// Create the logger instance
export const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
  // Don't exit on errors
  exitOnError: false,
});

/**
 * Structured logging helpers
 */

export class Logger {
  /**
   * Log an error
   */
  static error(message: string, error?: Error | unknown, meta?: object): void {
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

    logger.error(message, errorMeta);
  }

  /**
   * Log a warning
   */
  static warn(message: string, meta?: object): void {
    logger.warn(message, meta);
  }

  /**
   * Log info
   */
  static info(message: string, meta?: object): void {
    logger.info(message, meta);
  }

  /**
   * Log HTTP requests
   */
  static http(message: string, meta?: object): void {
    logger.http(message, meta);
  }

  /**
   * Log debug information (development only)
   */
  static debug(message: string, meta?: object): void {
    logger.debug(message, meta);
  }

  /**
   * Log API requests with standard format
   */
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

  /**
   * Log database operations
   */
  static database(operation: string, table: string, duration?: number, meta?: object): void {
    logger.debug('Database Operation', {
      operation,
      table,
      ...(duration && { duration: `${duration}ms` }),
      ...meta,
    });
  }

  /**
   * Log authentication events
   */
  static auth(event: string, userId?: string, meta?: object): void {
    logger.info('Auth Event', {
      event,
      ...(userId && { userId }),
      ...meta,
    });
  }

  /**
   * Log payment/transaction events
   */
  static payment(event: string, amount?: number, meta?: object): void {
    logger.info('Payment Event', {
      event,
      ...(amount && { amount }),
      ...meta,
    });
  }

  /**
   * Log external API calls
   */
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

  /**
   * Log campaign/messaging events
   */
  static campaign(event: string, campaignId?: string, meta?: object): void {
    logger.info('Campaign Event', {
      event,
      ...(campaignId && { campaignId }),
      ...meta,
    });
  }

  /**
   * Log scheduled job execution
   */
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
 * Attaches logger instance to request object
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
