import { db } from '@/db/indexedDb';
import { logger } from '@/services/logger';

export async function getLastPulledAt(): Promise<number> {
  try {
    const result = await db.meta.get('lastPulledAt');
    return result?.value || 0;
  } catch (error) {
    logger.error('Error getting lastPulledAt', { error });
    return 0;
  }
}

export async function setLastPulledAt(timestamp: number): Promise<void> {
  try {
    await db.meta.put({ key: 'lastPulledAt', value: timestamp });
  } catch (error) {
    logger.error('Error setting lastPulledAt', { error });
  }
}

export async function getSyncStatus(): Promise<'idle' | 'syncing'> {
  try {
    const result = await db.meta.get('syncStatus');
    return result?.value || 'idle';
  } catch (error) {
    logger.error('Error getting syncStatus', { error });
    return 'idle';
  }
}

export async function setSyncStatus(status: 'idle' | 'syncing'): Promise<void> {
  try {
    await db.meta.put({ key: 'syncStatus', value: status });
  } catch (error) {
    logger.error('Error setting syncStatus', { error });
  }
}