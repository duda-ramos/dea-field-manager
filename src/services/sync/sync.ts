import { supabase } from '@/integrations/supabase/client';
import { db } from '@/db/indexedDb';
import { getLastPulledAt, setLastPulledAt, setSyncStatus } from './localFlags';
import { withRetry, createBatches, createEmptyMetrics, type LegacySyncMetrics } from './utils';
import { syncStateManager } from './syncState';
import { fileSyncService } from './fileSync';
import { rateLimiter } from './rateLimiter';
import { logger } from '@/services/logger';
import { getFeatureFlag } from '@/config/featureFlags';
import type { Project, Installation, ProjectContact, ProjectBudget, ItemVersion, ProjectFile } from '@/types';

const BATCH_SIZE = getFeatureFlag('SYNC_BATCH_SIZE') as number;
const PULL_PAGE_SIZE = 1000;

// Timestamp normalization helpers
const normalizeTimestamps = (obj: any) => ({
  ...obj,
  created_at: obj.createdAt || obj.created_at,
  updated_at: obj.updatedAt || obj.updated_at
});

const denormalizeTimestamps = (obj: any) => ({
  ...obj,
  createdAt: obj.created_at,
  updatedAt: obj.updated_at ? new Date(obj.updated_at).getTime() : Date.now()
});

// Generic push/pull operations
async function pushEntityType(entityName: string, tableName: string): Promise<{ pushed: number; deleted: number; errors: string[] }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const tableMap: Record<string, string> = {
    'projects': 'projects',
    'installations': 'installations', 
    'contacts': 'contacts',
    'budgets': 'budgets',
    'item_versions': 'itemVersions',
    'files': 'files'
  };

  const localTableName = tableMap[entityName] || entityName;
  const dirtyRecords = await (db as any)[localTableName].where('_dirty').equals(1).toArray();
  if (dirtyRecords.length === 0) return { pushed: 0, deleted: 0, errors: [] };

  logger.debug(`📤 Pushing ${dirtyRecords.length} ${entityName}...`);
  const batches = createBatches(dirtyRecords, BATCH_SIZE);
  
  let pushed = 0;
  let deleted = 0;
  const errors: string[] = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    
    await withRetry(async () => {
      const operations = batch.map(async (record: any) => {
        try {
          if (record._deleted) {
            await supabase.from(tableName as any).delete().eq('id', record.id);
            deleted++;
            await (db as any)[localTableName].delete(record.id);
          } else {
            // Transform record for Supabase
            const normalizedRecord = transformRecordForSupabase(record, entityName, user.id);
            await supabase.from(tableName as any).upsert(normalizedRecord);
            pushed++;
            await (db as any)[localTableName].update(record.id, { _dirty: 0 });
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`${entityName}_${record.id}: ${errorMsg}`);
          throw error;
        }
      });

      await Promise.all(operations);
    });
  }

  return { pushed, deleted, errors };
}

async function pullEntityType(entityName: string, tableName: string, lastPulledAt: number): Promise<{ pulled: number; errors: string[] }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  let hasMore = true;
  let page = 0;
  let pulled = 0;
  const errors: string[] = [];
  const lastPulledDate = new Date(lastPulledAt).toISOString();

  const tableMap: Record<string, string> = {
    'projects': 'projects',
    'installations': 'installations',
    'contacts': 'contacts', 
    'budgets': 'budgets',
    'item_versions': 'itemVersions',
    'files': 'files'
  };

  const localTableName = tableMap[entityName] || entityName;

  while (hasMore) {
    try {
      const { data: records, error } = await withRetry(async () => {
        return await supabase
          .from(tableName as any)
          .select('*')
          .eq('user_id', user.id)
          .gt('updated_at', lastPulledDate)
          .order('updated_at', { ascending: true })
          .order('id', { ascending: true })
          .range(page * PULL_PAGE_SIZE, (page + 1) * PULL_PAGE_SIZE - 1);
      });

      if (error) throw error;

      if (records && records.length > 0) {
        logger.debug(`📥 Pulling ${records.length} ${entityName} (page ${page + 1})...`);
        
        for (const record of records) {
          try {
            const localRecord = transformRecordForLocal(record, entityName);
            await (db as any)[localTableName].put(localRecord);
            pulled++;
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            errors.push(`${entityName}_${(record as any).id || 'unknown'}: ${errorMsg}`);
          }
        }

        hasMore = records.length === PULL_PAGE_SIZE;
        page++;
      } else {
        hasMore = false;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(`${entityName}_page_${page}: ${errorMsg}`);
      hasMore = false;
    }
  }

  return { pulled, errors };
}

function transformRecordForSupabase(record: any, entityName: string, userId: string): any {
  const base = normalizeTimestamps({
    ...record,
    user_id: userId
  });
  
  // Remove local-only fields
  delete base._dirty;
  delete base._deleted;
  delete base.updatedAt;
  delete base.createdAt;

  switch (entityName) {
    case 'projects':
      return {
        ...base,
        owner_name: record.owner,
        suppliers: record.suppliers || []
      };
    case 'contacts':
      return {
        id: record.id,
        project_id: record.projetoId,
        name: record.nome,
        role: record.tipo,
        phone: record.telefone,
        email: record.email,
        user_id: userId,
        created_at: base.created_at,
        updated_at: base.updated_at
      };
    case 'budgets':
      return {
        ...base,
        project_id: record.projectId
      };
    case 'item_versions':
      return {
        id: record.id,
        installation_id: record.itemId,
        snapshot: record.snapshot,
        revisao: record.revisao,
        motivo: record.motivo,
        descricao_motivo: record.descricao_motivo,
        user_id: userId,
        created_at: base.created_at,
        updated_at: base.updated_at
      };
    case 'files':
      return {
        ...base,
        project_id: record.projectId,
        installation_id: record.installationId
      };
    default:
      return base;
  }
}

