// src/services/sync/autoSync.ts - Versão corrigida sem dependências problemáticas
import { syncPull, syncPush } from './sync';
import { getSyncPreferences } from '@/lib/preferences';
import { syncStateManager } from './syncState';

class AutoSyncManager {
  private debounceTimer: NodeJS.Timeout | null = null;
  private periodicTimer: NodeJS.Timeout | null = null;
  private isVisible = !document.hidden;
  private visibilityChangeHandler: (() => void) | null = null;
  private pageHideHandler: ((event: PageTransitionEvent) => void) | null = null;

  async initialize() {
    // Auto-sync initialization logged via logger service
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Setup periodic sync
    this.setupPeriodicSync();
    
    // Auto-sync initialization complete
  }

  async initializeWithAuth() {
    // Initial pull if enabled and user is authenticated
    const prefs = getSyncPreferences();
    if (prefs.autoPullOnStart) {
      await this.handleBootPull();
    }
  }

  private setupEventListeners() {
    // Use modern APIs instead of deprecated beforeunload
    this.visibilityChangeHandler = this.handleVisibilityChange.bind(this);
    document.addEventListener('visibilitychange', this.visibilityChangeHandler);

    // Use pagehide instead of beforeunload (more reliable)
    this.pageHideHandler = this.handlePageHide.bind(this);
    window.addEventListener('pagehide', this.pageHideHandler);
  }

  private handleVisibilityChange() {
    this.isVisible = !document.hidden;
    
    if (this.isVisible) {
      // Page became visible - resume periodic sync
      this.setupPeriodicSync();
    } else {
      // Page hidden - try to sync
      this.handleBackgroundSync();
    }
  }

  private handlePageHide(event: PageTransitionEvent) {
    // Only sync if page is being unloaded (not just cached)
    if (!event.persisted) {
      this.handlePageUnload();
    }
  }

  private async handleBackgroundSync() {
    const prefs = getSyncPreferences();
    const isOnline = syncStateManager.getState().isOnline;
    if (prefs.autoPushOnExit && isOnline) {
      try {
        // Non-blocking background sync
        void syncPush();
      } catch (_error) {
        // Background sync failure logged via logger service
      }
    }
  }

  private async handlePageUnload() {
    const prefs = getSyncPreferences();
    const isOnline = syncStateManager.getState().isOnline;
    if (prefs.autoPushOnExit && isOnline) {
      try {
        // Simple push without blocking
        void syncPush();
      } catch (_error) {
        // Page unload sync failure (expected behavior)
      }
    }
  }


  // Method compatible with existing StorageManagerDexie calls
  triggerDebouncedSync() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      const isOnline = syncStateManager.getState().isOnline;
      if (isOnline) {
        try {
          // Debounced auto-push in progress
          await syncPush();
          // Debounced auto-push completed
        } catch (_error) {
          // Debounced push failed - logged via logger service
        }
      }
    }, 3000);
  }

  private async handleBootPull() {
    try {
      // Auto-pull on start in progress
      await syncPull();
      // Auto-pull completed
    } catch (_error) {
      // Auto-pull failed - logged via logger service
    }
  }

  private setupPeriodicSync() {
    if (this.periodicTimer) {
      clearInterval(this.periodicTimer);
      this.periodicTimer = null;
    }

    const prefs = getSyncPreferences();
    if (!prefs.periodicPullEnabled || !prefs.periodicPullInterval) {
      return;
    }

    const intervalMs = prefs.periodicPullInterval * 60 * 1000;
    // Periodic pull scheduled - logged via logger service

    this.periodicTimer = setInterval(async () => {
      // Only run when page is visible and online
      const isOnline = syncStateManager.getState().isOnline;
      if (this.isVisible && isOnline) {
        try {
          // Periodic auto-pull in progress
          await syncPull();
          // Periodic auto-pull completed
        } catch (_error) {
          // Periodic pull failed - logged via logger service
        }
      }
    }, intervalMs);
  }

  // Method compatible with existing sync-preferences component
  updatePeriodicSync() {
    this.setupPeriodicSync();
  }

  cleanup() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    if (this.periodicTimer) {
      clearInterval(this.periodicTimer);
    }
    if (this.visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
      this.visibilityChangeHandler = null;
    }
    if (this.pageHideHandler) {
      window.removeEventListener('pagehide', this.pageHideHandler);
      this.pageHideHandler = null;
    }
  }
}

// Export singleton instance
export const autoSyncManager = new AutoSyncManager();