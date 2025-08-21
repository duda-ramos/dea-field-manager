import { getFeatureFlag } from '@/config/featureFlags';
import { logger } from '@/services/logger';

interface RateLimit {
  calls: number;
  windowStart: number;
  blocked: boolean;
  blockedUntil: number;
}

class RateLimiter {
  private limits = new Map<string, RateLimit>();
  private windowSizeMs = 60 * 1000; // 1 minute

  private getLimit(operation: string): RateLimit {
    if (!this.limits.has(operation)) {
      this.limits.set(operation, {
        calls: 0,
        windowStart: Date.now(),
        blocked: false,
        blockedUntil: 0
      });
    }
    return this.limits.get(operation)!;
  }

  private resetWindowIfNeeded(limit: RateLimit): void {
    const now = Date.now();
    
    // Reset window if it's been more than windowSizeMs
    if (now - limit.windowStart >= this.windowSizeMs) {
      limit.calls = 0;
      limit.windowStart = now;
      limit.blocked = false;
      limit.blockedUntil = 0;
    }
    
    // Unblock if block period has passed
    if (limit.blocked && now >= limit.blockedUntil) {
      limit.blocked = false;
      limit.blockedUntil = 0;
    }
  }

  async checkLimit(operation: string): Promise<{ allowed: boolean; retryAfter?: number }> {
    const maxCalls = getFeatureFlag('RATE_LIMIT_CALLS_PER_MINUTE') as number;
    const limit = this.getLimit(operation);
    
    this.resetWindowIfNeeded(limit);
    
    // If currently blocked, return retry time
    if (limit.blocked) {
      const retryAfter = limit.blockedUntil - Date.now();
      return { allowed: false, retryAfter: Math.max(0, retryAfter) };
    }
    
    // Check if we've exceeded the limit
    if (limit.calls >= maxCalls) {
      // Block for exponential backoff: base delay * 2^(excess calls)
      const excessCalls = limit.calls - maxCalls + 1;
      const blockDurationMs = 1000 * Math.pow(2, Math.min(excessCalls, 6)); // Max 64 seconds
      
      limit.blocked = true;
      limit.blockedUntil = Date.now() + blockDurationMs;
      
      logger.rateLimitHit(operation, blockDurationMs);
      
      return { allowed: false, retryAfter: blockDurationMs };
    }
    
    // Increment call count and allow
    limit.calls++;
    return { allowed: true };
  }

  async waitForLimit(operation: string): Promise<void> {
    const result = await this.checkLimit(operation);
    
    if (!result.allowed && result.retryAfter) {
      // Wait for the retry period
      await new Promise(resolve => setTimeout(resolve, result.retryAfter));
      
      // Recursively check again
      return this.waitForLimit(operation);
    }
  }

  // Reset all limits (for testing or manual override)
  reset(): void {
    this.limits.clear();
  }

  // Get current status for debugging
  getStatus(): Record<string, RateLimit> {
    const status: Record<string, RateLimit> = {};
    
    this.limits.forEach((limit, operation) => {
      this.resetWindowIfNeeded(limit);
      status[operation] = { ...limit };
    });
    
    return status;
  }

  // Throttle function wrapper
  async throttle<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    await this.waitForLimit(operation);
    return fn();
  }
}

export const rateLimiter = new RateLimiter();