import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  retryWithBackoff,
  retryNetworkOperation,
  retryStorageOperation,
  type RetryOptions,
} from './retryWithBackoff';

// Mock the logger
vi.mock('@/services/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('retryWithBackoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('successful execution', () => {
    it('should return result immediately on first success', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');

      const promise = retryWithBackoff(mockFn);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry and succeed on second attempt', async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce('success');

      const promise = retryWithBackoff(mockFn, { maxAttempts: 3 });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should retry and succeed on last attempt', async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockResolvedValueOnce('success');

      const promise = retryWithBackoff(mockFn, { maxAttempts: 3 });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });
  });

  describe('failure scenarios', () => {
    it('should throw error after max attempts exceeded', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Persistent failure'));

      const promise = retryWithBackoff(mockFn, { maxAttempts: 3 });
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow('Persistent failure');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should handle non-Error objects', async () => {
      const mockFn = vi.fn().mockRejectedValue('string error');

      const promise = retryWithBackoff(mockFn, { maxAttempts: 2 });
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow('string error');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('backoff timing', () => {
    it('should use default delay values', async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockResolvedValueOnce('success');

      const promise = retryWithBackoff(mockFn);

      // First attempt fails immediately
      await vi.advanceTimersByTimeAsync(0);
      expect(mockFn).toHaveBeenCalledTimes(1);

      // Wait for default initial delay (1000ms) + jitter
      await vi.advanceTimersByTimeAsync(1500);
      expect(mockFn).toHaveBeenCalledTimes(2);

      // Wait for second delay (2000ms with backoff multiplier 2) + jitter
      await vi.advanceTimersByTimeAsync(2500);
      expect(mockFn).toHaveBeenCalledTimes(3);

      await promise;
    });

    it('should use custom delay values', async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockResolvedValueOnce('success');

      const promise = retryWithBackoff(mockFn, {
        initialDelayMs: 500,
        backoffMultiplier: 3,
      });

      await vi.advanceTimersByTimeAsync(0);
      expect(mockFn).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(750); // 500ms + jitter
      expect(mockFn).toHaveBeenCalledTimes(2);

      await promise;
    });

    it('should respect maxDelayMs', async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockRejectedValueOnce(new Error('Failure 3'))
        .mockResolvedValueOnce('success');

      const options: RetryOptions = {
        initialDelayMs: 100,
        maxDelayMs: 150,
        backoffMultiplier: 10,
        maxAttempts: 4,
      };

      const promise = retryWithBackoff(mockFn, options);

      await vi.advanceTimersByTimeAsync(0);
      expect(mockFn).toHaveBeenCalledTimes(1);

      // First retry: 100ms
      await vi.advanceTimersByTimeAsync(150);
      expect(mockFn).toHaveBeenCalledTimes(2);

      // Second retry: would be 1000ms but capped at 150ms
      await vi.advanceTimersByTimeAsync(200);
      expect(mockFn).toHaveBeenCalledTimes(3);

      // Third retry: still capped at 150ms
      await vi.advanceTimersByTimeAsync(200);
      expect(mockFn).toHaveBeenCalledTimes(4);

      await promise;
    });
  });

  describe('onRetry callback', () => {
    it('should call onRetry callback on each retry', async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockResolvedValueOnce('success');

      const onRetry = vi.fn();

      const promise = retryWithBackoff(mockFn, { maxAttempts: 3, onRetry });
      await vi.runAllTimersAsync();
      await promise;

      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenNthCalledWith(1, 1, expect.any(Error));
      expect(onRetry).toHaveBeenNthCalledWith(2, 2, expect.any(Error));
    });

    it('should not call onRetry on first attempt', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');
      const onRetry = vi.fn();

      const promise = retryWithBackoff(mockFn, { onRetry });
      await vi.runAllTimersAsync();
      await promise;

      expect(onRetry).not.toHaveBeenCalled();
    });

    it('should not call onRetry after last failed attempt', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Persistent failure'));
      const onRetry = vi.fn();

      const promise = retryWithBackoff(mockFn, { maxAttempts: 2, onRetry });
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow();

      // Only called once after first attempt, not after second (final) attempt
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });
});

describe('retryNetworkOperation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should use network-specific default options', async () => {
    const mockFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce('success');

    const promise = retryNetworkOperation(mockFn);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it('should not retry on authentication errors', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('Unauthorized access'));

    const promise = retryNetworkOperation(mockFn);
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow('Unauthorized access');
    // Should fail on first attempt without retry
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should not retry on validation errors', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('Validation failed: invalid input'));

    const promise = retryNetworkOperation(mockFn);
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow('Validation failed');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should not retry on 400 errors', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('400 Bad Request'));

    const promise = retryNetworkOperation(mockFn);
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow('400 Bad Request');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should not retry on 404 errors', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('404 Not Found'));

    const promise = retryNetworkOperation(mockFn);
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow('404 Not Found');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should retry on 500 errors', async () => {
    const mockFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('500 Internal Server Error'))
      .mockResolvedValueOnce('success');

    const promise = retryNetworkOperation(mockFn);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it('should retry on network timeout', async () => {
    const mockFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network timeout'))
      .mockResolvedValueOnce('success');

    const promise = retryNetworkOperation(mockFn);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(2);
  });
});

describe('retryStorageOperation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should use storage-specific default options', async () => {
    const mockFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('Storage error'))
      .mockResolvedValueOnce('success');

    const promise = retryStorageOperation(mockFn);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it('should allow up to 5 attempts for storage operations', async () => {
    const mockFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('Failure 1'))
      .mockRejectedValueOnce(new Error('Failure 2'))
      .mockRejectedValueOnce(new Error('Failure 3'))
      .mockRejectedValueOnce(new Error('Failure 4'))
      .mockResolvedValueOnce('success');

    const promise = retryStorageOperation(mockFn);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(5);
  });

  it('should fail after 5 attempts', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('Persistent storage error'));

    const promise = retryStorageOperation(mockFn);
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow('Persistent storage error');
    expect(mockFn).toHaveBeenCalledTimes(5);
  });

  it('should support custom options override', async () => {
    const mockFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('Failure'))
      .mockResolvedValueOnce('success');

    const promise = retryStorageOperation(mockFn, { maxAttempts: 2 });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(2);
  });
});
