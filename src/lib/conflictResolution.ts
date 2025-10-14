import { db } from '@/db/indexedDb';
import { StorageManagerDexie } from '@/services/StorageManager';
import { toast } from 'sonner';
import { 
  markForForceUpload, 
  cleanSyncFlags, 
  logConflict,
  type EditConflictInfo 
} from './conflictUtils';

/**
 * Resolve edit conflicts between local and remote versions
 */
export async function resolveEditConflict(
  recordId: string,
  recordType: 'project' | 'installation' | 'contact' | 'budget',
  useLocal: boolean,
  localVersion: any,
  remoteVersion: any
): Promise<void> {
  try {
    if (useLocal) {
      // User chose to keep local version
      await keepLocalVersion(recordId, recordType, localVersion);
    } else {
      // User chose to use remote version
      await useRemoteVersion(recordId, recordType, remoteVersion);
    }

    // Log the resolution
    logConflict('resolved', {
      recordId,
      recordType,
      resolution: useLocal ? 'local' : 'remote'
    });

  } catch (error) {
    console.error('Error resolving conflict:', error);
    toast.error('Erro ao resolver conflito. Por favor, tente novamente.');
    throw error;
  }
}

/**
 * Keep local version and force upload to server
 */
async function keepLocalVersion(
  recordId: string,
  recordType: string,
  localVersion: any
): Promise<void> {
  // Mark record for force upload
  const markedRecord = markForForceUpload(localVersion);

  // Update in database based on type
  switch (recordType) {
    case 'project':
      await StorageManagerDexie.upsertProject(markedRecord);
      break;
    case 'installation':
      await StorageManagerDexie.upsertInstallation(markedRecord);
      break;
    case 'contact':
      await StorageManagerDexie.upsertContact(markedRecord);
      break;
    case 'budget':
      await StorageManagerDexie.upsertBudget(markedRecord);
      break;
  }

  toast.success('Sua versão foi mantida e enviada ao servidor');
}

/**
 * Discard local changes and apply remote version
 */
async function useRemoteVersion(
  recordId: string,
  recordType: string,
  remoteVersion: any
): Promise<void> {
  // Clean sync flags from remote version
  const cleanedRecord = cleanSyncFlags(remoteVersion);

  // Update in database based on type
  switch (recordType) {
    case 'project':
      await db.projects.put(cleanedRecord);
      break;
    case 'installation':
      await db.installations.put(cleanedRecord);
      break;
    case 'contact':
      await db.contacts.put(cleanedRecord);
      break;
    case 'budget':
      await db.budgets.put(cleanedRecord);
      break;
  }

  toast.success('Versão remota foi aplicada');
}

/**
 * Check if record should force upload (ignoring timestamp checks)
 */
export function shouldForceUpload(record: any): boolean {
  return record._forceUpload === 1;
}

/**
 * Clear force upload flag after successful sync
 */
export async function clearForceUploadFlag(
  recordId: string,
  recordType: string
): Promise<void> {
  const table = getTableByType(recordType);
  if (!table) return;

  const record = await table.get(recordId);
  if (record && record._forceUpload) {
    delete record._forceUpload;
    await table.put(record);
  }
}

/**
 * Get Dexie table by record type
 */
function getTableByType(recordType: string) {
  switch (recordType) {
    case 'project':
      return db.projects;
    case 'installation':
      return db.installations;
    case 'contact':
      return db.contacts;
    case 'budget':
      return db.budgets;
    default:
      return null;
  }
}