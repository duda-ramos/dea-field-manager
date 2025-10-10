import { db } from '@/db/indexedDb';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

export interface RealtimeMetrics {
  eventsReceived: number;
  eventsApplied: number;
  eventsIgnored: number;
  isActive: boolean;
  lastEventAt?: number;
}

export interface SyncMetrics {
  lastSyncAt?: number;
  lastSyncDuration?: number;
  lastSyncType?: 'full' | 'push' | 'pull';
  tablesProcessed?: {
    projects: number;
    installations: number;
    contacts: number;
    budgets: number;
    itemVersions: number;
    files: number;
  };
  cursor?: number; // lastPulledAt
  realtimeMetrics?: RealtimeMetrics;
}

export interface SyncError {
  message: string;
  stack?: string;
  timestamp: number;
  operation: string;
}

export interface SyncLogEntry {
  id: string;
  timestamp: number;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
  details?: any;
}

export interface SyncState {
  status: SyncStatus;
  isOnline: boolean;
  lastSyncAt?: number;
  pendingPush: number;
  pendingByTable: {
    projects: number;
    installations: number;
    contacts: number;
    budgets: number;
    itemVersions: number;
    files: number;
  };
  lastError?: SyncError;
  metrics: SyncMetrics;
  logs: SyncLogEntry[];
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
    pendingPush: 0,
    pendingByTable: {
      projects: 0,
      installations: 0,
      contacts: 0,
      budgets: 0,
      itemVersions: 0,
      files: 0
    },
    metrics: {},
    logs: []
  };

  constructor() {
    this.setupNetworkListeners();
    this.updatePendingCount();
    this.loadMetrics();
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
      const pendingByTable = { projects, installations, contacts, budgets, itemVersions, files };
      
      this.updateState({ 
        pendingPush: total,
        pendingByTable 
      });
    } catch (error) {
      console.error('Error counting pending changes:', error);
    }
  }

  private async loadMetrics() {
    try {
      const cursor = await import('./localFlags').then(m => m.getLastPulledAt());
      this.updateState({
        metrics: {
          ...this.currentState.metrics,
          cursor
        }
      });
    } catch (error) {
      console.error('Error loading metrics:', error);
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

  public setError(error: string | SyncError) {
    const syncError: SyncError = typeof error === 'string' ? {
      message: error,
      timestamp: Date.now(),
      operation: 'unknown'
    } : error;

    this.addLog('error', `Erro: ${syncError.message}`, syncError);
    this.updateState({
      status: 'error',
      lastError: syncError
    });
  }

  public setSyncing(type: 'full' | 'push' | 'pull' = 'full') {
    this.addLog('info', `Iniciando sync ${type}...`);
    this.updateState({
      status: 'syncing',
      lastError: undefined,
      metrics: {
        ...this.currentState.metrics,
        lastSyncType: type
      }
    });
  }

  public setIdle(syncMetrics?: any) {
    if (syncMetrics) {
      const duration = Date.now() - (this.currentState.metrics.lastSyncAt || Date.now());
      
      this.addLog('success', `Sync concluída em ${Math.round(duration)}ms`, syncMetrics);
      this.updateState({
        metrics: {
          ...this.currentState.metrics,
          lastSyncAt: Date.now(),
          lastSyncDuration: duration,
          tablesProcessed: syncMetrics.tablesProcessed
        }
      });
    }

    this.updateState({
      status: this.currentState.isOnline ? 'idle' : 'offline',
      lastSyncAt: Date.now(),
      lastError: undefined
    });
    
    this.refreshPendingCount();
    this.loadMetrics();
  }

  public addLog(type: SyncLogEntry['type'], message: string, details?: any) {
    const entry: SyncLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type,
      message,
      details
    };

    const updatedLogs = [entry, ...this.currentState.logs].slice(0, 20); // Keep only last 20
    this.updateState({ logs: updatedLogs });
  }

  public clearLogs() {
    this.updateState({ logs: [] });
  }

  public getSyncStats() {
    const totalPending = Object.values(this.currentState.pendingByTable).reduce((sum, count) => sum + count, 0);
    const errorCount = this.currentState.logs.filter(log => log.type === 'error').length;
    const lastSuccessfulSync = this.currentState.logs.find(log => log.type === 'success')?.timestamp;
    
    return {
      totalPending,
      errorCount,
      lastSuccessfulSync,
      isHealthy: totalPending === 0 && errorCount === 0 && this.currentState.isOnline
    };
  }

  public getRealtimeMetrics(): RealtimeMetrics | undefined {
    return this.currentState.metrics.realtimeMetrics;
  }

  public updateRealtimeMetrics(metrics: RealtimeMetrics): void {
    this.updateState({
      metrics: {
        ...this.currentState.metrics,
        realtimeMetrics: metrics
      }
    });
  }
}

export const syncStateManager = new SyncStateManager();