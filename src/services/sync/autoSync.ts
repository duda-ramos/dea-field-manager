// src/services/sync/autoSync.ts - Versão corrigida compatível com código existente
import { syncPull, syncPush } from './sync';
import { getSyncPreferences } from '@/lib/preferences';
import { syncStateManager } from './syncState';
import { logger } from '@/services/logger';

class AutoSyncManager {
  private debounceTimer: NodeJS.Timeout | null = null;
  private periodicTimer: NodeJS.Timeout | null = null;
  private isOnline = navigator.onLine;
  private isVisible = !document.hidden;

  async initialize() {
    logger.info('🔄 Initializing auto-sync manager...');
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Setup periodic sync (no initial pull to avoid auth errors)
    this.setupPeriodicSync();
    
    logger.info('✅ Auto-sync manager initialized');
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
    
    // Visibility change (replaces deprecated unload)
    document.addEventListener('visibilitychange', () => {
      this.isVisible = !document.hidden;
      
      if (this.isVisible) {
        // Page became visible - resume periodic sync
        this.setupPeriodicSync();
      } else {
        // Page hidden - try to sync before going background
        this.handleBackgroundSync();
      }
    });

    // Modern replacement for beforeunload
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
        logger.debug('Background sync failed (non-critical):', error);
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
        logger.debug('Unload sync failed (expected):', error);
      }
    }
  }

  private handleOnlineStatusChange() {
    // Update sync state
    syncStateManager.updateState({ isOnline: this.isOnline });

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
          logger.info('📤 Debounced auto-push...');
          await syncPush();
          logger.info('✅ Debounced auto-push completed');
        } catch (error) {
          logger.error('Debounced push failed:', error);
        }
      }
    }, 3000);
  }

  private async handleBootPull() {
    try {
      syncStateManager.setSyncing('pull');
      
      logger.info('📥 Auto-pull on start...');
      await syncPull();
      
      syncStateManager.setIdle();
      
      logger.info('✅ Auto-pull completed');
    } catch (error) {
      logger.error('Auto-pull failed:', error);
      syncStateManager.setError('Erro na sincronização automática');
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
    logger.info(`⏰ Periodic pull scheduled every ${prefs.periodicPullInterval} minutes`);

    this.periodicTimer = setInterval(async () => {
      // Only run when page is visible and online
      if (this.isVisible && this.isOnline) {
        try {
          logger.info('📥 Periodic auto-pull...');
          await syncPull();
          logger.info('✅ Periodic auto-pull completed');
        } catch (error) {
          logger.error('Periodic pull failed:', error);
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