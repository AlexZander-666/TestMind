/**
 * Unified Error Handling Framework
 * Provides a hierarchical error structure for consistent error handling across the application
 */

import { createComponentLogger } from '../utils/logger';

const logger = createComponentLogger('ErrorHandler');

/**
 * Base error class for TestMind application
 */
export class TestMindError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly timestamp: Date;
  public readonly context?: Record<string, any>;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    context?: Record<string, any>,
  ) {
    super(message);
    
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date();
    this.context = context;

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
    
    // Log error
    if (isOperational) {
      logger.warn(`Operational error: ${code}`, { message, context });
    } else {
      logger.error(`System error: ${code}`, { message, context, stack: this.stack });
    }
  }

  /**
   * Convert error to JSON for API responses
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      context: this.context,
      ...(process.env.NODE_ENV !== 'production' && { stack: this.stack }),
    };
  }
}

/**
 * Validation errors (400)
 */
export class ValidationError extends TestMindError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 400, true, context);
  }
}

/**
 * Authentication errors (401)
 */
export class AuthenticationError extends TestMindError {
  constructor(message: string = 'Authentication required', context?: Record<string, any>) {
    super(message, 'AUTHENTICATION_ERROR', 401, true, context);
  }
}

/**
 * Authorization errors (403)
 */
export class AuthorizationError extends TestMindError {
  constructor(message: string = 'Permission denied', context?: Record<string, any>) {
    super(message, 'AUTHORIZATION_ERROR', 403, true, context);
  }
}

/**
 * Not found errors (404)
 */
export class NotFoundError extends TestMindError {
  constructor(resource: string, identifier?: string) {
    const message = identifier 
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, 'NOT_FOUND', 404, true, { resource, identifier });
  }
}

/**
 * Conflict errors (409)
 */
export class ConflictError extends TestMindError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'CONFLICT', 409, true, context);
  }
}

/**
 * Rate limit errors (429)
 */
export class RateLimitError extends TestMindError {
  constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
    super(message, 'RATE_LIMIT', 429, true, { retryAfter });
  }
}

/**
 * Database errors
 */
export class DatabaseError extends TestMindError {
  constructor(message: string, originalError?: Error) {
    super(message, 'DATABASE_ERROR', 500, false, { 
      originalError: originalError?.message, 
    });
  }
}

/**
 * External service errors
 */
export class ExternalServiceError extends TestMindError {
  constructor(service: string, message: string, originalError?: Error) {
    super(
      `External service error (${service}): ${message}`,
      'EXTERNAL_SERVICE_ERROR',
      502,
      true,
      { service, originalError: originalError?.message },
    );
  }
}

/**
 * LLM errors
 */
export class LLMError extends TestMindError {
  constructor(provider: string, message: string, originalError?: Error) {
    super(
      `LLM error (${provider}): ${message}`,
      'LLM_ERROR',
      502,
      true,
      { provider, originalError: originalError?.message },
    );
  }
}

/**
 * File system errors
 */
export class FileSystemError extends TestMindError {
  constructor(operation: string, path: string, originalError?: Error) {
    super(
      `File system error during ${operation}: ${path}`,
      'FILESYSTEM_ERROR',
      500,
      false,
      { operation, path, originalError: originalError?.message },
    );
  }
}

/**
 * Configuration errors
 */
export class ConfigurationError extends TestMindError {
  constructor(message: string, missingConfig?: string) {
    super(message, 'CONFIGURATION_ERROR', 500, false, { missingConfig });
  }
}

/**
 * Test generation errors
 */
export class TestGenerationError extends TestMindError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'TEST_GENERATION_ERROR', 500, true, context);
  }
}

/**
 * Self-Healing related errors
 */
export class SelfHealingError extends TestMindError {
  constructor(message: string, failureType: string, context?: Record<string, any>) {
    super(message, 'SELF_HEALING_ERROR', 500, true, { failureType, ...context });
  }
}

/**
 * Locator errors for element resolution
 */
