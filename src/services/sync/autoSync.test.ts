import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { autoSyncManager } from './autoSync';

// Mock dependencies
vi.mock('./sync', () => ({
  syncPull: vi.fn(),
  syncPush: vi.fn(),
}));

vi.mock('@/lib/preferences', () => ({
  getSyncPreferences: vi.fn(() => ({
    autoPullOnStart: true,
    autoPushOnExit: true,
    periodicPullEnabled: true,
    periodicPullInterval: 5, // 5 minutes
  })),
}));

vi.mock('./syncState', () => ({
  syncStateManager: {
    getState: vi.fn(() => ({ isOnline: true, status: 'idle' })),
    updateState: vi.fn(),
    setError: vi.fn(),
  },
}));

vi.mock('@/services/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    syncError: vi.fn(),
  },
}));

import { syncPull, syncPush } from './sync';
import { getSyncPreferences } from '@/lib/preferences';
import { syncStateManager } from './syncState';
import { logger } from '@/services/logger';

describe('AutoSyncManager', () => {
  let visibilityChangeListener: ((this: Document, ev: Event) => any) | null = null;
  let pageHideListener: ((this: Window, ev: PageTransitionEvent) => any) | null = null;

  const createPageHideEvent = (persisted: boolean) => {
    const event = new Event('pagehide') as PageTransitionEvent;
    Object.defineProperty(event, 'persisted', { value: persisted, configurable: true });
    return event;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Reset document state
    Object.defineProperty(document, 'hidden', {
      writable: true,
      configurable: true,
      value: false,
    });

    // Capture event listeners
    const originalAddEventListener = document.addEventListener;
    vi.spyOn(document, 'addEventListener').mockImplementation((event, listener, options) => {
      if (event === 'visibilitychange') {
        visibilityChangeListener = listener as any;
      }
      return originalAddEventListener.call(document, event, listener, options);
    });

    const originalWindowAddEventListener = window.addEventListener;
    vi.spyOn(window, 'addEventListener').mockImplementation((event, listener, options) => {
      if (event === 'pagehide') {
        pageHideListener = listener as any;
      }
      return originalWindowAddEventListener.call(window, event, listener, options);
    });

    // Cleanup before each test
    autoSyncManager.cleanup();
  });

  afterEach(() => {
    vi.useRealTimers();
    autoSyncManager.cleanup();
  });

  describe('initialize', () => {
    it('should set up event listeners', async () => {
      await autoSyncManager.initialize();

      expect(document.addEventListener).toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function)
      );
      expect(window.addEventListener).toHaveBeenCalledWith(
        'pagehide',
        expect.any(Function)
      );
    });

    it('should set up periodic sync when enabled', async () => {
      (getSyncPreferences as any).mockReturnValue({
        autoPullOnStart: false,
        autoPushOnExit: false,
        periodicPullEnabled: true,
        periodicPullInterval: 5,
      });

      await autoSyncManager.initialize();

      // Should set up interval (checked by advancing timers and seeing if sync is called)
      vi.advanceTimersByTime(5 * 60 * 1000); // 5 minutes
      await vi.runAllTimersAsync();

      expect(syncPull).toHaveBeenCalled();
    });

    it('should not set up periodic sync when disabled', async () => {
      (getSyncPreferences as any).mockReturnValue({
        autoPullOnStart: false,
        autoPushOnExit: false,
        periodicPullEnabled: false,
        periodicPullInterval: 5,
      });

      await autoSyncManager.initialize();

      vi.advanceTimersByTime(10 * 60 * 1000); // 10 minutes
      await vi.runAllTimersAsync();

      expect(syncPull).not.toHaveBeenCalled();
    });
  });

  describe('initializeWithAuth', () => {
    it('should trigger initial pull when autoPullOnStart is enabled', async () => {
      (getSyncPreferences as any).mockReturnValue({
        autoPullOnStart: true,
        autoPushOnExit: false,
        periodicPullEnabled: false,
        periodicPullInterval: 5,
      });

      (syncPull as any).mockResolvedValue(undefined);

      await autoSyncManager.initialize();
      await autoSyncManager.initializeWithAuth();

      expect(syncPull).toHaveBeenCalled();
      expect(syncStateManager.updateState).toHaveBeenCalledWith({ status: 'syncing' });
      expect(syncStateManager.updateState).toHaveBeenCalledWith({ status: 'idle' });
    });

    it('should not trigger initial pull when autoPullOnStart is disabled', async () => {
      (getSyncPreferences as any).mockReturnValue({
        autoPullOnStart: false,
        autoPushOnExit: false,
        periodicPullEnabled: false,
        periodicPullInterval: 5,
      });

      await autoSyncManager.initialize();
      await autoSyncManager.initializeWithAuth();

      expect(syncPull).not.toHaveBeenCalled();
    });

    it('should handle pull errors gracefully', async () => {
      (getSyncPreferences as any).mockReturnValue({
        autoPullOnStart: true,
        autoPushOnExit: false,
        periodicPullEnabled: false,
        periodicPullInterval: 5,
      });

      const error = new Error('Pull failed');
      (syncPull as any).mockRejectedValue(error);

      await autoSyncManager.initialize();
      await autoSyncManager.initializeWithAuth();

      expect(syncStateManager.setError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Falha ao carregar dados',
          operation: 'boot-pull',
        })
      );
    });
  });

  describe('visibility change handling', () => {
    beforeEach(async () => {
      await autoSyncManager.initialize();
    });

    it('should sync when page becomes hidden', async () => {
      (getSyncPreferences as any).mockReturnValue({
        autoPullOnStart: false,
        autoPushOnExit: true,
        periodicPullEnabled: false,
        periodicPullInterval: 5,
      });

      Object.defineProperty(document, 'hidden', { value: true, writable: true });

      if (visibilityChangeListener) {
        visibilityChangeListener.call(document, new Event('visibilitychange'));
      }

      await vi.runAllTimersAsync();

      expect(syncPush).toHaveBeenCalled();
    });

    it('should not sync when page becomes hidden if autoPushOnExit is disabled', async () => {
      (getSyncPreferences as any).mockReturnValue({
        autoPullOnStart: false,
        autoPushOnExit: false,
        periodicPullEnabled: false,
        periodicPullInterval: 5,
      });

      Object.defineProperty(document, 'hidden', { value: true, writable: true });

      if (visibilityChangeListener) {
        visibilityChangeListener.call(document, new Event('visibilitychange'));
      }

      await vi.runAllTimersAsync();

      expect(syncPush).not.toHaveBeenCalled();
    });

    it('should not sync when offline', async () => {
      (getSyncPreferences as any).mockReturnValue({
        autoPullOnStart: false,
        autoPushOnExit: true,
        periodicPullEnabled: false,
        periodicPullInterval: 5,
      });

      (syncStateManager.getState as any).mockReturnValue({ isOnline: false, status: 'idle' });

      Object.defineProperty(document, 'hidden', { value: true, writable: true });

      if (visibilityChangeListener) {
        visibilityChangeListener.call(document, new Event('visibilitychange'));
      }

      await vi.runAllTimersAsync();

      expect(syncPush).not.toHaveBeenCalled();
    });
  });

  describe('page hide handling', () => {
    beforeEach(async () => {
      await autoSyncManager.initialize();
    });

    it('should sync on page unload when not persisted', async () => {
      (getSyncPreferences as any).mockReturnValue({
        autoPullOnStart: false,
        autoPushOnExit: true,
        periodicPullEnabled: false,
        periodicPullInterval: 5,
      });

      if (pageHideListener) {
        pageHideListener.call(window, createPageHideEvent(false));
      }

      await vi.runAllTimersAsync();

      expect(syncPush).toHaveBeenCalled();
    });

    it('should not sync on page hide when persisted (back/forward cache)', async () => {
      (getSyncPreferences as any).mockReturnValue({
        autoPullOnStart: false,
        autoPushOnExit: true,
        periodicPullEnabled: false,
        periodicPullInterval: 5,
      });

      if (pageHideListener) {
        pageHideListener.call(window, createPageHideEvent(true));
      }

      await vi.runAllTimersAsync();

      expect(syncPush).not.toHaveBeenCalled();
    });
  });

  describe('debounced sync', () => {
    it('should trigger sync after debounce delay', async () => {
      (getSyncPreferences as any).mockReturnValue({
        autoPullOnStart: false,
        autoPushOnExit: false,
        periodicPullEnabled: false,
        periodicPullInterval: 5,
      });

      await autoSyncManager.initialize();
      autoSyncManager.triggerDebouncedSync();

      // Should not sync immediately
      expect(syncPush).not.toHaveBeenCalled();

      // After 3 seconds (debounce delay)
      vi.advanceTimersByTime(3000);
      await vi.runAllTimersAsync();

      expect(syncPush).toHaveBeenCalled();
    });

    it('should reset debounce timer on multiple calls', async () => {
      await autoSyncManager.initialize();

      autoSyncManager.triggerDebouncedSync();
      vi.advanceTimersByTime(2000);

      // Trigger again before first completes
      autoSyncManager.triggerDebouncedSync();

      vi.advanceTimersByTime(2000); // Total 4s, but only 2s since last trigger
      await vi.runAllTimersAsync();

      // Should not have synced yet (needs 3s from last trigger)
      expect(syncPush).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1000); // Now 3s since last trigger
      await vi.runAllTimersAsync();

      expect(syncPush).toHaveBeenCalledTimes(1);
    });

    it('should not sync when offline', async () => {
      (syncStateManager.getState as any).mockReturnValue({ isOnline: false, status: 'idle' });

      await autoSyncManager.initialize();
      autoSyncManager.triggerDebouncedSync();

      vi.advanceTimersByTime(3000);
      await vi.runAllTimersAsync();

      expect(syncPush).not.toHaveBeenCalled();
    });
  });

  describe('periodic sync', () => {
    it('should pull periodically when enabled', async () => {
      (getSyncPreferences as any).mockReturnValue({
        autoPullOnStart: false,
        autoPushOnExit: false,
        periodicPullEnabled: true,
        periodicPullInterval: 5, // 5 minutes
      });

      await autoSyncManager.initialize();

      // First interval
      vi.advanceTimersByTime(5 * 60 * 1000);
      await vi.runAllTimersAsync();
      expect(syncPull).toHaveBeenCalledTimes(1);

      // Second interval
      vi.advanceTimersByTime(5 * 60 * 1000);
      await vi.runAllTimersAsync();
      expect(syncPull).toHaveBeenCalledTimes(2);
    });

    it('should only pull when page is visible', async () => {
      (getSyncPreferences as any).mockReturnValue({
        autoPullOnStart: false,
        autoPushOnExit: false,
        periodicPullEnabled: true,
        periodicPullInterval: 5,
      });

      await autoSyncManager.initialize();

      // Hide the page
      Object.defineProperty(document, 'hidden', { value: true, writable: true });

      vi.advanceTimersByTime(5 * 60 * 1000);
      await vi.runAllTimersAsync();

      expect(syncPull).not.toHaveBeenCalled();

      // Show the page
      Object.defineProperty(document, 'hidden', { value: false, writable: true });

      vi.advanceTimersByTime(5 * 60 * 1000);
      await vi.runAllTimersAsync();

      expect(syncPull).toHaveBeenCalled();
    });

    it('should only pull when online', async () => {
      (getSyncPreferences as any).mockReturnValue({
        autoPullOnStart: false,
        autoPushOnExit: false,
        periodicPullEnabled: true,
        periodicPullInterval: 5,
      });

      (syncStateManager.getState as any).mockReturnValue({ isOnline: false, status: 'idle' });

      await autoSyncManager.initialize();

      vi.advanceTimersByTime(5 * 60 * 1000);
      await vi.runAllTimersAsync();

      expect(syncPull).not.toHaveBeenCalled();
    });

    it('should update periodic sync interval', async () => {
      (getSyncPreferences as any).mockReturnValue({
        autoPullOnStart: false,
        autoPushOnExit: false,
        periodicPullEnabled: true,
        periodicPullInterval: 5,
      });

      await autoSyncManager.initialize();

      // Change interval to 10 minutes
      (getSyncPreferences as any).mockReturnValue({
        autoPullOnStart: false,
        autoPushOnExit: false,
        periodicPullEnabled: true,
        periodicPullInterval: 10,
      });

      autoSyncManager.updatePeriodicSync();

      // Old interval should not trigger
      vi.advanceTimersByTime(5 * 60 * 1000);
      await vi.runAllTimersAsync();
      expect(syncPull).not.toHaveBeenCalled();

      // New interval should trigger
      vi.advanceTimersByTime(5 * 60 * 1000); // Total 10 minutes
      await vi.runAllTimersAsync();
      expect(syncPull).toHaveBeenCalled();
    });

    it('should disable periodic sync when updated to disabled', async () => {
      (getSyncPreferences as any).mockReturnValue({
        autoPullOnStart: false,
        autoPushOnExit: false,
        periodicPullEnabled: true,
        periodicPullInterval: 5,
      });

      await autoSyncManager.initialize();

      // Disable periodic sync
      (getSyncPreferences as any).mockReturnValue({
        autoPullOnStart: false,
        autoPushOnExit: false,
        periodicPullEnabled: false,
        periodicPullInterval: 5,
      });

      autoSyncManager.updatePeriodicSync();

      vi.advanceTimersByTime(10 * 60 * 1000);
      await vi.runAllTimersAsync();

      expect(syncPull).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should clear debounce timer', async () => {
      await autoSyncManager.initialize();
      autoSyncManager.triggerDebouncedSync();

      autoSyncManager.cleanup();

      vi.advanceTimersByTime(5000);
      await vi.runAllTimersAsync();

      expect(syncPush).not.toHaveBeenCalled();
    });

    it('should clear periodic timer', async () => {
      (getSyncPreferences as any).mockReturnValue({
        autoPullOnStart: false,
        autoPushOnExit: false,
        periodicPullEnabled: true,
        periodicPullInterval: 5,
      });

      await autoSyncManager.initialize();
      autoSyncManager.cleanup();

      vi.advanceTimersByTime(10 * 60 * 1000);
      await vi.runAllTimersAsync();

      expect(syncPull).not.toHaveBeenCalled();
    });

    it('should remove event listeners', async () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
      const windowRemoveEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      await autoSyncManager.initialize();
      autoSyncManager.cleanup();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function)
      );
      expect(windowRemoveEventListenerSpy).toHaveBeenCalledWith(
        'pagehide',
        expect.any(Function)
      );
    });
  });
});
