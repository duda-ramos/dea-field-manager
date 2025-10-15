import { supabase } from '@/integrations/supabase/client';
import { db } from '@/db/indexedDb';
import { getLastPulledAt, setLastPulledAt } from './localFlags';
import { withRetry, createBatches, createEmptyMetrics, type LegacySyncMetrics } from './utils';
import { syncStateManager } from './syncState';
import { fileSyncService } from './fileSync';
import { rateLimiter } from './rateLimiter';
import { logger } from '@/services/logger';
import { getFeatureFlag } from '@/config/featureFlags';
import { uploadToStorage } from '@/services/storage/filesStorage';
import { checkForRemoteEdits, getRecordDisplayName } from '@/lib/conflictUtils';
import { conflictStore } from '@/stores/conflictStore';
import type { ProjectBudget, ProjectFile } from '@/types';

type EntityName = 'projects' | 'installations' | 'contacts' | 'budgets' | 'item_versions' | 'files';
type LocalTableName = 'projects' | 'installations' | 'contacts' | 'budgets' | 'itemVersions' | 'files';
type RecordType = 'project' | 'installation' | 'contact' | 'budget';

const ENTITY_CONFIG: Record<EntityName, { local: LocalTableName; remote: string }> = {
  projects: { local: 'projects', remote: 'projects' },
  installations: { local: 'installations', remote: 'installations' },
  contacts: { local: 'contacts', remote: 'contacts' },
  budgets: { local: 'budgets', remote: 'supplier_proposals' },
  item_versions: { local: 'itemVersions', remote: 'item_versions' },
  files: { local: 'files', remote: 'files' }
};

const ENTITY_ORDER: EntityName[] = [
  'projects',
  'installations',
  'contacts',
  'budgets',
  'item_versions',
  'files'
];

const ENTITY_TO_RECORD_TYPE: Record<EntityName, RecordType | null> = {
  projects: 'project',
  installations: 'installation',
  contacts: 'contact',
  budgets: 'budget',
  item_versions: null,
  files: null
};

const getLocalTable = (table: LocalTableName) => (db as any)[table];

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

// Check if record should be force uploaded
function shouldForceUpload(record: any): boolean {
  return record._forceUpload === 1;
}

