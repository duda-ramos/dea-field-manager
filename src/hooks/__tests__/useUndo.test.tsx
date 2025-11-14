import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useUndo, useRegisterUndoFunctions, type AddActionParams } from '../useUndo';
import { getUndoManager } from '@/lib/undo';
import type { ActionType } from '@/lib/undo';

// Mock undo library
vi.mock('@/lib/undo', () => {
  const mockUndoManager = {
    addAction: vi.fn(),
    getHistory: vi.fn(() => []),
    canUndo: vi.fn(() => false),
    getLastAction: vi.fn(() => null),
    removeLastAction: vi.fn(),
    clear: vi.fn(),
    reloadFromStorage: vi.fn(),
    registerUndoFunction: vi.fn()
  };

  return {
    getUndoManager: vi.fn(() => mockUndoManager)
  };
});

describe('useUndo', () => {
  const mockUndoManager = getUndoManager();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mockUndoManager.getHistory).mockReturnValue([]);
    vi.mocked(mockUndoManager.canUndo).mockReturnValue(false);
    vi.mocked(mockUndoManager.getLastAction).mockReturnValue(null);
  });

  describe('initialization', () => {
    it('should initialize with empty state', () => {
      const { result } = renderHook(() => useUndo());

      expect(result.current.history).toEqual([]);
      expect(result.current.canUndo).toBe(false);
      expect(result.current.lastAction).toBeNull();
    });

    it('should reload history from storage on mount', () => {
      renderHook(() => useUndo());

      expect(mockUndoManager.reloadFromStorage).toHaveBeenCalled();
    });
  });

  describe('addAction', () => {
    it('should add action with generated id and timestamp', () => {
      const { result } = renderHook(() => useUndo());

      const mockAction: AddActionParams = {
        type: 'delete_project' as ActionType,
        description: 'Delete project',
        undo: vi.fn()
      };

      act(() => {
        result.current.addAction(mockAction);
      });

      expect(mockUndoManager.addAction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'delete_project',
          description: 'Delete project',
          id: expect.stringMatching(/^action_\d+_[a-z0-9]+$/),
          timestamp: expect.any(Number)
        })
      );
    });

    it('should generate unique action IDs', () => {
      const { result } = renderHook(() => useUndo());

      const mockAction1: AddActionParams = {
        type: 'delete_project' as ActionType,
        description: 'Action 1',
        undo: vi.fn()
      };

      const mockAction2: AddActionParams = {
        type: 'delete_project' as ActionType,
        description: 'Action 2',
        undo: vi.fn()
      };

      act(() => {
        result.current.addAction(mockAction1);
        result.current.addAction(mockAction2);
      });

      const calls = vi.mocked(mockUndoManager.addAction).mock.calls;
      expect(calls[0][0].id).not.toBe(calls[1][0].id);
    });

    it('should preserve action data', () => {
      const { result } = renderHook(() => useUndo());

      const undoFn = vi.fn();
      const mockAction: AddActionParams = {
        type: 'delete_installation' as ActionType,
        description: 'Delete installation XYZ',
        data: { installationId: 'inst-123' },
        undo: undoFn
      };

      act(() => {
        result.current.addAction(mockAction);
      });

      expect(mockUndoManager.addAction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'delete_installation',
          description: 'Delete installation XYZ',
          data: { installationId: 'inst-123' },
          undo: undoFn
        })
      );
    });
  });

  describe('undo', () => {
    it('should execute undo and remove action from history', async () => {
      const undoFn = vi.fn().mockResolvedValue(undefined);
      const mockAction = {
        id: 'action_1',
        type: 'delete_project' as ActionType,
        description: 'Delete project',
        timestamp: Date.now(),
        undo: undoFn
      };

      vi.mocked(mockUndoManager.getLastAction).mockReturnValue(mockAction);

      const { result } = renderHook(() => useUndo());

      let undoResult: boolean | undefined;
      await act(async () => {
        undoResult = await result.current.undo();
      });

      expect(undoFn).toHaveBeenCalled();
      expect(mockUndoManager.removeLastAction).toHaveBeenCalled();
      expect(undoResult).toBe(true);
    });

    it('should return false when no action to undo', async () => {
      vi.mocked(mockUndoManager.getLastAction).mockReturnValue(null);

      const { result } = renderHook(() => useUndo());

      let undoResult: boolean | undefined;
      await act(async () => {
        undoResult = await result.current.undo();
      });

      expect(undoResult).toBe(false);
      expect(mockUndoManager.removeLastAction).not.toHaveBeenCalled();
    });

    it('should throw error if undo function fails', async () => {
      const undoFn = vi.fn().mockRejectedValue(new Error('Undo failed'));
      const mockAction = {
        id: 'action_1',
        type: 'delete_project' as ActionType,
        description: 'Delete project',
        timestamp: Date.now(),
        undo: undoFn
      };

      vi.mocked(mockUndoManager.getLastAction).mockReturnValue(mockAction);

      const { result } = renderHook(() => useUndo());

      await expect(async () => {
        await act(async () => {
          await result.current.undo();
        });
      }).rejects.toThrow('Undo failed');

      expect(undoFn).toHaveBeenCalled();
      // Should not remove action if undo fails
      expect(mockUndoManager.removeLastAction).not.toHaveBeenCalled();
    });

    it('should handle async undo functions', async () => {
      const asyncUndoFn = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return;
      });

      const mockAction = {
        id: 'action_1',
        type: 'delete_project' as ActionType,
        description: 'Delete project',
        timestamp: Date.now(),
        undo: asyncUndoFn
      };

      vi.mocked(mockUndoManager.getLastAction).mockReturnValue(mockAction);

      const { result } = renderHook(() => useUndo());

      let undoResult: boolean | undefined;
      await act(async () => {
        undoResult = await result.current.undo();
      });

      expect(asyncUndoFn).toHaveBeenCalled();
      expect(mockUndoManager.removeLastAction).toHaveBeenCalled();
      expect(undoResult).toBe(true);
    });
  });

  describe('clearHistory', () => {
    it('should clear all actions', () => {
      const { result } = renderHook(() => useUndo());

      act(() => {
        result.current.clearHistory();
      });

      expect(mockUndoManager.clear).toHaveBeenCalled();
    });
  });

  describe('state updates', () => {
    it('should reflect history state', () => {
      const mockHistory = [
        {
          id: 'action_1',
          type: 'delete_project' as ActionType,
          description: 'Action 1',
          timestamp: Date.now(),
          undo: vi.fn()
        }
      ];

      vi.mocked(mockUndoManager.getHistory).mockReturnValue(mockHistory);
      vi.mocked(mockUndoManager.canUndo).mockReturnValue(true);
      vi.mocked(mockUndoManager.getLastAction).mockReturnValue(mockHistory[0]);

      const { result } = renderHook(() => useUndo());

      expect(result.current.history).toEqual(mockHistory);
      expect(result.current.canUndo).toBe(true);
      expect(result.current.lastAction).toEqual(mockHistory[0]);
    });
  });
});

