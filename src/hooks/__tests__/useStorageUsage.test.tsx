import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useStorageUsage, useStorageCleanup } from '../useStorageUsage';
import { db } from '@/db/indexedDb';

// Mock dependencies
vi.mock('@/db/indexedDb', () => ({
  db: {
    projects: {
      count: vi.fn(),
      where: vi.fn(),
      delete: vi.fn()
    },
    installations: {
      count: vi.fn()
    },
    files: {
      count: vi.fn()
    },
    contacts: {
      count: vi.fn()
    }
  }
}));

vi.mock('@/services/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}));

describe('useStorageUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('with Storage API support', () => {
    it('should calculate storage usage using Storage API', async () => {
      const mockEstimate = {
        usage: 10 * 1024 * 1024, // 10MB used
        quota: 100 * 1024 * 1024  // 100MB total
      };

      vi.stubGlobal('navigator', {
        storage: {
          estimate: vi.fn().mockResolvedValue(mockEstimate)
        }
      });

      const { result } = renderHook(() => useStorageUsage());

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.used).toBe(10 * 1024 * 1024);
      expect(result.current.quota).toBe(100 * 1024 * 1024);
      expect(result.current.percentage).toBe(10);
      expect(result.current.isNearLimit).toBe(false);
      expect(result.current.isAtLimit).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should detect near limit (80%) threshold', async () => {
      const mockEstimate = {
        usage: 85 * 1024 * 1024, // 85MB used
        quota: 100 * 1024 * 1024  // 100MB total
      };

      vi.stubGlobal('navigator', {
        storage: {
          estimate: vi.fn().mockResolvedValue(mockEstimate)
        }
      });

      const { result } = renderHook(() => useStorageUsage());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.percentage).toBe(85);
      expect(result.current.isNearLimit).toBe(true);
      expect(result.current.isAtLimit).toBe(false);
    });

    it('should detect at limit (95%) threshold', async () => {
      const mockEstimate = {
        usage: 96 * 1024 * 1024, // 96MB used
        quota: 100 * 1024 * 1024  // 100MB total
      };

      vi.stubGlobal('navigator', {
        storage: {
          estimate: vi.fn().mockResolvedValue(mockEstimate)
        }
      });

      const { result } = renderHook(() => useStorageUsage());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.percentage).toBe(96);
      expect(result.current.isNearLimit).toBe(true);
      expect(result.current.isAtLimit).toBe(true);
    });

    it('should handle zero quota', async () => {
      const mockEstimate = {
        usage: 0,
        quota: 0
      };

      vi.stubGlobal('navigator', {
        storage: {
          estimate: vi.fn().mockResolvedValue(mockEstimate)
        }
      });

      const { result } = renderHook(() => useStorageUsage());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.percentage).toBe(0);
      expect(result.current.isNearLimit).toBe(false);
      expect(result.current.isAtLimit).toBe(false);
    });

    it('should refresh usage periodically', async () => {
      const mockEstimate = {
        usage: 10 * 1024 * 1024,
        quota: 100 * 1024 * 1024
      };

      const estimateFn = vi.fn().mockResolvedValue(mockEstimate);

      vi.stubGlobal('navigator', {
        storage: {
          estimate: estimateFn
        }
      });

      renderHook(() => useStorageUsage());

      await waitFor(() => {
        expect(estimateFn).toHaveBeenCalledTimes(1);
      });

      // Fast-forward 60 seconds (refresh interval)
      act(() => {
        vi.advanceTimersByTime(60000);
      });

      await waitFor(() => {
        expect(estimateFn).toHaveBeenCalledTimes(2);
      });

      // Fast-forward another 60 seconds
      act(() => {
        vi.advanceTimersByTime(60000);
      });

      await waitFor(() => {
        expect(estimateFn).toHaveBeenCalledTimes(3);
      });
    });

    it('should support manual refresh', async () => {
      const mockEstimate = {
        usage: 10 * 1024 * 1024,
        quota: 100 * 1024 * 1024
      };

      const estimateFn = vi.fn().mockResolvedValue(mockEstimate);

      vi.stubGlobal('navigator', {
        storage: {
          estimate: estimateFn
        }
      });

      const { result } = renderHook(() => useStorageUsage());

      await waitFor(() => {
        expect(estimateFn).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        await result.current.refresh();
      });

      expect(estimateFn).toHaveBeenCalledTimes(2);
    });

    it('should format bytes correctly', async () => {
      const mockEstimate = {
        usage: 5.5 * 1024 * 1024, // 5.5MB
        quota: 100 * 1024 * 1024   // 100MB
      };

      vi.stubGlobal('navigator', {
        storage: {
          estimate: vi.fn().mockResolvedValue(mockEstimate)
        }
      });

      const { result } = renderHook(() => useStorageUsage());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.formatUsed()).toBe('5.50 MB');
      expect(result.current.formatQuota()).toBe('100.00 MB');
    });
  });

  describe('without Storage API support (fallback)', () => {
    it('should estimate storage using IndexedDB counts', async () => {
      vi.stubGlobal('navigator', {}); // No storage API

      vi.mocked(db.projects.count).mockResolvedValue(10);
      vi.mocked(db.installations.count).mockResolvedValue(50);
      vi.mocked(db.files.count).mockResolvedValue(30);
      vi.mocked(db.contacts.count).mockResolvedValue(20);

      const { result } = renderHook(() => useStorageUsage());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Expected calculation:
      // Projects: 10 * 10KB = 100KB
      // Installations: 50 * 5KB = 250KB
      // Files: 30 * 2KB = 60KB
      // Contacts: 20 * 1KB = 20KB
      // Total: 430KB
      const expectedUsed =
        (10 * 10 * 1024) +
        (50 * 5 * 1024) +
        (30 * 2 * 1024) +
        (20 * 1 * 1024);

      const expectedQuota = 50 * 1024 * 1024; // 50MB default

      expect(result.current.used).toBe(expectedUsed);
      expect(result.current.quota).toBe(expectedQuota);
      expect(result.current.percentage).toBeCloseTo(
        (expectedUsed / expectedQuota) * 100,
        2
      );
    });

    it('should handle database count errors', async () => {
      vi.stubGlobal('navigator', {});

      vi.mocked(db.projects.count).mockRejectedValue(new Error('DB error'));

      const { result } = renderHook(() => useStorageUsage());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.used).toBe(0);
      expect(result.current.quota).toBe(0);
      expect(result.current.error).toBe('Não foi possível calcular o uso de armazenamento');
    });
  });

  describe('error handling', () => {
    it('should handle Storage API errors', async () => {
      vi.stubGlobal('navigator', {
        storage: {
          estimate: vi.fn().mockRejectedValue(new Error('Storage error'))
        }
      });

      const { result } = renderHook(() => useStorageUsage());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Não foi possível calcular o uso de armazenamento');
    });
  });

  describe('formatBytes helper', () => {
    it('should format different byte sizes correctly', async () => {
      const testCases = [
        { bytes: 0, expected: '0 B' },
        { bytes: 512, expected: '512.00 B' },
        { bytes: 1024, expected: '1.00 KB' },
        { bytes: 1536, expected: '1.50 KB' },
        { bytes: 1024 * 1024, expected: '1.00 MB' },
        { bytes: 2.5 * 1024 * 1024, expected: '2.50 MB' },
        { bytes: 1024 * 1024 * 1024, expected: '1.00 GB' }
      ];

      for (const testCase of testCases) {
        const mockEstimate = {
          usage: testCase.bytes,
          quota: 100 * 1024 * 1024
        };

        vi.stubGlobal('navigator', {
          storage: {
            estimate: vi.fn().mockResolvedValue(mockEstimate)
          }
        });

        const { result } = renderHook(() => useStorageUsage());

        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        expect(result.current.formatUsed()).toBe(testCase.expected);
      }
    });
  });
});