// Generic push operation with force upload support
async function pushEntityType(entityName: EntityName): Promise<{ pushed: number; deleted: number; errors: string[] }> {
  const { local, remote } = ENTITY_CONFIG[entityName];
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('User not authenticated');
  const user = session.user;

  const localTable = getLocalTable(local);
  const dirtyRecords = await localTable.where('_dirty').equals(1).toArray();
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
            await supabase.from(remote as any).delete().eq('id', record.id);
            deleted++;
            await localTable.delete(record.id);
          } else {
            // Transform record for Supabase
            const normalizedRecord = transformRecordForSupabase(record, entityName, user.id);
            
            // If force upload flag is set, ensure updated_at is current
            if (shouldForceUpload(record)) {
              normalizedRecord.updated_at = new Date().toISOString();
              logger.debug(`[Force Upload] ${entityName} ${record.id}`);
            }
            
            await supabase.from(remote as any).upsert(normalizedRecord);
            pushed++;
            
            // Clear both _dirty and _forceUpload flags after successful push
            await localTable.update(record.id, { 
              _dirty: 0, 
              _forceUpload: 0 
            });
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

// Pull entity with conflict detection
async function pullEntityType(entityName: EntityName, lastPulledAt: number): Promise<{ pulled: number; conflicts?: number; errors: string[] }> {
  const { local, remote } = ENTITY_CONFIG[entityName];
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('User not authenticated');
  const user = session.user;

  let hasMore = true;
  let page = 0;
  let pulled = 0;
  let conflicts = 0;
  const errors: string[] = [];
  const lastPulledDate = new Date(lastPulledAt).toISOString();

  const localTable = getLocalTable(local);
  const recordType = ENTITY_TO_RECORD_TYPE[entityName];

  while (hasMore) {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from(remote as any)
          .select('*')
          .eq('user_id', user.id)
          .gt('updated_at', lastPulledDate)
          .order('updated_at', { ascending: true })
          .order('id', { ascending: true })
          .range(page * PULL_PAGE_SIZE, (page + 1) * PULL_PAGE_SIZE - 1);
      });

      if (error) {
        if ((error as any)?.code === 'PGRST301' || (error as any)?.status === 404) {
          throw new Error(`Tabela remota "${remote}" não encontrada. Verifique se as migrações Supabase foram aplicadas.`);
        }
        throw error;
      }

      // Type guard: ensure data is an array
      const records = Array.isArray(data) ? data : [];

      if (records.length > 0) {
        logger.debug(`📥 Pulling ${records.length} ${entityName} (page ${page + 1})...`);

        for (const rawRecord of records) {
          // Type assertion: after filtering, we know these are valid records with properties
          const remoteRecord = rawRecord as any;
          
          try {
            // Ensure remoteRecord has an id property
            if (!remoteRecord || !remoteRecord.id) {
              logger.warn('Skipping record without id');
              continue;
            }

            // Get local version
            const localRecord = await localTable.get(remoteRecord.id);
            
            // Check for conflicts only for entities that support it
            if (localRecord && localRecord._dirty === 1 && recordType) {
              const conflictInfo = checkForRemoteEdits(
                localRecord,
                remoteRecord,
                remoteRecord.id,
                recordType
              );

              if (conflictInfo.hasConflict) {
                // Store conflict for later resolution
                conflicts++;
                const recordName = getRecordDisplayName(recordType, localRecord);
                
                conflictStore.getState().addConflict({
                  recordType,
                  recordName,
                  localVersion: localRecord,
                  remoteVersion: transformRecordForLocal(remoteRecord, entityName)
                });

                logger.warn(`[Conflict] Detected for ${recordType} ${remoteRecord.id}`);
                continue; // Skip automatic update
              }
            }

            // No conflict or no local changes - apply remote version
            const transformedRecord = transformRecordForLocal(remoteRecord, entityName);
            await localTable.put(transformedRecord);
            pulled++;
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            errors.push(`${entityName}_${remoteRecord.id || 'unknown'}: ${errorMsg}`);
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

  // Show conflict notification if any were detected
  if (conflicts > 0) {
    conflictStore.getState().showConflictNotification();
  }

  return { pulled, conflicts, errors };
}

function transformRecordForSupabase(record: any, entityName: string, userId: string): any {
  const base = normalizeTimestamps({
    ...record,
    user_id: userId
  });
  
  // Remove local-only fields
  delete base._dirty;
  delete base._deleted;
  delete base._forceUpload;
  delete base.updatedAt;
  delete base.createdAt;

  switch (entityName) {
    case 'projects':
      return {
        ...base,
        owner_name: record.owner,
        suppliers: record.suppliers || [],
        installation_time_estimate_days: record.installation_time_estimate_days
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
    case 'budgets': {
      const projectId = record.projectId || record.project_id;
      const createdAtISO =
        record.created_at ||
        (record.createdAt ? new Date(record.createdAt).toISOString() : new Date().toISOString());
      const updatedAtISO =
        record.updated_at ||
        (record.updatedAt ? new Date(record.updatedAt).toISOString() : new Date().toISOString());

      return {
        id: record.id,
        project_id: projectId,
        supplier: record.supplier,
        status: record.status ?? 'pending',
        file_name: record.fileName ?? record.file_name ?? null,
        file_path: record.filePath ?? record.file_path ?? null,
        file_size: record.fileSize ?? record.file_size ?? null,
        uploaded_at: record.uploadedAt ?? record.uploaded_at ?? null,
        user_id: userId,
        created_at: createdAtISO,
        updated_at: updatedAtISO
      };
    }
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
    case 'budgets': {
      const fileName = record.file_name ?? (record as any).fileName;
      const filePath = record.file_path ?? (record as any).filePath;
      const fileSize = record.file_size ?? (record as any).fileSize;
      const uploadedAt = record.uploaded_at ?? (record as any).uploadedAt;

      return {
        ...base,
        projectId: record.project_id,
        fileName,
        filePath,
        fileSize,
        uploadedAt,
        status: (record.status as ProjectBudget['status']) ?? 'pending'
      };
    }
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

async function prePushFiles(): Promise<{ tentados: number; sucesso: number; falhas: number }> {
  const pending = await db.files
    .where('needsUpload')
    .equals(1)
    .and(f => f._deleted !== 1)
    .toArray();

  if (!navigator.onLine) {
    return { tentados: 0, sucesso: 0, falhas: pending.length };
  }

  let tentados = 0;
  let sucesso = 0;
  let falhas = 0;

  for (const file of pending as ProjectFile[]) {
    tentados++;
    try {
      let fileObj: File | null = null;
      if (file.url && file.url.startsWith('blob:')) {
        try {
          const response = await fetch(file.url);
          const blob = await response.blob();
          fileObj = new File([blob], file.name, { type: file.type });
        } catch (err) {
          logger.warn(`prePushFiles: failed to retrieve blob for ${file.id}`, err);
        }
      }

      if (!fileObj) {
        logger.warn(`prePushFiles: missing blob for ${file.id}, skipping`);
        falhas++;
        continue;
      }

      const { storagePath, uploadedAtISO } = await uploadToStorage(fileObj, {
        projectId: file.projectId,
        installationId: file.installationId,
        id: file.id
      });

      await db.files.update(file.id, {
        storagePath,
        storage_path: storagePath,
        uploadedAt: uploadedAtISO,
        uploaded_at: uploadedAtISO,
        updatedAt: Date.now(),
        needsUpload: undefined,
        _dirty: 1,
        _deleted: 0
      } as any);

      if (file.url && file.url.startsWith('blob:')) {
        URL.revokeObjectURL(file.url);
      }

      sucesso++;
    } catch (error) {
      falhas++;
      logger.warn(`prePushFiles: failed to upload ${file.id}`, error);
    }
  }

  return { tentados, sucesso, falhas };
}

export async function syncPush(): Promise<LegacySyncMetrics> {
  const startTime = logger.syncStart('push');
  const metrics = createEmptyMetrics();

  syncStateManager.setSyncing('push');
  syncStateManager.setProgress(0, 100, 'Uploading local changes...');

  try {
    // Rate limiting check
    await rateLimiter.waitForLimit('sync_push');

    const prePushStats = await prePushFiles();
    metrics.prePushFiles = prePushStats;
    if (prePushStats.tentados > 0) {
      logger.debug(
        `📁 Pre-push: ${prePushStats.sucesso}/${prePushStats.tentados} uploads, ${prePushStats.falhas} falhas`
      );
      syncStateManager.addLog(
        'info',
        `Pre-upload de arquivos: ${prePushStats.sucesso}/${prePushStats.tentados} sucesso(s), ${prePushStats.falhas} falha(s)`
      );
    }

    // Push all entity types
    for (let i = 0; i < ENTITY_ORDER.length; i++) {
      const entity = ENTITY_ORDER[i];
      const progress = ((i + 1) / ENTITY_ORDER.length) * 100;

      syncStateManager.setProgress(progress, 100, `Uploading ${entity}...`);

      let result;
      if (entity === 'files') {
        // Use specialized file sync service
        result = await fileSyncService.pushFiles();
      } else {
        result = await pushEntityType(entity);
      }

      metrics.push[entity as keyof typeof metrics.push] = result;
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
    for (let i = 0; i < ENTITY_ORDER.length; i++) {
      const entity = ENTITY_ORDER[i];
      const progress = ((i + 1) / ENTITY_ORDER.length) * 100;

      syncStateManager.setProgress(progress, 100, `Downloading ${entity}...`);

      let result;
      if (entity === 'files') {
        // Use specialized file sync service
        result = await fileSyncService.pullFiles(lastPulledAt);
      } else {
        result = await pullEntityType(entity, lastPulledAt);
      }

      metrics.pull[entity as keyof typeof metrics.pull] = result;
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

// Export utility functions for conflict resolution
export { shouldForceUpload };