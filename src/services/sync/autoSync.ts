// src/services/sync/autoSync.ts - Versão corrigida sem dependências problemáticas
import { syncPull, syncPush } from './sync';
import { getSyncPreferences } from '@/lib/preferences';

class AutoSyncManager {
  private debounceTimer: NodeJS.Timeout | null = null;
  private periodicTimer: NodeJS.Timeout | null = null;
  private isOnline = navigator.onLine;
  private isVisible = !document.hidden;

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
    // Online/offline detection
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.handleOnlineStatusChange();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.handleOnlineStatusChange();
    });

    // Use modern APIs instead of deprecated beforeunload
    document.addEventListener('visibilitychange', () => {
      this.isVisible = !document.hidden;
      
      if (this.isVisible) {
        // Page became visible - resume periodic sync
        this.setupPeriodicSync();
      } else {
        // Page hidden - try to sync
        this.handleBackgroundSync();
      }
    });

    // Use pagehide instead of beforeunload (more reliable)
    window.addEventListener('pagehide', (event) => {
      // Only sync if page is being unloaded (not just cached)
      if (!event.persisted) {
        this.handlePageUnload();
      }
    });
  }

  private async handleBackgroundSync() {
    const prefs = getSyncPreferences();
    if (prefs.autoPushOnExit && this.isOnline) {
      try {
        // Non-blocking background sync
        void syncPush();
      } catch (error) {
        // Background sync failure logged via logger service
      }
    }
  }

  private async handlePageUnload() {
    const prefs = getSyncPreferences();
    if (prefs.autoPushOnExit && this.isOnline) {
      try {
        // Simple push without blocking
        void syncPush();
      } catch (error) {
        // Page unload sync failure (expected behavior)
      }
    }
  }

  private handleOnlineStatusChange() {
    if (this.isOnline) {
      // Back online - trigger debounced push if needed
      this.triggerDebouncedSync();
    }
  }

  // Method compatible with existing StorageManagerDexie calls
  triggerDebouncedSync() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      if (this.isOnline) {
        try {
          // Debounced auto-push in progress
          await syncPush();
          // Debounced auto-push completed
        } catch (error) {
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
    } catch (error) {
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
      if (this.isVisible && this.isOnline) {
        try {
          // Periodic auto-pull in progress
          await syncPull();
          // Periodic auto-pull completed
        } catch (error) {
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
  }
}

// Export singleton instance
export const autoSyncManager = new AutoSyncManager();