/**
 * Exponential backoff utility with optional retry predicates.
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export interface RetryOptions {
  shouldRetry?: (error: Error) => boolean;
  onRetry?: (attempt: number, error: Error, delay: number) => void;
}

export class ExponentialBackoff {
  constructor(private readonly config: RetryConfig) {}

  async execute<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        const shouldRetry = options.shouldRetry?.(lastError) ?? true;
        const isLastAttempt = attempt === this.config.maxRetries;

        if (!shouldRetry || isLastAttempt) {
          break;
        }

        const delay = Math.min(
          this.config.baseDelayMs * Math.pow(2, attempt),
          this.config.maxDelayMs,
        );
        options.onRetry?.(attempt + 1, lastError, delay);
        await this.sleep(delay);
      }
    }

    throw lastError ?? new Error('Retry failed without error context');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