export class LocatorError extends TestMindError {
  constructor(selector: string, strategies: string[], context?: Record<string, any>) {
    super(
      `Failed to locate element: ${selector}`,
      'LOCATOR_ERROR',
      404,
      true,
      { selector, strategies, ...context },
    );
  }
}

/**
 * Context analysis errors
 */
export class ContextAnalysisError extends TestMindError {
  constructor(filePath: string, reason: string, originalError?: Error) {
    super(
      `Context analysis failed for ${filePath}: ${reason}`,
      'CONTEXT_ANALYSIS_ERROR',
      500,
      true,
      { filePath, originalError: originalError?.message },
    );
  }
}

/**
 * Test evaluation errors
 */
export class TestEvaluationError extends TestMindError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'TEST_EVALUATION_ERROR', 500, true, context);
  }
}

/**
 * Skill execution errors
 */
export class SkillExecutionError extends TestMindError {
  constructor(skillName: string, message: string, originalError?: Error) {
    super(
      `Skill execution error (${skillName}): ${message}`,
      'SKILL_EXECUTION_ERROR',
      500,
      true,
      { skillName, originalError: originalError?.message },
    );
  }
}

/**
 * Error handler utility functions
 */
export class ErrorHandler {
  /**
   * Handle error and determine if it should crash the app
   */
  static handle(error: Error): void {
    if (error instanceof TestMindError) {
      if (!error.isOperational) {
        // Non-operational errors should terminate the process
        logger.error('Non-operational error detected, shutting down', {
          error: error.toJSON(),
        });
        process.exit(1);
      }
    } else {
      // Unknown errors are considered non-operational
      logger.error('Unknown error detected', {
        message: error.message,
        stack: error.stack,
      });
      process.exit(1);
    }
  }

  /**
   * Wrap async functions with error handling
   */
  static async wrap<T>(
    fn: () => Promise<T>,
    errorMessage: string,
    ErrorClass: typeof TestMindError = TestMindError,
  ): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      if (error instanceof TestMindError) {
        throw error;
      }
      throw new ErrorClass(errorMessage, error);
    }
  }

  /**
   * Check if error is operational
   */
  static isOperational(error: Error): boolean {
    if (error instanceof TestMindError) {
      return error.isOperational;
    }
    return false;
  }

  /**
   * Format error for logging
   */
  static format(error: Error): Record<string, any> {
    if (error instanceof TestMindError) {
      return error.toJSON();
    }
    
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
}

/**
 * Global error handlers setup
 */
export function setupGlobalErrorHandlers(): void {
  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught exception', ErrorHandler.format(error));
    ErrorHandler.handle(error);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled promise rejection', {
      reason: reason?.message || reason,
      promise,
    });
    
    if (reason instanceof Error) {
      ErrorHandler.handle(reason);
    } else {
      ErrorHandler.handle(new TestMindError(
        'Unhandled promise rejection',
        'UNHANDLED_REJECTION',
        500,
        false,
        { reason },
      ));
    }
  });

  // Handle SIGTERM
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    // Perform cleanup here
    process.exit(0);
  });

  // Handle SIGINT
  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    // Perform cleanup here
    process.exit(0);
  });
}

/**
 * Express error middleware
 */
export function expressErrorMiddleware(
  error: Error,
  req: any,
  res: any,
  next: any,
): void {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof TestMindError) {
    res.status(error.statusCode).json({
      error: error.toJSON(),
    });
  } else {
    logger.error('Unexpected error in Express middleware', {
      error: ErrorHandler.format(error),
      request: {
        method: req.method,
        url: req.url,
        headers: req.headers,
      },
    });

    res.status(500).json({
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
        ...(process.env.NODE_ENV !== 'production' && {
          originalError: error.message,
          stack: error.stack,
        }),
      },
    });
  }
}

// Export type guards
export function isTestMindError(error: unknown): error is TestMindError {
  return error instanceof TestMindError;
}

export function isOperationalError(error: unknown): boolean {
  return isTestMindError(error) && error.isOperational;
}
