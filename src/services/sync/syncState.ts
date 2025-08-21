import { db } from '@/db/indexedDb';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

export interface SyncState {
  status: SyncStatus;
  isOnline: boolean;
  lastSyncAt?: number;
  pendingPush: number;
  lastError?: string;
  progress?: {
    current: number;
    total: number;
    operation: string;
  };
}

class SyncStateManager {
  private listeners: ((state: SyncState) => void)[] = [];
  private currentState: SyncState = {
    status: 'idle',
    isOnline: navigator.onLine,
    pendingPush: 0
  };

  constructor() {
    this.setupNetworkListeners();
    this.updatePendingCount();
  }

  private setupNetworkListeners() {
    const updateOnlineStatus = () => {
      this.updateState({
        isOnline: navigator.onLine,
        status: navigator.onLine ? 'idle' : 'offline'
      });
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
  }

  private async updatePendingCount() {
    try {
      const [projects, installations, contacts, budgets, itemVersions, files] = await Promise.all([
        db.projects.where('_dirty').equals(1).count(),
        db.installations.where('_dirty').equals(1).count(),
        db.contacts.where('_dirty').equals(1).count(),
        db.budgets.where('_dirty').equals(1).count(),
        db.itemVersions.where('_dirty').equals(1).count(),
        db.files.where('_dirty').equals(1).count()
      ]);

      const total = projects + installations + contacts + budgets + itemVersions + files;
      this.updateState({ pendingPush: total });
    } catch (error) {
      console.error('Error counting pending changes:', error);
    }
  }

  public subscribe(listener: (state: SyncState) => void): () => void {
    this.listeners.push(listener);
    listener(this.currentState); // Send current state immediately
    
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  public updateState(updates: Partial<SyncState>) {
    this.currentState = { ...this.currentState, ...updates };
    this.listeners.forEach(listener => listener(this.currentState));
  }

  public getState(): SyncState {
    return this.currentState;
  }

  public async refreshPendingCount() {
    await this.updatePendingCount();
  }

  public setProgress(current: number, total: number, operation: string) {
    this.updateState({
      progress: { current, total, operation }
    });
  }

  public clearProgress() {
    this.updateState({
      progress: undefined
    });
  }

  public setError(error: string) {
    this.updateState({
      status: 'error',
      lastError: error
    });
  }

  public setSyncing() {
    this.updateState({
      status: 'syncing',
      lastError: undefined
    });
  }

  public setIdle() {
    this.updateState({
      status: this.currentState.isOnline ? 'idle' : 'offline',
      lastSyncAt: Date.now(),
      lastError: undefined
    });
    this.refreshPendingCount();
  }
}

export const syncStateManager = new SyncStateManager();