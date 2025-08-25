import { syncPull, syncPush } from './sync';
import { getSyncPreferences } from '@/lib/preferences';
import { setSyncState } from './syncState';

class AutoSyncManager {
  private debounceTimer: NodeJS.Timeout | null = null;
  private periodicTimer: NodeJS.Timeout | null = null;
  private isOnline = navigator.onLine;
  private isVisible = !document.hidden;

  async initialize() {
    console.log('🔄 Initializing auto-sync manager...');
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Initial pull if enabled
    const prefs = getSyncPreferences();
    if (prefs.pullOnBoot) {
      await this.handleBootPull();
    }
    
    // Setup periodic sync
    this.setupPeriodicSync();
    
    console.log('✅ Auto-sync manager initialized');
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
    if (prefs.pushOnUnload && this.isOnline) {
      try {
        // Non-blocking background sync
        void syncPush();
      } catch (error) {
        console.log('Background sync failed (non-critical):', error);
      }
    }
  }

  private async handlePageUnload() {
    const prefs = getSyncPreferences();
    if (prefs.pushOnUnload && this.isOnline) {
      try {
        // Use sendBeacon API for reliable unload sync
        const syncData = await this.prepareSyncData();
        if (syncData && navigator.sendBeacon) {
          navigator.sendBeacon('/api/sync', JSON.stringify(syncData));
        }
      } catch (error) {
        console.log('Unload sync failed (expected):', error);
      }
    }
  }

  private async prepareSyncData() {
    // Prepare minimal sync data for sendBeacon
    // This is a simplified version for unload scenarios
    return null; // Implement based on your sync needs
  }

  private handleOnlineStatusChange() {
    setSyncState(prev => ({
      ...prev,
      isOnline: this.isOnline
    }));

    if (this.isOnline) {
      // Back online - trigger debounced push if needed
      this.debouncedPush();
    }
  }

  debouncedPush() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      if (this.isOnline) {
        try {
          console.log('📤 Debounced auto-push...');
          await syncPush();
          console.log('✅ Debounced auto-push completed');
        } catch (error) {
          console.error('Debounced push failed:', error);
        }
      }
    }, 3000);
  }

  private async handleBootPull() {
    try {
      setSyncState(prev => ({ 
        ...prev, 
        status: 'Atualizando dados...' 
      }));
      
      console.log('📥 Auto-pull on start...');
      await syncPull();
      
      setSyncState(prev => ({ 
        ...prev, 
        status: 'Dados atualizados' 
      }));
      
      // Clear status after 2s
      setTimeout(() => {
        setSyncState(prev => ({ 
          ...prev, 
          status: 'Pronto' 
        }));
      }, 2000);
      
      console.log('✅ Auto-pull completed');
    } catch (error) {
      console.error('Auto-pull failed:', error);
      setSyncState(prev => ({ 
        ...prev, 
        status: 'Erro na sincronização' 
      }));
    }
  }

  private setupPeriodicSync() {
    if (this.periodicTimer) {
      clearInterval(this.periodicTimer);
      this.periodicTimer = null;
    }

    const prefs = getSyncPreferences();
    if (!prefs.periodicSync || !prefs.periodicInterval) {
      return;
    }

    const intervalMs = prefs.periodicInterval * 60 * 1000;
    console.log(`⏰ Periodic pull scheduled every ${prefs.periodicInterval} minutes`);

    this.periodicTimer = setInterval(async () => {
      // Only run when page is visible and online
      if (this.isVisible && this.isOnline) {
        try {
          console.log('📥 Periodic auto-pull...');
          await syncPull();
          console.log('✅ Periodic auto-pull completed');
        } catch (error) {
          console.error('Periodic pull failed:', error);
        }
      }
    }, intervalMs);
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