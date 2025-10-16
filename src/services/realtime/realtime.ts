import { getSyncPreferences } from '@/lib/preferences';
import { syncStateManager } from '@/services/sync/syncState';
import { logger } from '@/services/logger';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/db/indexedDb';
import type { RealtimeEvent, RealtimeMetrics } from './types';

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
  private signedUrlCache: Map<string, { url: string; expiresAt: number }> = new Map();

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
    this.updateMetricsInSyncState();
    
    // Subscribe to all tables
    await this.subscribeTables();
  }

  public async subscribeTables(): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      logger.warn('Realtime: No user session, skipping subscription');
      return;
    }

    const userId = session.user.id;

    // Subscribe to projects table
    const projectsChannel = supabase
      .channel('db-projects')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
          filter: `user_id=eq.${userId}`
        },
        (payload) => this.handleEvent('projects', payload)
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.info('Realtime: Subscribed to projects');
          this.channels.set('projects', {
            name: 'db-projects',
            subscription: projectsChannel,
            isSubscribed: true
          });
        } else if (status === 'CHANNEL_ERROR') {
          logger.error('Realtime: Failed to subscribe to projects');
          this.disableRealtimeOnError('projects');
        }
      });

    // Subscribe to installations table (RLS handles security)
    const installationsChannel = supabase
      .channel('db-installations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'installations'
        },
        (payload) => this.handleEvent('installations', payload)
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.info('Realtime: Subscribed to installations');
          this.channels.set('installations', {
            name: 'db-installations',
            subscription: installationsChannel,
            isSubscribed: true
          });
        } else if (status === 'CHANNEL_ERROR') {
          logger.error('Realtime: Failed to subscribe to installations');
          this.disableRealtimeOnError('installations');
        }
      });

    // Subscribe to contacts table (RLS handles security)
    const contactsChannel = supabase
      .channel('db-contacts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contacts'
        },
        (payload) => this.handleEvent('contacts', payload)
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.info('Realtime: Subscribed to contacts');
          this.channels.set('contacts', {
            name: 'db-contacts',
            subscription: contactsChannel,
            isSubscribed: true
          });
        } else if (status === 'CHANNEL_ERROR') {
          logger.error('Realtime: Failed to subscribe to contacts');
          this.disableRealtimeOnError('contacts');
        }
      });

    // Subscribe to budgets (supplier_proposals) table (RLS handles security)
    const budgetsChannel = supabase
      .channel('db-budgets')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'supplier_proposals'
        },
        (payload) => this.handleEvent('budgets', payload)
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.info('Realtime: Subscribed to budgets (supplier_proposals)');
          this.channels.set('budgets', {
            name: 'db-budgets',
            subscription: budgetsChannel,
            isSubscribed: true
          });
        } else if (status === 'CHANNEL_ERROR') {
          logger.error('Realtime: Failed to subscribe to budgets');
          this.disableRealtimeOnError('budgets');
        }
      });

    // Subscribe to item_versions table (RLS handles security)
    const itemVersionsChannel = supabase
      .channel('db-item-versions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'item_versions'
        },
        (payload) => this.handleEvent('item_versions', payload)
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.info('Realtime: Subscribed to item_versions');
          this.channels.set('item_versions', {
            name: 'db-item-versions',
            subscription: itemVersionsChannel,
            isSubscribed: true
          });
        } else if (status === 'CHANNEL_ERROR') {
          logger.error('Realtime: Failed to subscribe to item_versions');
          this.disableRealtimeOnError('item_versions');
        }
      });

    // Subscribe to files table (metadata only, RLS handles security)
    const filesChannel = supabase
      .channel('db-files')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'files'
        },
        (payload) => this.handleEvent('files', payload)
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.info('Realtime: Subscribed to files');
          this.channels.set('files', {
            name: 'db-files',
            subscription: filesChannel,
            isSubscribed: true
          });
        } else if (status === 'CHANNEL_ERROR') {
          logger.error('Realtime: Failed to subscribe to files');
          this.disableRealtimeOnError('files');
        }
      });
  }

  public async handleEvent(table: string, payload: any): Promise<void> {
    this.metrics.eventsReceived++;
    this.metrics.lastEventAt = Date.now();
    this.updateMetricsInSyncState();

    // Deduplication: Check if this event is from a recent local operation
    const recentOp = this.recentLocalOps.find(
      op => op.table === table && Date.now() - op.timestamp < 5000
    );

    if (recentOp) {
      // Check if timestamps match (within 2 seconds tolerance)
      const eventTimestamp = payload.new?.updated_at 
        ? new Date(payload.new.updated_at).getTime()
        : Date.now();
      
      if (Math.abs(eventTimestamp - recentOp.timestamp) < 2000) {
        logger.debug(`Realtime: Ignoring own event for ${table}`);
        this.metrics.eventsIgnored++;
        this.updateMetricsInSyncState();
        return;
      }
    }

    // Create event object
    const event: RealtimeEvent = {
      id: payload.new?.id || payload.old?.id,
      table,
      eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
      payload: payload.new || payload.old,
      timestamp: Date.now(),
      clientId: this.clientId
    };

    // Add to queue
    if (!this.eventQueue.has(table)) {
      this.eventQueue.set(table, []);
    }
    this.eventQueue.get(table)!.push(event);

    // Debounce batch application (300ms)
    this.debouncedApplyBatch(table);
  }

  private debounceBatchTimers: Map<string, NodeJS.Timeout> = new Map();

  private debouncedApplyBatch(table: string): void {
    // Clear existing timer
    const existingTimer = this.debounceBatchTimers.get(table);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.applyBatch(table);
      this.debounceBatchTimers.delete(table);
    }, 300);

    this.debounceBatchTimers.set(table, timer);
  }

  private async applyBatch(table: string): Promise<void> {
    const events = this.eventQueue.get(table) || [];
    if (events.length === 0) return;

    // Clear queue
    this.eventQueue.set(table, []);

    // Group events by ID, keeping only the latest event for each record
    const latestEvents = new Map<string, RealtimeEvent>();
    for (const event of events) {
      const existing = latestEvents.get(event.id);
      if (!existing || event.timestamp > existing.timestamp) {
        latestEvents.set(event.id, event);
      }
    }

    logger.debug(`Realtime: Applying ${latestEvents.size} events for ${table}`);

    // Batch optimization: If >100 events, process in chunks to avoid blocking UI
    const eventArray = Array.from(latestEvents.values());
    if (eventArray.length > 100) {
      logger.info(`Realtime: Processing ${eventArray.length} events in chunks for ${table}`);
      const chunkSize = 50;
      for (let i = 0; i < eventArray.length; i += chunkSize) {
        const chunk = eventArray.slice(i, i + chunkSize);
        
        // Process chunk
        for (const event of chunk) {
          try {
            await this.applyEvent(event);
            this.metrics.eventsApplied++;
            this.updateMetricsInSyncState();
          } catch (error) {
            logger.error(`Realtime: Failed to apply event for ${table}`, error);
            this.metrics.eventsIgnored++;
            this.updateMetricsInSyncState();
          }
        }
        
        // Add delay between chunks to keep UI responsive (100ms)
        if (i + chunkSize < eventArray.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } else {
      // Apply each event normally
      for (const event of latestEvents.values()) {
        try {
          await this.applyEvent(event);
          this.metrics.eventsApplied++;
          this.updateMetricsInSyncState();
        } catch (error) {
          logger.error(`Realtime: Failed to apply event for ${table}`, error);
          this.metrics.eventsIgnored++;
          this.updateMetricsInSyncState();
        }
      }
    }

    // Update sync state
    syncStateManager.updateState({
      lastSyncAt: Date.now()
    });

    logger.info(`Applied ${latestEvents.size} realtime events for ${table}`);
  }

  private async applyEvent(event: RealtimeEvent): Promise<void> {
    const localTable = this.getLocalTable(event.table);
    if (!localTable) {
      logger.warn(`Realtime: Unknown table ${event.table}`);
      return;
    }

    if (event.eventType === 'DELETE') {
      // Delete from IndexedDB
      await localTable.delete(event.id);
      return;
    }

    // For INSERT/UPDATE: Apply Last-Write-Wins (LWW) conflict resolution
    const existingRecord = await localTable.get(event.id);
    const eventTimestamp = event.payload.updated_at 
      ? new Date(event.payload.updated_at).getTime()
      : event.timestamp;

    if (existingRecord) {
      const existingTimestamp = existingRecord.updatedAt || existingRecord.updated_at || 0;
      
      // Only apply if the event is newer
      if (eventTimestamp <= existingTimestamp) {
        logger.debug(`Realtime: Event ignored (older): ${event.table}/${event.id}`);
        return;
      }
    }

    // Transform and apply the record
    const localRecord = this.transformRecordForLocal(event.payload, event.table);
    await localTable.put(localRecord);
  }

  private getLocalTable(tableName: string): any {
    switch (tableName) {
      case 'projects':
        return db.projects;
      case 'installations':
        return db.installations;
      case 'contacts':
        return db.contacts;
      case 'budgets':
        return db.budgets;
      case 'item_versions':
      case 'itemVersions':
        return db.itemVersions;
      case 'files':
        return db.files;
      default:
        return null;
    }
  }

  private transformRecordForLocal(record: any, tableName: string): any {
    // Transform from Supabase format to IndexedDB format
    const base = {
      ...record,
      updatedAt: record.updated_at ? new Date(record.updated_at).getTime() : Date.now(),
      createdAt: record.created_at ? new Date(record.created_at).getTime() : Date.now(),
      _dirty: 0,
      _deleted: 0
    };

    delete base.user_id;

    switch (tableName) {
      case 'projects':
        return {
          ...base,
          owner: record.owner_name,
          installation_time_estimate_days: record.installation_time_estimate_days
        };
      case 'contacts':
        return {
          id: record.id,
          projetoId: record.project_id,
          nome: record.name,
          tipo: record.role,
          telefone: record.phone,
          email: record.email,
          atualizadoEm: record.updated_at,
          _dirty: 0,
          _deleted: 0
        };
      case 'budgets':
        return {
          ...base,
          projectId: record.project_id,
          fileName: record.file_name,
          filePath: record.file_path,
          fileSize: record.file_size,
          uploadedAt: record.uploaded_at,
          status: record.status ?? 'pending'
        };
      case 'item_versions':
        return {
          id: record.id,
          itemId: record.installation_id,
          snapshot: record.snapshot,
          revisao: record.revisao,
          motivo: record.motivo,
          descricao_motivo: record.descricao_motivo,
          criadoEm: record.created_at,
          updatedAt: new Date(record.updated_at).getTime(),
          createdAt: new Date(record.created_at).getTime(),
          _dirty: 0,
          _deleted: 0
        };
      case 'files':
        return {
          ...base,
          projectId: record.project_id,
          installationId: record.installation_id
        };
      default:
        return base;
    }
  }

  public async reconnect(): Promise<void> {
    // Re-subscribe to all channels after reconnection
    logger.info('Realtime reconnecting...');
    
    // Cleanup existing subscriptions
    this.channels.forEach(channel => {
      if (channel.subscription) {
        channel.subscription.unsubscribe();
      }
    });
    this.channels.clear();
    
    // Re-subscribe
    await this.subscribeTables();
  }

  public destroy(): void {
    // Clear all debounce timers
    this.debounceBatchTimers.forEach(timer => clearTimeout(timer));
    this.debounceBatchTimers.clear();
    
    // Cleanup all subscriptions
    this.channels.forEach(channel => {
      if (channel.subscription) {
        channel.subscription.unsubscribe();
      }
    });
    this.channels.clear();
    this.eventQueue.clear();
    this.metrics.isActive = false;
    this.updateMetricsInSyncState();
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

  /**
   * Generate and cache signed URL for file preview/download
   * Cache expires after 1 hour or when file metadata changes
   */
  public async getSignedUrl(filePath: string, updatedAt: number): Promise<string> {
    const cacheKey = `${filePath}-${updatedAt}`;
    const cached = this.signedUrlCache.get(cacheKey);
    
    // Return cached URL if still valid (expires in 1 hour)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.url;
    }
    
    // Generate new signed URL
    const { data, error } = await supabase.storage
      .from('attachments')
      .createSignedUrl(filePath, 3600); // 1 hour
    
    if (error) {
      logger.error('Realtime: Failed to generate signed URL', error);
      throw error;
    }
    
    // Cache the URL
    this.signedUrlCache.set(cacheKey, {
      url: data.signedUrl,
      expiresAt: Date.now() + 3600 * 1000 // 1 hour
    });
    
    // Clean up expired cache entries
    this.cleanupSignedUrlCache();
    
    return data.signedUrl;
  }

  private cleanupSignedUrlCache(): void {
    const now = Date.now();
    for (const [key, value] of this.signedUrlCache.entries()) {
      if (value.expiresAt <= now) {
        this.signedUrlCache.delete(key);
      }
    }
  }

  /**
   * Invalidate signed URL cache when file metadata changes
   */
  public invalidateSignedUrlCache(filePath: string): void {
    for (const key of this.signedUrlCache.keys()) {
      if (key.startsWith(filePath)) {
        this.signedUrlCache.delete(key);
      }
    }
  }

  private disableRealtimeOnError(table: string): void {
    logger.error(`Subscription error for ${table} - disabling realtime automatically`);
    this.metrics.isActive = false;
    this.updateMetricsInSyncState();
    this.destroy();
  }

  private updateMetricsInSyncState(): void {
    syncStateManager.updateRealtimeMetrics(this.metrics);
  }
}

export const realtimeManager = new RealtimeManager();
