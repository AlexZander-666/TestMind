/**
 * Structured Logging with Winston
 * Replaces console.log with proper logging infrastructure
 * 
 * Features:
 * - JSON structured logs for production
 * - Human-readable console output for development
 * - Multiple log levels (error, warn, info, debug)
 * - File-based log persistence
 * - Context enrichment
 */

import winston from 'winston';
import path from 'path';

// Log levels
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

// Log context interface
export interface LogContext {
  component?: string;
  operation?: string;
  filePath?: string;
  duration?: number;
  [key: string]: any;
}

/**
 * Create Winston logger instance
 */
function createLogger() {
  const logLevel = process.env.LOG_LEVEL || 'info';
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const logDir = process.env.LOG_DIR || '.testmind/logs';

  // Format for console (human-readable in dev, JSON in prod)
  const consoleFormat = isProduction
    ? winston.format.json()
    : winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, component, operation, ...meta }) => {
          let log = `${timestamp} [${level}]`;
          
          if (component) {
            log += ` [${component}]`;
          }
          
          if (operation) {
            log += ` ${operation}`;
          }
          
          log += `: ${message}`;
          
          // Add metadata if present
          const metaKeys = Object.keys(meta);
          if (metaKeys.length > 0) {
            const metaStr = JSON.stringify(meta, null, 0);
            log += ` ${metaStr}`;
          }
          
          return log;
        })
      );

  // Format for file (always JSON)
  const fileFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  );

  const transports: winston.transport[] = [
    // Console output
    new winston.transports.Console({
      format: consoleFormat,
      level: logLevel,
    }),
  ];

  // Add file transports in production or if explicitly enabled
  if (isProduction || process.env.ENABLE_FILE_LOGGING === 'true') {
    transports.push(
      // Error log
      new winston.transports.File({
        filename: path.join(logDir, 'error.log'),
        level: 'error',
        format: fileFormat,
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
      }),
      // Combined log
      new winston.transports.File({
        filename: path.join(logDir, 'combined.log'),
        format: fileFormat,
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 10,
      })
    );
  }

  return winston.createLogger({
    level: logLevel,
    transports,
    // Don't exit on uncaught errors
    exitOnError: false,
  });
}

/**
 * Global logger instance
 */
export const logger = createLogger();

/**
 * Logger class with convenience methods
 */
export class Logger {
  private component: string;

  constructor(component: string) {
    this.component = component;
  }

  /**
   * Log error message
   */
  error(message: string, context?: LogContext): void {
    logger.error(message, { ...context, component: this.component });
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void {
    logger.warn(message, { ...context, component: this.component });
  }

  /**
   * Log info message
   */
  info(message: string, context?: LogContext): void {
    logger.info(message, { ...context, component: this.component });
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: LogContext): void {
    logger.debug(message, { ...context, component: this.component });
  }

  /**
   * Time an operation and log the duration
   */
  async timeOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    const start = Date.now();
    this.debug(`Starting ${operation}`, context);

    try {
      const result = await fn();
      const duration = Date.now() - start;
      
      this.info(`${operation} completed`, {
        ...context,
        operation,
        duration,
        success: true,
      });

      return result;
    } catch (error: any) {
      const duration = Date.now() - start;
      
      this.error(`${operation} failed`, {
        ...context,
        operation,
        duration,
        error: error.message,
        stack: error.stack,
      });

      throw error;
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(childComponent: string): Logger {
    return new Logger(`${this.component}.${childComponent}`);
  }
}

/**
 * Create a logger for a component
 */
export function createComponentLogger(component: string): Logger {
  return new Logger(component);
}

/**
 * Flush logs (useful for graceful shutdown)
 */
export async function flushLogs(): Promise<void> {
  return new Promise((resolve) => {
    logger.on('finish', resolve);
    logger.end();
  });
}

// Export singleton for backward compatibility
export default logger;