describe('useStorageCleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should clear projects deleted more than 30 days ago', async () => {
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

    const oldDeletedProjects = [
      { id: 'proj-1', deleted_at: thirtyDaysAgo - 1000 },
      { id: 'proj-2', deleted_at: thirtyDaysAgo - 5000 }
    ];

    const whereMock = {
      below: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue(oldDeletedProjects)
      })
    };

    vi.mocked(db.projects.where).mockReturnValue(whereMock as any);
    vi.mocked(db.projects.delete).mockResolvedValue(undefined as any);

    const { result } = renderHook(() => useStorageCleanup());

    let cleanupResult: any;
    await act(async () => {
      cleanupResult = await result.current.clearOldData();
    });

    expect(db.projects.where).toHaveBeenCalledWith('deleted_at');
    expect(whereMock.below).toHaveBeenCalledWith(expect.any(Number));
    expect(db.projects.delete).toHaveBeenCalledWith('proj-1');
    expect(db.projects.delete).toHaveBeenCalledWith('proj-2');
    expect(cleanupResult).toEqual({ success: true, deletedCount: 2 });
  });

  it('should handle no old projects to clean', async () => {
    const whereMock = {
      below: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([])
      })
    };

    vi.mocked(db.projects.where).mockReturnValue(whereMock as any);

    const { result } = renderHook(() => useStorageCleanup());

    let cleanupResult: any;
    await act(async () => {
      cleanupResult = await result.current.clearOldData();
    });

    expect(db.projects.delete).not.toHaveBeenCalled();
    expect(cleanupResult).toEqual({ success: true, deletedCount: 0 });
  });

  it('should handle cleanup errors gracefully', async () => {
    const whereMock = {
      below: vi.fn().mockReturnValue({
        toArray: vi.fn().mockRejectedValue(new Error('Database error'))
      })
    };

    vi.mocked(db.projects.where).mockReturnValue(whereMock as any);

    const { result } = renderHook(() => useStorageCleanup());

    let cleanupResult: any;
    await act(async () => {
      cleanupResult = await result.current.clearOldData();
    });

    expect(cleanupResult).toEqual({ success: false, deletedCount: 0 });
  });

  it('should handle partial deletion failures', async () => {
    const oldDeletedProjects = [
      { id: 'proj-1', deleted_at: Date.now() - (31 * 24 * 60 * 60 * 1000) },
      { id: 'proj-2', deleted_at: Date.now() - (32 * 24 * 60 * 60 * 1000) }
    ];

    const whereMock = {
      below: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue(oldDeletedProjects)
      })
    };

    vi.mocked(db.projects.where).mockReturnValue(whereMock as any);
    vi.mocked(db.projects.delete)
      .mockResolvedValueOnce(undefined as any)
      .mockRejectedValueOnce(new Error('Delete failed'));

    const { result } = renderHook(() => useStorageCleanup());

    let cleanupResult: any;
    await act(async () => {
      cleanupResult = await result.current.clearOldData();
    });

    // Should fail because one deletion failed
    expect(cleanupResult).toEqual({ success: false, deletedCount: 0 });
  });
});
