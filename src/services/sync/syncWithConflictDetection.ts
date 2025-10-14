import { supabase } from '@/integrations/supabase/client';
import { db } from '@/db/indexedDb';
import { withRetry } from './utils';
import { checkForRemoteEdits, getRecordDisplayName, type EditConflictInfo } from '@/lib/conflictUtils';
import { conflictStore } from '@/stores/conflictStore';
import { logger } from '@/services/logger';

type EntityName = 'projects' | 'installations' | 'contacts' | 'budgets';
type RecordType = 'project' | 'installation' | 'contact' | 'budget';

const ENTITY_TO_RECORD_TYPE: Record<EntityName, RecordType> = {
  projects: 'project',
  installations: 'installation',
  contacts: 'contact',
  budgets: 'budget'
};

/**
 * Pull entity with conflict detection
 */
export async function pullEntityWithConflictDetection(
  entityName: EntityName,
  remoteTable: string,
  localTable: any,
  transformFunc: (record: any, entityName: string) => any,
  lastPulledAt: number,
  userId: string
): Promise<{ pulled: number; conflicts: number; errors: string[] }> {
  let hasMore = true;
  let page = 0;
  let pulled = 0;
  let conflicts = 0;
  const errors: string[] = [];
  const lastPulledDate = new Date(lastPulledAt).toISOString();
  const PULL_PAGE_SIZE = 1000;

  while (hasMore) {
    try {
      const { data: records, error } = await withRetry(async () => {
        return await supabase
          .from(remoteTable as any)
          .select('*')
          .eq('user_id', userId)
          .gt('updated_at', lastPulledDate)
          .order('updated_at', { ascending: true })
          .order('id', { ascending: true })
          .range(page * PULL_PAGE_SIZE, (page + 1) * PULL_PAGE_SIZE - 1);
      });

      if (error) {
        if ((error as any)?.code === 'PGRST301' || (error as any)?.status === 404) {
          throw new Error(`Tabela remota "${remoteTable}" não encontrada.`);
        }
        throw error;
      }

      if (records && records.length > 0) {
        logger.debug(`📥 Pulling ${records.length} ${entityName} with conflict detection (page ${page + 1})...`);

        for (const remoteRecord of records) {
          try {
            // Get local version
            const localRecord = await localTable.get(remoteRecord.id);
            
            if (localRecord && localRecord._dirty === 1) {
              // Check for conflicts
              const recordType = ENTITY_TO_RECORD_TYPE[entityName];
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
                  remoteVersion: transformFunc(remoteRecord, entityName)
                });

                logger.warn(`[Conflict] Detected for ${recordType} ${remoteRecord.id}`);
                continue; // Skip automatic update
              }
            }

            // No conflict or no local changes - apply remote version
            const transformedRecord = transformFunc(remoteRecord, entityName);
            await localTable.put(transformedRecord);
            pulled++;

          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            errors.push(`${entityName}_${remoteRecord.id}: ${errorMsg}`);
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

/**
 * Check if record should be force uploaded
 */
export function shouldForceUpload(record: any): boolean {
  return record._forceUpload === 1;
}

/**
 * Transform record for upload with force flag check
 */
export function transformForUploadWithForceCheck(
  record: any,
  transformFunc: (record: any, entityName: string, userId: string) => any,
  entityName: string,
  userId: string
): any {
  const transformed = transformFunc(record, entityName, userId);
  
  // If force upload flag is set, ensure updated_at is current
  if (shouldForceUpload(record)) {
    transformed.updated_at = new Date().toISOString();
  }
  
  return transformed;
}