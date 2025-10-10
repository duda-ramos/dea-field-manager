import { getSyncPreferences } from '@/lib/preferences';
import { syncStateManager } from '@/services/sync/syncState';
import { logger } from '@/services/logger';
import type { RealtimeEvent, RealtimeMetrics, RealtimeChannel } from './types';

class RealtimeManager {
  private clientId: string;
  private channels: Map<string, RealtimeChannel> = new Map();
  private eventQueue: Map<string, RealtimeEvent[]> = new Map();
  private metrics: RealtimeMetrics = {
    eventsReceived: 0,
    eventsApplied: 0,
    eventsIgnored: 0,
    isActive: false
  };
  private recentLocalOps: Array<{ table: string; timestamp: number }> = [];

  constructor() {
    this.clientId = this.getOrCreateClientId();
  }

  private getOrCreateClientId(): string {
    const stored = localStorage.getItem('realtime_client_id');
    if (stored) return stored;
    
    const newId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('realtime_client_id', newId);
    return newId;
  }

  public async initialize(): Promise<void> {
    // Check feature flags
    const envEnabled = import.meta.env.VITE_REALTIME_ENABLED === 'true';
    const prefsEnabled = getSyncPreferences().realtimeEnabled ?? false;

    if (!envEnabled || !prefsEnabled) {
      logger.info('Realtime sync disabled by feature flags');
      return;
    }

    // If autoPullOnStart is enabled, wait for initial sync
    const prefs = getSyncPreferences();
    if (prefs.autoPullOnStart) {
      const state = syncStateManager.getState();
      if (!state.lastSyncAt) {
        logger.info('Realtime waiting for initial sync...');
        // Wait for initial sync to complete
        await new Promise<void>(resolve => {
          const unsubscribe = syncStateManager.subscribe((newState) => {
            if (newState.lastSyncAt) {
              unsubscribe();
              resolve();
            }
          });
        });
      }
    }

    this.metrics.isActive = true;
    logger.info(`Realtime initialized: ${this.clientId}`);
  }

  public subscribeTables(): void {
    // Will be implemented in PR #2
  }

  public async handleEvent(table: string, payload: any): Promise<void> {
    // Will be implemented in PR #2
  }

  private async applyBatch(table: string): Promise<void> {
    // Will be implemented in PR #2
  }

  public async reconnect(): Promise<void> {
    // Re-subscribe to all channels after reconnection
    logger.info('Realtime reconnecting...');
    this.subscribeTables();
  }

  public destroy(): void {
    // Cleanup all subscriptions
    this.channels.forEach(channel => {
      if (channel.subscription) {
        channel.subscription.unsubscribe();
      }
    });
    this.channels.clear();
    this.eventQueue.clear();
    this.metrics.isActive = false;
    logger.info('Realtime destroyed');
  }

  public getMetrics(): RealtimeMetrics {
    return { ...this.metrics };
  }

  public trackLocalOperation(table: string): void {
    // Track recent local operations for deduplication (keep last 5s)
    const timestamp = Date.now();
    this.recentLocalOps.push({ table, timestamp });
    
    // Cleanup old operations (older than 5s)
    this.recentLocalOps = this.recentLocalOps.filter(
      op => timestamp - op.timestamp < 5000
    );
  }
}

export const realtimeManager = new RealtimeManager();