describe('useRegisterUndoFunctions', () => {
  const mockUndoManager = getUndoManager();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should register undo functions on mount', () => {
    const undoFn1 = vi.fn();
    const undoFn2 = vi.fn();

    const functions = [
      { type: 'delete_project' as ActionType, undoFn: undoFn1 },
      { type: 'delete_installation' as ActionType, undoFn: undoFn2 }
    ];

    renderHook(() => useRegisterUndoFunctions(functions));

    expect(mockUndoManager.registerUndoFunction).toHaveBeenCalledWith('delete_project', undoFn1);
    expect(mockUndoManager.registerUndoFunction).toHaveBeenCalledWith('delete_installation', undoFn2);
    expect(mockUndoManager.reloadFromStorage).toHaveBeenCalled();
  });

  it('should handle empty functions array', () => {
    renderHook(() => useRegisterUndoFunctions([]));

    expect(mockUndoManager.registerUndoFunction).not.toHaveBeenCalled();
    expect(mockUndoManager.reloadFromStorage).toHaveBeenCalled();
  });

  it('should register multiple functions of same type', () => {
    const undoFn1 = vi.fn();
    const undoFn2 = vi.fn();

    const functions = [
      { type: 'delete_project' as ActionType, undoFn: undoFn1 },
      { type: 'delete_project' as ActionType, undoFn: undoFn2 }
    ];

    renderHook(() => useRegisterUndoFunctions(functions));

    expect(mockUndoManager.registerUndoFunction).toHaveBeenCalledTimes(2);
    expect(mockUndoManager.registerUndoFunction).toHaveBeenCalledWith('delete_project', undoFn1);
    expect(mockUndoManager.registerUndoFunction).toHaveBeenCalledWith('delete_project', undoFn2);
  });
});
