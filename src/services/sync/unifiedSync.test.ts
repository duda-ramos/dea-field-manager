import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { unifiedSync } from './unifiedSync';

// Mock dependencies
vi.mock('@/services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('./sync', () => ({
  fullSync: vi.fn(),
}));

vi.mock('./fileSync', () => ({
  fileSyncService: {
    uploadPendingFiles: vi.fn(),
    pushFiles: vi.fn(),
    pullFiles: vi.fn(),
  },
}));

vi.mock('./retryWithBackoff', () => ({
  retryWithBackoff: vi.fn((fn) => fn()),
}));

import { fullSync } from './sync';
import { retryWithBackoff } from './retryWithBackoff';

describe('UnifiedSyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('syncAll', () => {
    it('should successfully sync all entities', async () => {
      const mockSyncResult = {
        success: true,
        pushed: 5,
        pulled: 10,
        error: null,
      };

      (fullSync as any).mockResolvedValue(mockSyncResult);

      const result = await unifiedSync.syncAll();

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].entity).toBe('all');
      expect(result.results[0].pushed).toBe(5);
      expect(result.results[0].pulled).toBe(10);
      expect(result.results[0].errors).toEqual([]);
      expect(result.totalDuration).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeDefined();
    });

    it('should include error in results if sync fails', async () => {
      const mockSyncResult = {
        success: false,
        pushed: 2,
        pulled: 0,
        error: 'Network error occurred',
      };

      (fullSync as any).mockResolvedValue(mockSyncResult);

      const result = await unifiedSync.syncAll();

      expect(result.success).toBe(false);
      expect(result.results[0].errors).toEqual(['Network error occurred']);
    });

    it('should prevent concurrent syncs', async () => {
      let syncCallCount = 0;

      (fullSync as any).mockImplementation(async () => {
        syncCallCount++;
        await new Promise(resolve => setTimeout(resolve, 100));
        return { success: true, pushed: 1, pulled: 1, error: null };
      });

      // Start two syncs concurrently
      const promise1 = unifiedSync.syncAll();
      const promise2 = unifiedSync.syncAll();

      await vi.runAllTimersAsync();

      // First should succeed
      await expect(promise1).resolves.toBeDefined();

      // Second should fail with "Sync already in progress"
      await expect(promise2).rejects.toThrow('Sync already in progress');

      // fullSync should only be called once
      expect(syncCallCount).toBe(1);
    });

    it('should use retry with backoff', async () => {
      (fullSync as any).mockResolvedValue({
        success: true,
        pushed: 1,
        pulled: 1,
        error: null,
      });

      await unifiedSync.syncAll();

      expect(retryWithBackoff).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          maxAttempts: 2,
          initialDelayMs: 2000,
        })
      );
    });

    it('should update lastSyncAt timestamp on success', async () => {
      (fullSync as any).mockResolvedValue({
        success: true,
        pushed: 1,
        pulled: 1,
        error: null,
      });

      expect(unifiedSync.lastSync).toBeNull();

      await unifiedSync.syncAll();

      expect(unifiedSync.lastSync).toBeGreaterThan(0);
    });

    it('should reset syncing flag even on error', async () => {
      (fullSync as any).mockRejectedValue(new Error('Sync failed'));

      expect(unifiedSync.syncing).toBe(false);

      const promise = unifiedSync.syncAll();

      // Check that syncing is true during sync
      expect(unifiedSync.syncing).toBe(true);

      await expect(promise).rejects.toThrow('Sync failed');

      // Check that syncing is reset to false
      expect(unifiedSync.syncing).toBe(false);
    });

    it('should handle zero pushed and pulled records', async () => {
      (fullSync as any).mockResolvedValue({
        success: true,
        pushed: 0,
        pulled: 0,
        error: null,
      });

      const result = await unifiedSync.syncAll();

      expect(result.success).toBe(true);
      expect(result.results[0].pushed).toBe(0);
      expect(result.results[0].pulled).toBe(0);
    });

    it('should handle non-numeric pushed/pulled values', async () => {
      (fullSync as any).mockResolvedValue({
        success: true,
        pushed: undefined,
        pulled: null,
        error: null,
      });

      const result = await unifiedSync.syncAll();

      expect(result.results[0].pushed).toBe(0);
      expect(result.results[0].pulled).toBe(0);
    });

    it('should measure sync duration', async () => {
      (fullSync as any).mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
        return { success: true, pushed: 1, pulled: 1, error: null };
      });

      const startTime = Date.now();
      const promise = unifiedSync.syncAll();

      await vi.advanceTimersByTimeAsync(500);
      const result = await promise;

      expect(result.totalDuration).toBeGreaterThanOrEqual(0);
      expect(result.results[0].duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('syncSingle', () => {
    it('should sync all entities when any single entity is requested', async () => {
      (fullSync as any).mockResolvedValue({
        success: true,
        pushed: 1,
        pulled: 1,
        error: null,
      });

      const result = await unifiedSync.syncSingle('projects');

      expect(fullSync).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should work for all entity types', async () => {
      (fullSync as any).mockResolvedValue({
        success: true,
        pushed: 1,
        pulled: 1,
        error: null,
      });

      const entities: Array<'projects' | 'installations' | 'contacts' | 'budgets' | 'files' | 'all'> = [
        'projects',
        'installations',
        'contacts',
        'budgets',
        'files',
        'all',
      ];

      for (const entity of entities) {
        vi.clearAllMocks();
        const result = await unifiedSync.syncSingle(entity);
        expect(result.success).toBe(true);
        expect(fullSync).toHaveBeenCalled();
      }
    });
  });

  describe('syncing getter', () => {
    it('should return false when not syncing', () => {
      expect(unifiedSync.syncing).toBe(false);
    });

    it('should return true during sync', async () => {
      (fullSync as any).mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { success: true, pushed: 1, pulled: 1, error: null };
      });

      const promise = unifiedSync.syncAll();

      expect(unifiedSync.syncing).toBe(true);

      await vi.runAllTimersAsync();
      await promise;

      expect(unifiedSync.syncing).toBe(false);
    });
  });

  describe('lastSync getter', () => {
    it('should return null initially', () => {
      expect(unifiedSync.lastSync).toBeNull();
    });

    it('should return timestamp after successful sync', async () => {
      (fullSync as any).mockResolvedValue({
        success: true,
        pushed: 1,
        pulled: 1,
        error: null,
      });

      const beforeSync = Date.now();
      await unifiedSync.syncAll();
      const afterSync = Date.now();

      const lastSync = unifiedSync.lastSync;
      expect(lastSync).toBeGreaterThanOrEqual(beforeSync);
      expect(lastSync).toBeLessThanOrEqual(afterSync);
    });

    it('should not update timestamp on failed sync', async () => {
      (fullSync as any).mockRejectedValue(new Error('Sync failed'));

      const initialLastSync = unifiedSync.lastSync;

      try {
        await unifiedSync.syncAll();
      } catch (error) {
        // Expected error
      }

      expect(unifiedSync.lastSync).toBe(initialLastSync);
    });
  });

  describe('error handling', () => {
    it('should throw error if fullSync throws', async () => {
      const error = new Error('Network connection failed');
      (fullSync as any).mockRejectedValue(error);

      await expect(unifiedSync.syncAll()).rejects.toThrow('Network connection failed');
    });

    it('should handle Error objects', async () => {
      (fullSync as any).mockRejectedValue(new Error('Test error'));

      await expect(unifiedSync.syncAll()).rejects.toThrow('Test error');
    });

    it('should handle non-Error objects', async () => {
      (fullSync as any).mockRejectedValue('String error');

      await expect(unifiedSync.syncAll()).rejects.toThrow();
    });
  });

  describe('result format', () => {
    it('should return properly formatted UnifiedSyncResult', async () => {
      (fullSync as any).mockResolvedValue({
        success: true,
        pushed: 15,
        pulled: 23,
        error: null,
      });

      const result = await unifiedSync.syncAll();

      expect(result).toMatchObject({
        success: true,
        results: expect.arrayContaining([
          expect.objectContaining({
            entity: 'all',
            pushed: 15,
            pulled: 23,
            errors: [],
            duration: expect.any(Number),
          }),
        ]),
        totalDuration: expect.any(Number),
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/), // ISO format
      });
    });

    it('should include ISO timestamp in results', async () => {
      (fullSync as any).mockResolvedValue({
        success: true,
        pushed: 1,
        pulled: 1,
        error: null,
      });

      const result = await unifiedSync.syncAll();

      const timestamp = new Date(result.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).not.toBeNaN();
    });
  });

  describe('retry callback', () => {
    it('should pass retry callback to retryWithBackoff', async () => {
      (fullSync as any).mockResolvedValue({
        success: true,
        pushed: 1,
        pulled: 1,
        error: null,
      });

      await unifiedSync.syncAll();

      expect(retryWithBackoff).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          onRetry: expect.any(Function),
        })
      );
    });
  });
});
