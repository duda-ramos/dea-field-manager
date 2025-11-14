import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { authRateLimiter } from './rateLimiter';

// Mock the logger
vi.mock('@/services/logger', () => ({
  logger: {
    warn: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
  },
}));

describe('AuthRateLimiter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    authRateLimiter.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('login rate limiting', () => {
    const email = 'test@example.com';

    it('should allow first login attempt', () => {
      const result = authRateLimiter.checkLimit('login', email);

      expect(result.allowed).toBe(true);
      expect(result.retryAfter).toBeUndefined();
    });

    it('should allow up to 5 login attempts within window', () => {
      // Attempt 1-4 should be allowed
      for (let i = 0; i < 4; i++) {
        authRateLimiter.recordAttempt('login', email, false);
        const result = authRateLimiter.checkLimit('login', email);
        expect(result.allowed).toBe(true);
      }

      // 5th attempt should still be allowed (limit is 5)
      authRateLimiter.recordAttempt('login', email, false);
      const result = authRateLimiter.checkLimit('login', email);
      expect(result.allowed).toBe(true);
    });

    it('should block after 5 failed login attempts', () => {
      // Record 5 failed attempts
      for (let i = 0; i < 5; i++) {
        authRateLimiter.recordAttempt('login', email, false);
      }

      const result = authRateLimiter.checkLimit('login', email);

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.retryAfter).toBeLessThanOrEqual(1800); // 30 minutes in seconds
    });

    it('should reset counter on successful login', () => {
      // Record 3 failed attempts
      for (let i = 0; i < 3; i++) {
        authRateLimiter.recordAttempt('login', email, false);
      }

      // Record successful login
      authRateLimiter.recordAttempt('login', email, true);

      // Should allow new attempts
      const result = authRateLimiter.checkLimit('login', email);
      expect(result.allowed).toBe(true);
    });

    it('should maintain block during block period', () => {
      // Block the user
      for (let i = 0; i < 5; i++) {
        authRateLimiter.recordAttempt('login', email, false);
      }

      // Check immediately
      let result = authRateLimiter.checkLimit('login', email);
      expect(result.allowed).toBe(false);

      // Advance 10 minutes (block is 30 minutes)
      vi.advanceTimersByTime(10 * 60 * 1000);

      // Should still be blocked
      result = authRateLimiter.checkLimit('login', email);
      expect(result.allowed).toBe(false);
    });

    it('should allow after block period expires', () => {
      // Block the user
      for (let i = 0; i < 5; i++) {
        authRateLimiter.recordAttempt('login', email, false);
      }

      expect(authRateLimiter.checkLimit('login', email).allowed).toBe(false);

      // Advance past 30 minute block
      vi.advanceTimersByTime(31 * 60 * 1000);

      // Should be allowed again
      const result = authRateLimiter.checkLimit('login', email);
      expect(result.allowed).toBe(true);
    });

    it('should reset window after window expires', () => {
      // Record 2 failed attempts
      authRateLimiter.recordAttempt('login', email, false);
      authRateLimiter.recordAttempt('login', email, false);

      // Advance past 15 minute window
      vi.advanceTimersByTime(16 * 60 * 1000);

      // Counter should be reset - can make 5 more attempts
      for (let i = 0; i < 5; i++) {
        const result = authRateLimiter.checkLimit('login', email);
        expect(result.allowed).toBe(true);
        authRateLimiter.recordAttempt('login', email, false);
      }

      // 6th attempt should be blocked
      const result = authRateLimiter.checkLimit('login', email);
      expect(result.allowed).toBe(false);
    });

    it('should track different emails independently', () => {
      const email1 = 'user1@example.com';
      const email2 = 'user2@example.com';

      // Block email1
      for (let i = 0; i < 5; i++) {
        authRateLimiter.recordAttempt('login', email1, false);
      }

      expect(authRateLimiter.checkLimit('login', email1).allowed).toBe(false);

      // email2 should still be allowed
      expect(authRateLimiter.checkLimit('login', email2).allowed).toBe(true);
    });
  });

  describe('signup rate limiting', () => {
    const email = 'newuser@example.com';

    it('should allow up to 3 signup attempts within window', () => {
      for (let i = 0; i < 3; i++) {
        const result = authRateLimiter.checkLimit('signup', email);
        expect(result.allowed).toBe(true);
        authRateLimiter.recordAttempt('signup', email, false);
      }
    });

    it('should block after 3 failed signup attempts', () => {
      for (let i = 0; i < 3; i++) {
        authRateLimiter.recordAttempt('signup', email, false);
      }

      const result = authRateLimiter.checkLimit('signup', email);
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should use 1 hour window and 1 hour block for signup', () => {
      // Block after 3 attempts
      for (let i = 0; i < 3; i++) {
        authRateLimiter.recordAttempt('signup', email, false);
      }

      expect(authRateLimiter.checkLimit('signup', email).allowed).toBe(false);

      // After 30 minutes, should still be blocked
      vi.advanceTimersByTime(30 * 60 * 1000);
      expect(authRateLimiter.checkLimit('signup', email).allowed).toBe(false);

      // After 1 hour + 1 minute, should be allowed
      vi.advanceTimersByTime(31 * 60 * 1000);
      const result = authRateLimiter.checkLimit('signup', email);
      expect(result.allowed).toBe(true);
    });

    it('should reset on successful signup', () => {
      authRateLimiter.recordAttempt('signup', email, false);
      authRateLimiter.recordAttempt('signup', email, false);
      authRateLimiter.recordAttempt('signup', email, true);

      const result = authRateLimiter.checkLimit('signup', email);
      expect(result.allowed).toBe(true);
    });
  });

  describe('password reset rate limiting', () => {
    const email = 'reset@example.com';

    it('should allow up to 3 reset attempts within window', () => {
      for (let i = 0; i < 3; i++) {
        const result = authRateLimiter.checkLimit('reset', email);
        expect(result.allowed).toBe(true);
        authRateLimiter.recordAttempt('reset', email, false);
      }
    });

    it('should block after 3 failed reset attempts', () => {
      for (let i = 0; i < 3; i++) {
        authRateLimiter.recordAttempt('reset', email, false);
      }

      const result = authRateLimiter.checkLimit('reset', email);
      expect(result.allowed).toBe(false);
    });

    it('should use 1 hour window and 1 hour block for reset', () => {
      for (let i = 0; i < 3; i++) {
        authRateLimiter.recordAttempt('reset', email, false);
      }

      expect(authRateLimiter.checkLimit('reset', email).allowed).toBe(false);

      vi.advanceTimersByTime(61 * 60 * 1000);

      const result = authRateLimiter.checkLimit('reset', email);
      expect(result.allowed).toBe(true);
    });
  });

  describe('cross-operation isolation', () => {
    const email = 'test@example.com';

    it('should track login, signup, and reset limits independently', () => {
      // Max out login attempts
      for (let i = 0; i < 5; i++) {
        authRateLimiter.recordAttempt('login', email, false);
      }
      expect(authRateLimiter.checkLimit('login', email).allowed).toBe(false);

      // Signup should still be allowed
      expect(authRateLimiter.checkLimit('signup', email).allowed).toBe(true);

      // Reset should still be allowed
      expect(authRateLimiter.checkLimit('reset', email).allowed).toBe(true);

      // Max out signup
      for (let i = 0; i < 3; i++) {
        authRateLimiter.recordAttempt('signup', email, false);
      }
      expect(authRateLimiter.checkLimit('signup', email).allowed).toBe(false);

      // Reset should still be allowed
      expect(authRateLimiter.checkLimit('reset', email).allowed).toBe(true);
    });
  });

  describe('reset and getStatus', () => {
    it('should clear all limits on reset', () => {
      const email1 = 'user1@example.com';
      const email2 = 'user2@example.com';

      // Block both users
      for (let i = 0; i < 5; i++) {
        authRateLimiter.recordAttempt('login', email1, false);
        authRateLimiter.recordAttempt('login', email2, false);
      }

      expect(authRateLimiter.checkLimit('login', email1).allowed).toBe(false);
      expect(authRateLimiter.checkLimit('login', email2).allowed).toBe(false);

      // Reset all limits
      authRateLimiter.reset();

      // Both should be allowed now
      expect(authRateLimiter.checkLimit('login', email1).allowed).toBe(true);
      expect(authRateLimiter.checkLimit('login', email2).allowed).toBe(true);
    });

    it('should return status of all tracked limits', () => {
      const email = 'test@example.com';

      authRateLimiter.recordAttempt('login', email, false);
      authRateLimiter.recordAttempt('login', email, false);

      const status = authRateLimiter.getStatus();

      expect(status).toHaveProperty('login:test@example.com');
      expect(status['login:test@example.com'].attempts).toBe(2);
      expect(status['login:test@example.com'].blocked).toBe(false);
    });

    it('should show blocked status in getStatus', () => {
      const email = 'blocked@example.com';

      for (let i = 0; i < 5; i++) {
        authRateLimiter.recordAttempt('login', email, false);
      }

      const status = authRateLimiter.getStatus();

      expect(status['login:blocked@example.com'].blocked).toBe(true);
      expect(status['login:blocked@example.com'].blockExpiry).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle checkLimit before any recordAttempt', () => {
      const result = authRateLimiter.checkLimit('login', 'new@example.com');
      expect(result.allowed).toBe(true);
    });

    it('should not increment count on successful attempt', () => {
      const email = 'success@example.com';

      authRateLimiter.recordAttempt('login', email, true);
      authRateLimiter.recordAttempt('login', email, true);
      authRateLimiter.recordAttempt('login', email, true);

      const result = authRateLimiter.checkLimit('login', email);
      expect(result.allowed).toBe(true);
    });

    it('should not record attempt when already blocked', () => {
      const email = 'blocked@example.com';

      // Block the user
      for (let i = 0; i < 5; i++) {
        authRateLimiter.recordAttempt('login', email, false);
      }

      const statusBefore = authRateLimiter.getStatus();
      const attemptsBefore = statusBefore['login:blocked@example.com'].attempts;

      // Try to record another attempt while blocked
      authRateLimiter.recordAttempt('login', email, false);

      const statusAfter = authRateLimiter.getStatus();
      const attemptsAfter = statusAfter['login:blocked@example.com'].attempts;

      // Attempts shouldn't increase when blocked
      expect(attemptsAfter).toBe(attemptsBefore);
    });

    it('should handle case-sensitive emails', () => {
      const email1 = 'Test@Example.com';
      const email2 = 'test@example.com';

      authRateLimiter.recordAttempt('login', email1, false);
      authRateLimiter.recordAttempt('login', email1, false);

      // Different case should be treated as different identifier
      const result1 = authRateLimiter.getStatus();
      expect(Object.keys(result1)).toContain('login:Test@Example.com');

      authRateLimiter.recordAttempt('login', email2, false);
      const result2 = authRateLimiter.getStatus();
      expect(Object.keys(result2)).toContain('login:test@example.com');
    });
  });

  describe('retryAfter calculation', () => {
    it('should return correct retryAfter in seconds', () => {
      const email = 'test@example.com';

      for (let i = 0; i < 5; i++) {
        authRateLimiter.recordAttempt('login', email, false);
      }

      const result = authRateLimiter.checkLimit('login', email);

      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.retryAfter).toBeLessThanOrEqual(1800); // 30 minutes = 1800 seconds
    });

    it('should update retryAfter as time passes', () => {
      const email = 'test@example.com';

      for (let i = 0; i < 5; i++) {
        authRateLimiter.recordAttempt('login', email, false);
      }

      const result1 = authRateLimiter.checkLimit('login', email);
      const retryAfter1 = result1.retryAfter!;

      // Advance 5 minutes
      vi.advanceTimersByTime(5 * 60 * 1000);

      const result2 = authRateLimiter.checkLimit('login', email);
      const retryAfter2 = result2.retryAfter!;

      // retryAfter should be ~300 seconds less
      expect(retryAfter2).toBeLessThan(retryAfter1);
      expect(retryAfter1 - retryAfter2).toBeGreaterThanOrEqual(290); // Allow some margin
      expect(retryAfter1 - retryAfter2).toBeLessThanOrEqual(310);
    });
  });
});