function transformRecordForLocal(record: any, entityName: string): any {
  const base = denormalizeTimestamps({
    ...record,
    _dirty: 0,
    _deleted: 0
  });
  
  delete base.user_id;

  switch (entityName) {
    case 'projects':
      return {
        ...base,
        owner: record.owner_name
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
        projectId: record.project_id
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

export async function syncPush(): Promise<LegacySyncMetrics> {
  const startTime = logger.syncStart('push');
  const metrics = createEmptyMetrics();

  syncStateManager.setSyncing('push');
  syncStateManager.setProgress(0, 100, 'Uploading local changes...');

  try {
    // Rate limiting check
    await rateLimiter.waitForLimit('sync_push');

    // First upload pending files to storage
    const fileUploadResult = await fileSyncService.uploadPendingFiles();
    if (fileUploadResult.uploaded > 0) {
      logger.debug(`📁 Uploaded ${fileUploadResult.uploaded} pending files to storage`);
    }
    if (fileUploadResult.errors.length > 0) {
      logger.warn('⚠️ File upload errors', fileUploadResult.errors);
    }

    // Push all entity types
    const entityTypes = [
      { name: 'projects', table: 'projects' },
      { name: 'installations', table: 'installations' },
      { name: 'contacts', table: 'contacts' },
      { name: 'budgets', table: 'budgets' },
      { name: 'item_versions', table: 'item_versions' },
      { name: 'files', table: 'files' }
    ];

    for (let i = 0; i < entityTypes.length; i++) {
      const entity = entityTypes[i];
      const progress = ((i + 1) / entityTypes.length) * 100;
      
      syncStateManager.setProgress(progress, 100, `Uploading ${entity.name}...`);
      
      let result;
      if (entity.name === 'files') {
        // Use specialized file sync service
        result = await fileSyncService.pushFiles();
      } else {
        result = await pushEntityType(entity.name, entity.table);
      }
      
      metrics.push[entity.name as keyof typeof metrics.push] = result;
    }

    syncStateManager.setProgress(100, 100, 'Upload complete');
    metrics.success = true;
    metrics.duration = Date.now() - startTime;
    
    syncStateManager.setIdle(metrics);
    return metrics;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.syncError('push', error instanceof Error ? error : new Error(errorMessage));
    syncStateManager.setError(`Push failed: ${errorMessage}`);
    
    metrics.success = false;
    metrics.error = errorMessage;
    metrics.duration = Date.now() - startTime;
    
    throw error;
  }
}

export async function syncPull(): Promise<LegacySyncMetrics> {
  const startTime = logger.syncStart('pull');
  const metrics = createEmptyMetrics();
  const lastPulledAt = await getLastPulledAt();

  syncStateManager.setSyncing('pull');
  syncStateManager.setProgress(0, 100, 'Downloading remote changes...');

  try {
    // Rate limiting check
    await rateLimiter.waitForLimit('sync_pull');

    // Pull all entity types
    const entityTypes = [
      { name: 'projects', table: 'projects' },
      { name: 'installations', table: 'installations' },
      { name: 'contacts', table: 'contacts' },
      { name: 'budgets', table: 'budgets' },
      { name: 'item_versions', table: 'item_versions' },
      { name: 'files', table: 'files' }
    ];

    for (let i = 0; i < entityTypes.length; i++) {
      const entity = entityTypes[i];
      const progress = ((i + 1) / entityTypes.length) * 100;
      
      syncStateManager.setProgress(progress, 100, `Downloading ${entity.name}...`);
      
      let result;
      if (entity.name === 'files') {
        // Use specialized file sync service
        result = await fileSyncService.pullFiles(lastPulledAt);
      } else {
        result = await pullEntityType(entity.name, entity.table, lastPulledAt);
      }
      
      metrics.pull[entity.name as keyof typeof metrics.pull] = result;
    }

    // Update last pulled timestamp
    await setLastPulledAt(Date.now());
    
    syncStateManager.setProgress(100, 100, 'Download complete');
    metrics.success = true;
    metrics.duration = Date.now() - startTime;
    
    syncStateManager.setIdle(metrics);
    return metrics;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.syncError('pull', error instanceof Error ? error : new Error(errorMessage));
    syncStateManager.setError(`Pull failed: ${errorMessage}`);
    
    metrics.success = false;
    metrics.error = errorMessage;
    metrics.duration = Date.now() - startTime;
    
    throw error;
  }
}

export async function fullSync(): Promise<LegacySyncMetrics> {
  const startTime = logger.syncStart('full');
  const metrics = createEmptyMetrics();
  
  try {
    const pushResult = await syncPush();
    const pullResult = await syncPull();
    
    metrics.push = pushResult.push;
    metrics.pull = pullResult.pull;
    metrics.success = true;
    metrics.duration = Date.now() - startTime;
    
    syncStateManager.setIdle(metrics);
    return metrics;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.syncError('full', error instanceof Error ? error : new Error(errorMessage));
    syncStateManager.setError(`Full sync failed: ${errorMessage}`);
    
    metrics.success = false;
    metrics.error = errorMessage;
    metrics.duration = Date.now() - startTime;
    
    throw error;
  }
}