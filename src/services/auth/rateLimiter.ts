import { logger } from '@/services/logger';

interface AuthRateLimit {
  attempts: number;
  windowStart: number;
  blocked: boolean;
  blockExpiry?: number;
}

class AuthRateLimiter {
  private limits = new Map<string, AuthRateLimit>();
  private readonly config = {
    login: { maxAttempts: 5, windowMs: 15 * 60 * 1000, blockMs: 30 * 60 * 1000 }, // 5 attempts per 15min, block 30min
    signup: { maxAttempts: 3, windowMs: 60 * 60 * 1000, blockMs: 60 * 60 * 1000 }, // 3 attempts per hour, block 1hour
    reset: { maxAttempts: 3, windowMs: 60 * 60 * 1000, blockMs: 60 * 60 * 1000 },  // 3 attempts per hour, block 1hour
  };

  private getClientKey(operation: string, identifier: string): string {
    return `${operation}:${identifier}`;
  }

  checkLimit(operation: keyof typeof this.config, identifier: string): { allowed: boolean; retryAfter?: number } {
    const config = this.config[operation];
    const key = this.getClientKey(operation, identifier);
    const now = Date.now();
    
    let limit = this.limits.get(key);
    
    // Check if blocked
    if (limit?.blocked && limit.blockExpiry && now < limit.blockExpiry) {
      const retryAfter = Math.ceil((limit.blockExpiry - now) / 1000);
      logger.warn(`Auth rate limit blocked for ${operation}:${identifier}, retry after ${retryAfter}s`);
      return { allowed: false, retryAfter };
    }

    // Reset window if expired
    if (!limit || (now - limit.windowStart) > config.windowMs) {
      limit = {
        attempts: 0,
        windowStart: now,
        blocked: false
      };
      this.limits.set(key, limit);
    }

    // Check if within limits
    if (limit.attempts >= config.maxAttempts) {
      // Block the identifier
      limit.blocked = true;
      limit.blockExpiry = now + config.blockMs;
      this.limits.set(key, limit);
      
      const retryAfter = Math.ceil(config.blockMs / 1000);
      logger.warn(`Auth rate limit exceeded for ${operation}:${identifier}, blocked for ${retryAfter}s`);
      return { allowed: false, retryAfter };
    }

    return { allowed: true };
  }

  recordAttempt(operation: keyof typeof this.config, identifier: string, success: boolean): void {
    const key = this.getClientKey(operation, identifier);
    const limit = this.limits.get(key);
    
    if (limit && !limit.blocked) {
      if (success) {
        // Reset on successful auth
        this.limits.delete(key);
        logger.debug(`Auth rate limit reset for successful ${operation}:${identifier}`);
      } else {
        // Increment failed attempts
        limit.attempts++;
        this.limits.set(key, limit);
        logger.debug(`Auth rate limit recorded failed attempt ${limit.attempts} for ${operation}:${identifier}`);
      }
    }
  }

  reset(): void {
    this.limits.clear();
    logger.info('Auth rate limits reset');
  }

  getStatus(): Record<string, AuthRateLimit> {
    const status: Record<string, AuthRateLimit> = {};
    this.limits.forEach((limit, key) => {
      status[key] = { ...limit };
    });
    return status;
  }
}

export const authRateLimiter = new AuthRateLimiter();