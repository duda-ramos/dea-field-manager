import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { db, type DeletedItem } from "@/db/indexedDb"
import type { Project, Installation } from "@/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ========================================
// UNDO DELETION SYSTEM
// ========================================

const DELETION_TIMEOUT = 10000; // 10 seconds

interface DeletionCallback {
  onExpire: () => Promise<void>;
  timeoutId: NodeJS.Timeout;
}

// Map to track active deletion timers
const deletionTimers = new Map<string, DeletionCallback>();

/**
 * Schedule an item for temporary deletion with undo capability
 * @param entityType - Type of entity (project or installation)
 * @param entityId - ID of the entity to delete
 * @param data - Full data of the entity to restore if needed
 * @param onPermanentDelete - Callback to execute permanent deletion
 * @returns Object with undo function and deletion ID
 */
export async function scheduleTemporaryDeletion(
  entityType: 'project' | 'installation',
  entityId: string,
  data: Project | Installation,
  onPermanentDelete: () => Promise<void>
): Promise<{ undoId: string; undo: () => Promise<void> }> {
  const deletedAt = Date.now();
  const expiresAt = deletedAt + DELETION_TIMEOUT;
  const undoId = `${entityType}_${entityId}_${deletedAt}`;

  // Store in deletedItems table
  const deletedItem: DeletedItem = {
    id: undoId,
    entityType,
    entityId,
    data,
    deletedAt,
    expiresAt,
  };

  await db.deletedItems.put(deletedItem);

  // Schedule permanent deletion
  const timeoutId = setTimeout(async () => {
    try {
      await onPermanentDelete();
      await db.deletedItems.delete(undoId);
      deletionTimers.delete(undoId);
    } catch (error) {
      console.error('Error during permanent deletion:', error);
    }
  }, DELETION_TIMEOUT);

  deletionTimers.set(undoId, {
    onExpire: onPermanentDelete,
    timeoutId,
  });

  // Return undo function
  const undo = async () => {
    const callback = deletionTimers.get(undoId);
    if (callback) {
      clearTimeout(callback.timeoutId);
      deletionTimers.delete(undoId);
    }

    const item = await db.deletedItems.get(undoId);
    if (item) {
      await db.deletedItems.delete(undoId);
      return item.data;
    }
    return null;
  };

  return { undoId, undo };
}

/**
 * Cancel a scheduled deletion and restore the item
 * @param undoId - The deletion ID returned from scheduleTemporaryDeletion
 * @returns The restored data or null if not found
 */
export async function undoDeletion(undoId: string): Promise<any | null> {
  const callback = deletionTimers.get(undoId);
  if (callback) {
    clearTimeout(callback.timeoutId);
    deletionTimers.delete(undoId);
  }

  const item = await db.deletedItems.get(undoId);
  if (item) {
    await db.deletedItems.delete(undoId);
    return item.data;
  }
  return null;
}

/**
 * Check if an entity is pending deletion
 * @param entityId - ID of the entity to check
 * @returns DeletedItem if pending deletion, null otherwise
 */
export async function isPendingDeletion(entityId: string): Promise<DeletedItem | null> {
  const items = await db.deletedItems.where('entityId').equals(entityId).toArray();
  return items.length > 0 ? items[0] : null;
}

/**
 * Clean up expired deletion records (should be called on app startup)
 */
export async function cleanupExpiredDeletions(): Promise<void> {
  const now = Date.now();
  const expired = await db.deletedItems.where('expiresAt').below(now).toArray();
  
  for (const item of expired) {
    await db.deletedItems.delete(item.id);
    const callback = deletionTimers.get(item.id);
    if (callback) {
      clearTimeout(callback.timeoutId);
      deletionTimers.delete(item.id);
    }
  }
}

/**
 * Get all items pending deletion
 */
export async function getPendingDeletions(): Promise<DeletedItem[]> {
  return db.deletedItems.toArray();
}
