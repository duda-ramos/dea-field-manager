// This file contains the modifications needed for the sync.ts file
// to integrate conflict detection

import { clearForceUploadFlag } from '@/lib/conflictResolution';

function transformForUploadWithForceCheck(
  record: any,
  transformRecordForSupabase: any,
  entityName: string,
  userId: string
) {
  const normalizedRecord = transformRecordForSupabase(record, entityName, userId);

  if (record._forceUpload) {
    return {
      ...normalizedRecord,
      updated_at: new Date().toISOString()
    };
  }

  return normalizedRecord;
}

// Export the modified push function that checks for force upload
export async function pushEntityTypeWithForceCheck(
  entityName: string,
  ENTITY_CONFIG: any,
  getLocalTable: any,
  transformRecordForSupabase: any,
  supabase: any,
  BATCH_SIZE: number,
  createBatches: any,
  withRetry: any,
  logger: any
): Promise<{ pushed: number; deleted: number; errors: string[] }> {
  const { local, remote } = ENTITY_CONFIG[entityName];
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('User not authenticated');
  const user = session.user;

  const localTable = getLocalTable(local);
  const dirtyRecords = await localTable.where('_dirty').equals(1).toArray();
  if (dirtyRecords.length === 0) return { pushed: 0, deleted: 0, errors: [] };

  logger.debug(`📤 Pushing ${dirtyRecords.length} ${entityName} with force check...`);
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
            // Transform with force upload check
            const normalizedRecord = transformForUploadWithForceCheck(
              record,
              transformRecordForSupabase,
              entityName,
              user.id
            );
            
            await supabase.from(remote as any).upsert(normalizedRecord);
            pushed++;
            
            // Clear flags after successful upload
            await localTable.update(record.id, { _dirty: 0 });
            if (record._forceUpload) {
              await clearForceUploadFlag(record.id, entityName);
            }
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