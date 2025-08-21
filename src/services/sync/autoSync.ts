import { syncPush, syncPull } from './sync';
import { syncStateManager } from './syncState';
import { getSyncPreferences } from '@/lib/preferences';

class AutoSyncManager {
  private periodicTimer: NodeJS.Timeout | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private pushOnUnloadTimer: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private isDocumentVisible = true;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    console.log('🔄 Initializing auto-sync manager...');
    this.isInitialized = true;

    // Setup event listeners
    this.setupUnloadHandlers();
    this.setupVisibilityHandlers();
    
    // Initial pull if enabled
    await this.handleInitialPull();
    
    // Setup periodic pull if enabled
    this.setupPeriodicPull();
    
    console.log('✅ Auto-sync manager initialized');
  }

  private async handleInitialPull(): Promise<void> {
    const preferences = getSyncPreferences();
    if (!preferences.autoPullOnStart) return;

    try {
      console.log('📥 Auto-pull on start...');
      syncStateManager.updateState({ 
        status: 'syncing', 
        progress: { current: 1, total: 1, operation: 'Atualizando dados...' }
      });

      await syncPull();
      
      console.log('✅ Auto-pull completed');
      // Brief success message
      setTimeout(() => {
        syncStateManager.updateState({
          progress: { current: 1, total: 1, operation: 'Dados atualizados' }
        });
        
        // Clear message after 2 seconds
        setTimeout(() => {
          syncStateManager.setIdle();
        }, 2000);
      }, 500);
      
    } catch (error) {
      console.error('❌ Auto-pull failed:', error);
      syncStateManager.setError('Falha ao atualizar dados iniciais');
      
      // Clear error after 5 seconds
      setTimeout(() => {
        syncStateManager.setIdle();
      }, 5000);
    }
  }

  private setupUnloadHandlers(): void {
    const handleUnload = () => {
      const preferences = getSyncPreferences();
      if (!preferences.autoPushOnExit) return;

      // Quick push attempt without blocking
      this.attemptQuickPush();
    };

    // Multiple event handlers for different scenarios
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        handleUnload();
      }
    });
  }

  private setupVisibilityHandlers(): void {
    document.addEventListener('visibilitychange', () => {
      this.isDocumentVisible = !document.hidden;
      
      if (this.isDocumentVisible) {
        // Page became visible, restart periodic sync if needed
        this.setupPeriodicPull();
      } else {
        // Page hidden, clear periodic timer
        this.clearPeriodicTimer();
      }
    });
  }

  private attemptQuickPush(): void {
    // Debounce to avoid multiple rapid calls
    if (this.pushOnUnloadTimer) {
      clearTimeout(this.pushOnUnloadTimer);
    }

    this.pushOnUnloadTimer = setTimeout(async () => {
      try {
        console.log('📤 Auto-push on unload...');
        
        // Quick push without waiting for completion
        syncPush().catch(error => {
          console.error('Auto-push failed (non-blocking):', error);
          // Failures are OK, data stays dirty for next sync
        });
        
      } catch (error) {
        console.error('Auto-push setup failed:', error);
      }
    }, 2500); // 2.5s debounce
  }

  private setupPeriodicPull(): void {
    this.clearPeriodicTimer();
    
    const preferences = getSyncPreferences();
    if (!preferences.periodicPullEnabled || !this.isDocumentVisible) return;

    const intervalMs = preferences.periodicPullInterval * 60 * 1000; // minutes to ms
    
    this.periodicTimer = setInterval(async () => {
      // Only sync if online and document is visible
      if (!navigator.onLine || !this.isDocumentVisible) return;
      
      const currentState = syncStateManager.getState();
      if (currentState.status === 'syncing') return; // Skip if already syncing

      try {
        console.log('📥 Periodic auto-pull...');
        await syncPull();
        console.log('✅ Periodic auto-pull completed');
      } catch (error) {
        console.error('❌ Periodic auto-pull failed:', error);
        // Don't show error for background sync
      }
    }, intervalMs);
    
    console.log(`⏰ Periodic pull scheduled every ${preferences.periodicPullInterval} minutes`);
  }

  private clearPeriodicTimer(): void {
    if (this.periodicTimer) {
      clearInterval(this.periodicTimer);
      this.periodicTimer = null;
    }
  }

  // Debounced trigger for operations that mark records as dirty
  triggerDebouncedSync(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      const preferences = getSyncPreferences();
      
      // Only auto-sync if enabled and online
      if (!navigator.onLine) return;
      
      const currentState = syncStateManager.getState();
      if (currentState.status === 'syncing') return; // Skip if already syncing
      if (currentState.pendingPush === 0) return; // No changes to sync

      try {
        console.log('📤 Debounced auto-push...');
        await syncPush();
        console.log('✅ Debounced auto-push completed');
      } catch (error) {
        console.error('❌ Debounced auto-push failed:', error);
        // Silently fail, data stays dirty
      }
    }, 3000); // 3s debounce
  }

  // Update periodic sync when preferences change
  updatePeriodicSync(): void {
    this.setupPeriodicPull();
  }

  destroy(): void {
    this.clearPeriodicTimer();
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    if (this.pushOnUnloadTimer) {
      clearTimeout(this.pushOnUnloadTimer);
    }
    this.isInitialized = false;
  }
}

export const autoSyncManager = new AutoSyncManager();