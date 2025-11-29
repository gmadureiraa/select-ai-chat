/**
 * Exponential backoff retry strategy for failed API calls
 */

export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffFactor: 2,
};

export class RetryError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: Error
  ) {
    super(message);
    this.name = "RetryError";
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const { maxRetries, initialDelay, maxDelay, backoffFactor } = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  let lastError: Error | null = null;
  let currentDelay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      if (!isRetryableError(lastError)) {
        throw lastError;
      }

      if (attempt < maxRetries) {
        console.log(
          `Retry attempt ${attempt + 1}/${maxRetries} after ${currentDelay}ms`,
          lastError.message
        );
        await delay(currentDelay);
        currentDelay = Math.min(currentDelay * backoffFactor, maxDelay);
      }
    }
  }

  throw new RetryError(
    `Failed after ${maxRetries} retries`,
    maxRetries,
    lastError!
  );
}

function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();

  // Network errors
  if (message.includes("network") || message.includes("fetch")) {
    return true;
  }

  // Rate limit errors (429)
  if (message.includes("rate limit") || message.includes("429")) {
    return true;
  }

  // Server errors (500, 502, 503)
  if (
    message.includes("500") ||
    message.includes("502") ||
    message.includes("503")
  ) {
    return true;
  }

  // Timeout errors
  if (message.includes("timeout")) {
    return true;
  }

  return false;
}
