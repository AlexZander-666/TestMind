/**
 * Error Tracking with Sentry
 * Captures and reports errors for monitoring and debugging
 * 
 * Features:
 * - Automatic error capture
 * - Context enrichment
 * - User identification
 * - Performance monitoring
 * - Release tracking
 */

import * as Sentry from '@sentry/node';

export interface ErrorContext {
  component?: string;
  operation?: string;
  userId?: string;
  projectId?: string;
  [key: string]: any;
}

/**
 * Initialize Sentry error tracking
 */
export function initializeErrorTracking(): void {
  const sentryDsn = process.env.SENTRY_DSN;
  const nodeEnv = process.env.NODE_ENV || 'development';
  const sentryEnv = process.env.SENTRY_ENVIRONMENT || nodeEnv;
  
  // Only initialize if DSN is provided
  if (!sentryDsn) {
    console.log('[ErrorTracking] Sentry DSN not provided, error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: sentryDsn,
    environment: sentryEnv,
    
    // Release tracking
    release: `testmind@${process.env.npm_package_version || '0.3.0'}`,
    
    // Performance monitoring (10% sampling)
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    
    // Default integrations are automatically added in Sentry v7+
    // No need to manually specify integrations
    
    // Filter out sensitive data
    beforeSend(event) {
      // Remove API keys from breadcrumbs and context
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
          if (breadcrumb.data) {
            breadcrumb.data = filterSensitiveData(breadcrumb.data);
          }
          return breadcrumb;
        });
      }
      
      if (event.contexts) {
        Object.keys(event.contexts).forEach(key => {
          if (event.contexts && event.contexts[key]) {
            event.contexts[key] = filterSensitiveData(event.contexts[key]);
          }
        });
      }
      
      return event;
    },
  });

  console.log(`[ErrorTracking] Sentry initialized (env: ${sentryEnv})`);
}

/**
 * Filter sensitive data from objects
 */
function filterSensitiveData(data: any): any {
  if (!data || typeof data !== 'object') return data;
  
  const filtered = { ...data };
  const sensitiveKeys = [
    'api_key', 'apiKey', 'API_KEY',
    'password', 'passwd', 'pwd',
    'token', 'access_token', 'refresh_token',
    'secret', 'private_key', 'privateKey',
  ];
  
  for (const key of Object.keys(filtered)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sk => lowerKey.includes(sk.toLowerCase()))) {
      filtered[key] = '[REDACTED]';
    }
  }
  
  return filtered;
}

/**
 * Capture an error
 */
export function captureError(error: Error, context?: ErrorContext): string {
  try {
    return Sentry.captureException(error, {
      tags: context,
      contexts: {
        testmind: context,
      },
    });
  } catch {
    // Sentry not initialized, log to console
    console.error('[ErrorTracking] Error captured (Sentry not initialized):', error);
    return '';
  }
}

/**
 * Capture a message
 */
export function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug' = 'info',
  context?: ErrorContext
): string {
  try {
    return Sentry.captureMessage(message, {
      level,
      tags: context,
      contexts: {
        testmind: context,
      },
    });
  } catch {
    console.log(`[ErrorTracking] Message captured (Sentry not initialized): ${message}`);
    return '';
  }
}

/**
 * Set user context
 */
export function setUserContext(userId: string, email?: string, username?: string): void {
  try {
    Sentry.setUser({
      id: userId,
      email,
      username,
    });
  } catch {
    // Sentry not initialized
  }
}

/**
 * Clear user context
 */
export function clearUserContext(): void {
  try {
    Sentry.setUser(null);
  } catch {
    // Sentry not initialized
  }
}

/**
 * Add breadcrumb (for tracking user actions)
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, any>
): void {
  try {
    Sentry.addBreadcrumb({
      message,
      category,
      data: data ? filterSensitiveData(data) : undefined,
      level: 'info',
      timestamp: Date.now() / 1000,
    });
  } catch {
    // Sentry not initialized
  }
}

/**
 * Start a performance transaction
 * Note: Performance monitoring requires @sentry/tracing
 */
export function startTransaction(
  name: string,
  op: string
): any | null {
  try {
    // Start a span for performance monitoring
    return Sentry.startSpan({
      name,
      op,
    }, () => {
      // Return a simple object that can be used for tracking
      return { name, op, startTime: Date.now() };
    });
  } catch {
    // Sentry not initialized or tracing not available
    return null;
  }
}

/**
 * Wrap async function with error tracking
 */
export async function withErrorTracking<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: ErrorContext
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    captureError(error, {
      ...context,
      operation,
    });
    throw error;
  }
}

/**
 * Flush pending events (useful for graceful shutdown)
 */
export async function flushErrorTracking(timeout: number = 2000): Promise<boolean> {
  try {
    await Sentry.close(timeout);
    return true;
  } catch {
    return true;
  }
}

/**
 * Class-based error tracker for component-scoped tracking
 */
export class ErrorTracker {
  private component: string;

  constructor(component: string) {
    this.component = component;
  }

  captureError(error: Error, context?: ErrorContext): string {
    return captureError(error, {
      ...context,
      component: this.component,
    });
  }

  captureMessage(message: string, level: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug' = 'info', context?: ErrorContext): string {
    return captureMessage(message, level, {
      ...context,
      component: this.component,
    });
  }

  addBreadcrumb(message: string, data?: Record<string, any>): void {
    addBreadcrumb(message, this.component, data);
  }

  async withTracking<T>(operation: string, fn: () => Promise<T>, context?: ErrorContext): Promise<T> {
    return withErrorTracking(operation, fn, {
      ...context,
      component: this.component,
    });
  }
}

/**
 * Create an error tracker for a component
 */
export function createErrorTracker(component: string): ErrorTracker {
  return new ErrorTracker(component);
}

