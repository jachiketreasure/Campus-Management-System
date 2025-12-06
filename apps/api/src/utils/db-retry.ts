/**
 * Database retry utility for handling transient MongoDB connection errors
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * Checks if an error is a retryable database error
 */
function isRetryableError(error: any): boolean {
  if (!error) return false;

  const errorMessage = error.message?.toLowerCase() || '';
  const errorCode = error.code?.toLowerCase() || '';

  // MongoDB connection errors
  const retryablePatterns = [
    'i/o error',
    'internalerror',
    'server selection timeout',
    'connection timeout',
    'network',
    'econnrefused',
    'etimedout',
    'socket',
    'replica set',
    'topology',
    'transient',
  ];

  // Check error message
  if (retryablePatterns.some(pattern => errorMessage.includes(pattern))) {
    return true;
  }

  // Check error code
  if (errorCode === 'unknown' || errorCode.includes('timeout') || errorCode.includes('network')) {
    return true;
  }

  return false;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a database operation with exponential backoff
 */
export async function retryDbOperation<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Don't retry if it's not a retryable error
      if (!isRetryableError(error)) {
        throw error;
      }

      // Don't retry on the last attempt
      if (attempt === opts.maxRetries) {
        break;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelayMs * Math.pow(opts.backoffMultiplier, attempt),
        opts.maxDelayMs
      );

      console.warn(
        `Database operation failed (attempt ${attempt + 1}/${opts.maxRetries + 1}), retrying in ${delay}ms...`,
        error.message
      );

      await sleep(delay);
    }
  }

  // If we get here, all retries failed
  throw new Error(
    `Database operation failed after ${opts.maxRetries + 1} attempts: ${lastError?.message || 'Unknown error'}`
  );
}










